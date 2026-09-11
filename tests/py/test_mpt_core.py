"""Live Testnet + councilforge smoke. Runs the three phases once (module scope) and asserts the DoD on the evidence."""
import time

import pytest

from mortgageos.config import Settings
from mortgageos.ledger import mpt as M
from mortgageos.ledger.memo import parse_memo
from mortgageos.phases import boot, phase1, phase2, phase3, reconcile
from mortgageos.servicing.amortization import monthly_payment_cents, respa_monthly, schedule
from mortgageos.verify import LOAN


def test_amortization_math_offline():
    pmt = monthly_payment_cents(45_000_000, 650, 360)  # $450,000 @ 6.5% / 30y
    r = 0.065 / 12
    closed_form = 450_000 * r * (1 + r) ** 360 / ((1 + r) ** 360 - 1) * 100
    assert abs(pmt - closed_form) <= 1
    rows = schedule(45_000_000, 650, 360, __import__("datetime").date(2026, 10, 1), 606_250, 180_000, periods=2)
    assert rows[0]["interest_cents"] == 243_750 and rows[0]["principal_cents"] == pmt - 243_750
    assert rows[0]["tax_cents"] == respa_monthly(606_250) == 50_521
    assert rows[1]["principal_cents"] > rows[0]["principal_cents"]
    assert sum(x["principal_cents"] for x in schedule(45_000_000, 650, 360, __import__("datetime").date(2026, 10, 1))) == 45_000_000


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
        ev["rec"] = reconcile(repo, ledger, w, loan_id)
        yield ev
    finally:
        ledger.__exit__(None, None, None)
        repo.close()


def test_dod_1_1_deposit_auth_and_preauth(run):
    assert all(run["p1"]["deposit_auth"].values())
    from xrpl.models.requests.account_objects import AccountObjectType
    pre = run["ledger"].account_objects(run["w"]["issuer"].address, AccountObjectType.DEPOSIT_PREAUTH)
    assert {o["Authorize"] for o in pre} >= {run["w"]["servicer"].address, run["w"]["borrower"].address}


def test_dod_1_2_issuance_flags_and_metadata(run):
    d = run["p1"]["debt_issuance"]
    flags = int(d["flags"], 16)
    assert flags & M.TF_CAN_LOCK and flags & M.TF_CAN_CLAWBACK and flags & M.TF_CAN_ESCROW and flags & M.TF_REQUIRE_AUTH
    assert not flags & M.TF_CAN_TRANSFER
    assert d["metadata"]["ai"]["kind"] == "record_of_account" and d["metadata"]["ac"] == "rwa"
    assert run["repo"].tx(d["tx"])["state"] == "Confirmed"


def test_dod_1_3_db_row_matches_ledger(run):
    row = run["repo"].issuance_for(run["loan_id"], "record_of_account")
    assert row["issuance_id"] == run["p1"]["debt_issuance"]["id"]
    assert M.holder_balance(run["ledger"], row["holder"], row["issuance_id"]) is not None


def test_phase2_escrow_settled_with_memo(run):
    legs = run["repo"].legs(run["loan_id"], run["p2"]["period"])
    assert len(legs) == 2 and all(l["status"] == "Settled" for l in legs)
    for l in legs:
        tx = run["repo"].tx(l["create_tx_hash"])
        memo = parse_memo(tx["envelope"])
        assert memo and {"pi", "principal", "interest", "tax", "ins", "reg", "leg"} <= set(memo)
        assert run["repo"].tx(l["finish_tx_hash"])["result_code"] == "tesSUCCESS"


def test_phase2_clawback_matches_outstanding_and_lock_cycle(run):
    assert run["p2"]["reconciled"] and run["p2"]["chain_balance"] == run["p2"]["db_outstanding"]
    assert run["p2"]["db_outstanding"] < LOAN["principal_cents"]
    assert not M.holder_is_locked(run["ledger"], run["w"]["servicer"].address, run["p1"]["debt_issuance"]["id"])


def test_phase3_errors_triaged_and_logged(run):
    p3 = run["p3"]
    assert p3["unfunded"].startswith("te") and p3["timeout"] != "no-timeout" and p3["audit_rows"] >= 2
    rows = run["repo"].audit_rows(run["loan_id"], "phase3")
    assert any(r["error_code"] == p3["unfunded"] for r in rows)


def test_reconciliation_and_no_pending(run, request):
    assert run["rec"]["reconciled"]
    states = run["repo"].tx_states(run["loan_id"])
    assert states.get("Pending", 0) == 0 and states.get("Confirmed", 0) >= 10
    request.config.mos_live_pass = True
