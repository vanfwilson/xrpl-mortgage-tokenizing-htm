"""Live Testnet + councilforge smoke. Runs the three phases once (module scope) and asserts the DoD on the evidence."""
import datetime
import time

import pytest

from mortgageos.config import Settings
from mortgageos.ledger import mpt as M
from mortgageos.ledger.memo import parse_memo
from mortgageos.phases import audit, boot, phase1, phase2, phase3
from mortgageos.servicing.amortization import assert_fixed_rate, monthly_payment_cents, respa_monthly, schedule
from mortgageos.verify import LOAN


def test_amortization_math_offline():
    pmt = monthly_payment_cents(45_000_000, 650, 360)  # $450,000 @ 6.5% / 30y
    r = 0.065 / 12
    closed_form = 450_000 * r * (1 + r) ** 360 / ((1 + r) ** 360 - 1) * 100
    assert abs(pmt - closed_form) <= 1
    rows = schedule(45_000_000, 650, 360, datetime.date(2026, 10, 1), 606_250, 180_000)
    assert len(rows) == 360 and assert_fixed_rate(rows) == pmt
    assert all(x["pi_cents"] == pmt for x in rows[:-1])  # strict fixed-rate: identical P&I every month
    assert rows[0]["interest_cents"] == 243_750 and rows[0]["principal_cents"] == pmt - 243_750
    assert rows[0]["tax_cents"] == respa_monthly(606_250) == 50_521
    assert sum(x["principal_cents"] for x in rows) == 45_000_000
    with pytest.raises(ValueError):
        assert_fixed_rate([{**rows[0]}, {**rows[1], "pi_cents": pmt + 1}, {**rows[2]}])


@pytest.fixture(scope="module")
def run():
    settings = Settings.load()
    loan_id = f"T-{int(time.time())}"
    repo, ledger, tx, w = boot(settings, loan_id)
    ev = {"loan_id": loan_id, "settings": settings, "repo": repo, "ledger": ledger, "w": w}
    try:
        ev["p1"] = phase1(repo, ledger, tx, w, loan_id, settings.company_id, **LOAN)
        ev["p2"] = phase2(repo, ledger, tx, w, loan_id)
        ev["p3"] = phase3(repo, ledger, tx, w, loan_id, settings)
        ev["audit"] = audit(repo, ledger, loan_id)
        yield ev
    finally:
        ledger.__exit__(None, None, None)
        repo.close()


def test_dod_1_1_deposit_auth_and_preauth(run):
    assert all(run["p1"]["deposit_auth"].values())
    from xrpl.models.requests.account_objects import AccountObjectType
    pre = run["ledger"].account_objects(run["w"]["issuer"].address, AccountObjectType.DEPOSIT_PREAUTH)
    assert {o["Authorize"] for o in pre} >= {run["w"]["lender"].address, run["w"]["borrower"].address}


def test_dod_1_2_note_asset_flags_and_metadata(run):
    d = run["p1"]["note_issuance"]
    flags = int(d["flags"], 16)
    assert flags & M.TF_CAN_ESCROW and flags & M.TF_CAN_TRANSFER and flags & M.TF_CAN_LOCK and flags & M.TF_REQUIRE_AUTH
    assert not flags & M.TF_CAN_CLAWBACK
    assert d["metadata"]["ai"]["kind"] == "mortgage_note" and d["metadata"]["ac"] == "rwa"
    assert d["metadata"]["ai"]["pi_cents"] == monthly_payment_cents(LOAN["principal_cents"], LOAN["rate_bps"], LOAN["term_months"])
    assert run["repo"].tx(d["tx"])["state"] == "Confirmed"


def test_dod_1_3_lender_holds_note_at_face_value(run):
    row = run["repo"].issuance_for(run["loan_id"], "note_asset")
    assert row["issuance_id"] == run["p1"]["note_issuance"]["id"] and row["holder"] == run["w"]["lender"].address
    assert M.holder_balance(run["ledger"], row["holder"], row["issuance_id"]) == LOAN["principal_cents"]


def test_usdm_issuer_trustline_locking_flag(run):
    from mortgageos.ledger.issuer import LSF_ALLOW_TRUSTLINE_LOCKING
    issuer = run["w"]["usdm_issuer"].address
    row = run["repo"].issuer_account(issuer)
    assert row and row["escrow_enabled"] is True and row["flag_tx_hash"]
    flags = int(run["ledger"].account_info(issuer)["account_data"]["Flags"])
    assert flags & LSF_ALLOW_TRUSTLINE_LOCKING


def test_phase2_fixed_pi_escrow_settled_with_memo_and_proof(run):
    legs = run["repo"].legs(run["loan_id"], run["p2"]["period"])
    assert len(legs) == 2 and all(l["status"] == "Settled" for l in legs)
    for l in legs:
        memo = parse_memo(run["repo"].tx(l["create_tx_hash"])["envelope"])
        assert memo and {"pi", "principal", "interest", "tax", "ins", "reg", "leg"} <= set(memo)
        assert run["repo"].tx(l["finish_tx_hash"])["result_code"] == "tesSUCCESS"
        assert l["proof_verified_at"] is not None and l["proof_ledger_index"]
    pi_leg = next(l for l in legs if l["leg"] == "pi")
    assert pi_leg["units"] == run["p2"]["pi_cents"] and pi_leg["dest_account"] == run["w"]["lender"].address


def test_phase2_schedule_is_strictly_fixed_and_books_amortize_off_ledger(run):
    rows = run["repo"].schedule_rows(run["loan_id"])
    assert len(rows) == LOAN["term_months"] and len({r["pi_cents"] for r in rows[:-1]}) == 1
    loan = run["repo"].loan(run["loan_id"])
    assert loan["outstanding_cents"] == LOAN["principal_cents"] - rows[0]["principal_cents"]
    note = run["p1"]["note_issuance"]["id"]
    assert M.holder_balance(run["ledger"], run["w"]["lender"].address, note) == LOAN["principal_cents"]  # face value unchanged
    assert not M.holder_is_locked(run["ledger"], run["w"]["lender"].address, note)


def test_phase3_errors_triaged_and_logged(run):
    p3 = run["p3"]
    assert p3["unfunded"].startswith("te") and p3["timeout"] == "timeout" and p3["audit_rows"] >= 2
    rows = run["repo"].audit_rows(run["loan_id"], "phase3")
    assert any(r["error_code"] == p3["unfunded"] for r in rows)


def test_audit_sweep_and_no_pending(run, request):
    a = run["audit"]
    assert a["audit_ok"] and a["proofs_verified"] == a["proofs_total"] == 2 and a["chain_units"] == a["asset_face_value"]
    states = run["repo"].tx_states(run["loan_id"])
    assert states.get("Pending", 0) == 0 and states.get("Confirmed", 0) >= 10
    request.config.mos_live_pass = True
