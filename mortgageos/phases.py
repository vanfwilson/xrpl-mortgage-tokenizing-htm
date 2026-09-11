"""Phase runners. Each returns a dict of evidence; each raises LedgerError only for non-recoverable setup failures."""
from __future__ import annotations

import time
from datetime import date

from xrpl.clients import WebsocketClient
from xrpl.models.amounts import MPTAmount
from xrpl.models.requests import ServerInfo
from xrpl.models.requests.account_objects import AccountObjectType
from xrpl.models.transactions import Payment
from xrpl.wallet import Wallet

from .config import ROLES, Settings
from .db.repo import Repo
from .ledger import mpt as M
from .ledger.client import Ledger, LedgerError
from .ledger.tx import DEBT_FLAGS, USDM_FLAGS, TxBuilder
from .servicing.amortization import schedule

REG_MARKERS = ["RESPA-1024.17", "TILA-1026.41", "record_of_account", "no_transfer"]


def boot(settings: Settings, loan_id: str) -> tuple[Repo, Ledger, TxBuilder, dict[str, Wallet]]:
    repo = Repo(settings.dsn)
    repo.apply_schema()
    ledger = Ledger(settings.xrpl_wss, repo, loan_id=loan_id).__enter__()
    wallets = ledger.load_or_fund_wallets(settings.wallets_file, ROLES, settings.faucet_host)
    return repo, ledger, TxBuilder(ledger), wallets


# --- Phase 1 ----------------------------------------------------------------------

def phase1(repo: Repo, ledger: Ledger, tx: TxBuilder, w: dict[str, Wallet], loan_id: str, company_id: str,
           principal_cents: int, rate_bps: int, term_months: int, annual_tax_cents: int, annual_ins_cents: int) -> dict:
    ledger.phase = "phase1"
    ev: dict = {}

    # 1.1 DepositAuth on every account that receives money, plus the issuer; preauth the counterparties
    guarded = {"issuer": ["servicer", "borrower"], "servicer": ["issuer", "borrower"], "impound": ["borrower", "servicer"]}
    for role, allowed in guarded.items():
        if not ledger.has_deposit_auth(w[role].address):
            tx.deposit_auth(w[role])
        for other in allowed:
            existing = {o.get("Authorize") for o in ledger.account_objects(w[role].address, AccountObjectType.DEPOSIT_PREAUTH)}
            if w[other].address not in existing:
                tx.preauth(w[role], w[other].address)
    ev["deposit_auth"] = {r: ledger.has_deposit_auth(w[r].address) for r in guarded}
    assert all(ev["deposit_auth"].values()), ev["deposit_auth"]

    repo.upsert_loan(loan_id=loan_id, company_id=company_id, principal_cents=principal_cents, rate_bps=rate_bps,
                     term_months=term_months, outstanding_cents=principal_cents, annual_tax_cents=annual_tax_cents,
                     annual_ins_cents=annual_ins_cents, issuer_account=w["issuer"].address, holder_account=w["servicer"].address,
                     impound_account=w["impound"].address, borrower_account=w["borrower"].address, status="boarding")

    # 1.2 debt MPT = record of account: supply == principal in cents, no CanTransfer
    manifest = {"loan": loan_id, "principal_cents": principal_cents, "rate_bps": rate_bps, "term_months": term_months}
    meta_hex, sha = M.record_of_account_metadata(loan_id, manifest, cid=None)
    r = tx.issue_mpt(w["issuer"], principal_cents, meta_hex, DEBT_FLAGS)
    assert r.ok, r.result
    debt_id = M.issuance_id_from_result(r)
    obj = M.issuance_object(ledger, w["issuer"].address, debt_id)
    assert obj, "issuance object not found on ledger"
    flags = int(obj["Flags"])
    assert flags & M.TF_CAN_LOCK and flags & M.TF_CAN_CLAWBACK and flags & M.TF_CAN_ESCROW and flags & M.TF_REQUIRE_AUTH, hex(flags)
    assert not flags & M.TF_CAN_TRANSFER, "record_of_account must not be transferable"
    decoded = M.decode_metadata(obj["MPTokenMetadata"])
    assert decoded["ai"]["kind"] == "record_of_account" and decoded["ai"]["loan"] == loan_id
    ev["debt_issuance"] = {"id": debt_id, "flags": hex(flags), "metadata": decoded, "tx": r.hash}

    # 1.3 mirror into councilforge, authorize the holder, deliver the principal units
    repo.insert_issuance(issuance_id=debt_id, loan_id=loan_id, purpose="record_of_account", issuer=w["issuer"].address,
                         holder=w["servicer"].address, asset_scale=2, flags=flags, max_units=principal_cents,
                         metadata_hex=obj["MPTokenMetadata"], metadata_json=decoded, manifest_sha256=sha, create_tx_hash=r.hash)
    if M.holder_balance(ledger, w["servicer"].address, debt_id) is None:
        assert tx.holder_authorize(w["servicer"], debt_id).ok
        assert tx.issuer_authorize(w["issuer"], debt_id, w["servicer"].address).ok
    assert tx.send_mpt(w["issuer"], w["servicer"].address, debt_id, principal_cents,
                       memo={"loan": loan_id, "kind": "record_of_account", "event": "board", "units": principal_cents, "reg": REG_MARKERS}).ok
    bal = M.holder_balance(ledger, w["servicer"].address, debt_id)
    assert bal == principal_cents, (bal, principal_cents)

    # PASS/FAIL: ledger issuance id from a fresh account_objects query == DB row
    db_row = repo.issuance_for(loan_id, "record_of_account")
    on_chain = [o["MPTokenIssuanceID"] for o in ledger.account_objects(w["servicer"].address, AccountObjectType.MPTOKEN)]
    assert db_row and db_row["issuance_id"] in on_chain, (db_row, on_chain)
    repo.set_loan_status(loan_id, "active")
    ev["phase1_pass"] = True
    return ev


# --- Phase 2 ----------------------------------------------------------------------

def ensure_usdm(repo: Repo, ledger: Ledger, tx: TxBuilder, w: dict[str, Wallet], loan_id: str, fund_borrower_units: int) -> str:
    """Self-issued USD settlement MPT. Testnet RLUSD does not allow trust-line locking, so it cannot be escrowed."""
    row = repo.issuance_for(loan_id, "settlement")
    if row:
        usdm = row["issuance_id"]
    else:
        r = tx.issue_mpt(w["usdm_issuer"], 10**12, None, USDM_FLAGS)
        assert r.ok, r.result
        usdm = M.issuance_id_from_result(r)
        repo.insert_issuance(issuance_id=usdm, loan_id=loan_id, purpose="settlement", issuer=w["usdm_issuer"].address,
                             asset_scale=2, flags=int(sum(f.value for f in USDM_FLAGS)), max_units=10**12, create_tx_hash=r.hash)
    for role in ("borrower", "servicer", "impound", "tax_authority"):
        if M.holder_balance(ledger, w[role].address, usdm) is None:
            assert tx.holder_authorize(w[role], usdm).ok
    if (M.holder_balance(ledger, w["borrower"].address, usdm) or 0) < fund_borrower_units:
        assert tx.send_mpt(w["usdm_issuer"], w["borrower"].address, usdm, fund_borrower_units).ok
    return usdm


def phase2(repo: Repo, ledger: Ledger, tx: TxBuilder, w: dict[str, Wallet], loan_id: str, finish_delay_s: int = 12) -> dict:
    ledger.phase = "phase2"
    loan = repo.loan(loan_id)
    assert loan, "loan not boarded"
    debt = repo.issuance_for(loan_id, "record_of_account")["issuance_id"]

    rows = schedule(loan["principal_cents"], loan["rate_bps"], loan["term_months"], date.today().replace(day=1),
                    loan["annual_tax_cents"], loan["annual_ins_cents"], periods=12)
    repo.replace_schedule(loan_id, rows)
    repo.update_loan(loan_id, amortization=rows[:12])

    # 2.1 event loop reads the next scheduled payment from the DB
    p = repo.next_scheduled(loan_id)
    assert p, "no scheduled period"
    impound_units = p["tax_cents"] + p["ins_cents"]
    usdm = ensure_usdm(repo, ledger, tx, w, loan_id, fund_borrower_units=(p["pi_cents"] + impound_units) * 3)

    now = ledger.ledger_time()
    finish_after, cancel_after = now + finish_delay_s, now + 3600
    split = {"loan": loan_id, "period": p["period"], "due": p["due_date"].isoformat(), "pi": p["pi_cents"],
             "principal": p["principal_cents"], "interest": p["interest_cents"], "tax": p["tax_cents"], "ins": p["ins_cents"],
             "reg": REG_MARKERS}
    legs = [("pi", w["servicer"].address, p["pi_cents"]), ("impound", w["impound"].address, impound_units)]
    ev: dict = {"period": p["period"], "legs": []}
    leg_ids: list[tuple[int, int, str]] = []
    for leg, dest, units in legs:
        memo = {**split, "leg": leg, "units": units}
        r = tx.escrow_create(w["borrower"], dest, usdm, units, finish_after, cancel_after, memo)  # 2.2 memo carries the split
        leg_id = repo.insert_leg(loan_id=loan_id, period=p["period"], leg=leg, owner_account=w["borrower"].address, dest_account=dest,
                                 issuance_id=usdm, units=units, finish_after=finish_after, cancel_after=cancel_after,
                                 create_tx_hash=r.hash, offer_sequence=r.sequence, memo=memo, status="Created" if r.ok else "Failed")
        assert r.ok, r.result
        leg_ids.append((leg_id, r.sequence, dest))
    repo.set_period_status(loan_id, p["period"], "Escrowed")

    # 2.3 late-payment path: lock the record while the escrow is not yet finishable, then unlock after settlement
    assert tx.lock(w["issuer"], debt, w["servicer"].address, memo={"loan": loan_id, "event": "lock", "reason": "pending_settlement"}).ok
    assert M.holder_is_locked(ledger, w["servicer"].address, debt)

    ledger.wait_ledger_time_after(finish_after)
    finisher = {w["servicer"].address: w["servicer"], w["impound"].address: w["impound"]}
    for leg_id, seq, dest in leg_ids:
        r = tx.escrow_finish(finisher[dest], w["borrower"].address, seq, memo={"loan": loan_id, "event": "settle", "period": p["period"]})
        assert r.ok, r.result  # PASS/FAIL: tesSUCCESS on-ledger
        repo.leg_settled(leg_id, r.hash)
        ev["legs"].append({"leg_id": leg_id, "finish_tx": r.hash, "result": r.result})
    repo.set_period_status(loan_id, p["period"], "Settled")

    # settled: unlock, then amortize by clawing back this period's principal so on-chain balance == outstanding
    assert tx.unlock(w["issuer"], debt, w["servicer"].address, memo={"loan": loan_id, "event": "unlock"}).ok
    assert not M.holder_is_locked(ledger, w["servicer"].address, debt)
    new_outstanding = loan["outstanding_cents"] - p["principal_cents"]
    r = tx.clawback(w["issuer"], w["servicer"].address, debt, p["principal_cents"],
                    memo={"loan": loan_id, "event": "amortize", "period": p["period"], "principal": p["principal_cents"]})
    assert r.ok, r.result
    repo.set_outstanding(loan_id, new_outstanding)

    legs_db = repo.legs(loan_id, p["period"])
    assert legs_db and all(l["status"] == "Settled" for l in legs_db), legs_db
    ev.update(reconcile(repo, ledger, w, loan_id))
    assert ev["reconciled"], ev
    ev["phase2_pass"] = True
    return ev


def reconcile(repo: Repo, ledger: Ledger, w: dict[str, Wallet], loan_id: str) -> dict:
    """Sweep: DB outstanding (authoritative) vs on-chain record balance (evidence). Mismatch is an incident."""
    loan = repo.loan(loan_id)
    debt = repo.issuance_for(loan_id, "record_of_account")["issuance_id"]
    on_chain = M.holder_balance(ledger, loan["holder_account"], debt)
    ok = on_chain == loan["outstanding_cents"]
    if not ok:
        repo.audit(loan_id, "reconcile", "MISMATCH", f"db={loan['outstanding_cents']} chain={on_chain}", None)
    return {"reconciled": ok, "db_outstanding": loan["outstanding_cents"], "chain_balance": on_chain}


# --- Phase 3 ----------------------------------------------------------------------

BLACKHOLE_WSS = "wss://10.255.255.1:51233"


def _timeout_probe(repo: Repo, loan_id: str, url: str = BLACKHOLE_WSS) -> str:
    req = ServerInfo()
    try:
        with WebsocketClient(url, timeout=3) as c:
            c.request(req)
        return "no-timeout"
    except Exception as e:
        code = "timeout" if isinstance(e, (TimeoutError, OSError)) or "timed out" in str(e).lower() else type(e).__name__
        repo.audit(loan_id, "phase3", code, f"{type(e).__name__}: {e}"[:4000], {"url": url, **req.to_dict()})
        return code


def phase3(repo: Repo, ledger: Ledger, tx: TxBuilder, w: dict[str, Wallet], loan_id: str, settings: Settings) -> dict:
    ledger.phase = "phase3"
    before = len(repo.audit_rows(loan_id, "phase3"))
    usdm = repo.issuance_for(loan_id, "settlement")["issuance_id"]

    # 3.2a ledger error: borrower tries to move more USDm than it holds -> tec*, caught, logged, loop continues
    have = M.holder_balance(ledger, w["borrower"].address, usdm) or 0
    code_unfunded = ledger.submit_expect_failure(
        Payment(account=w["borrower"].address, destination=w["servicer"].address,
                amount=MPTAmount(mpt_issuance_id=usdm, value=str(have + 10**9))), w["borrower"])
    assert code_unfunded.startswith("tec") or code_unfunded.startswith("te"), code_unfunded

    # 3.2b network timeout: an unroutable node (RFC 1918 blackhole) times out on the opening handshake
    code_timeout = _timeout_probe(repo, loan_id)

    rows = repo.audit_rows(loan_id, "phase3")
    assert len(rows) >= before + 2 and code_timeout == "timeout", [r["error_code"] for r in rows]
    assert all(r["envelope"] is not None for r in rows[-2:]), "audit rows must carry the envelope"
    return {"unfunded": code_unfunded, "timeout": code_timeout, "audit_rows": len(rows) - before, "phase3_pass": True}
