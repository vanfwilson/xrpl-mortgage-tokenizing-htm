from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from xrpl.clients import WebsocketClient
from xrpl.models.requests import AccountInfo, AccountObjects, Request, Tx
from xrpl.models.requests import Ledger as LedgerRequest
from xrpl.models.requests.account_objects import AccountObjectType
from xrpl.models.transactions import Transaction
from xrpl.transaction import autofill_and_sign, submit_and_wait
from xrpl.wallet import Wallet, generate_faucet_wallet

from ..db.repo import Repo

LSF_DEPOSIT_AUTH = 0x01000000


class LedgerError(Exception):
    """A ledger-side failure that was triaged and logged; the loop keeps running."""

    def __init__(self, code: str, detail: str, envelope: dict | None = None):
        super().__init__(f"{code}: {detail}")
        self.code, self.detail, self.envelope = code, detail, envelope or {}


@dataclass
class TxResult:
    hash: str
    result: str
    ledger_index: int | None
    meta: dict
    envelope: dict
    sequence: int | None = None

    @property
    def ok(self) -> bool:
        return self.result == "tesSUCCESS"


@dataclass
class Ledger:
    wss: str
    repo: Repo
    loan_id: str | None = None
    phase: str = "setup"
    _client: WebsocketClient | None = field(default=None, repr=False)

    def __enter__(self) -> "Ledger":
        self._client = WebsocketClient(self.wss)
        self._client.__enter__()
        return self

    def __exit__(self, *exc) -> None:
        if self._client:
            self._client.__exit__(*exc)

    @property
    def client(self) -> WebsocketClient:
        assert self._client, "use `with Ledger(...) as l`"
        return self._client

    # --- requests -------------------------------------------------------------

    def request(self, req: Request, retries: int = 3) -> dict:
        last: Exception | None = None
        for attempt in range(retries):
            try:
                r = self.client.request(req)
                if r.is_successful():
                    return r.result
                err = r.result.get("error", "unknown")
                if err in ("actNotFound", "entryNotFound"):
                    return r.result
                last = LedgerError(err, json.dumps(r.result)[:2000], req.to_dict())
            except LedgerError:
                raise
            except Exception as e:  # network / timeout
                last = e
            time.sleep(1.5 * (attempt + 1))
        assert last is not None
        code = getattr(last, "code", type(last).__name__)
        self.repo.audit(self.loan_id, self.phase, code, str(last)[:4000], req.to_dict())
        raise LedgerError(code, str(last), req.to_dict())

    def account_info(self, address: str) -> dict:
        return self.request(AccountInfo(account=address, ledger_index="validated"))

    def has_deposit_auth(self, address: str) -> bool:
        return bool(self.account_info(address)["account_data"]["Flags"] & LSF_DEPOSIT_AUTH)

    def account_objects(self, address: str, kind: AccountObjectType) -> list[dict]:
        r = self.request(AccountObjects(account=address, type=kind, ledger_index="validated"))
        return r.get("account_objects", [])

    def ledger_time(self) -> int:
        r = self.request(LedgerRequest(ledger_index="validated"))
        return int(r["ledger"]["close_time"])

    def wait_ledger_time_after(self, ripple_time: int, timeout_s: int = 180) -> None:
        deadline = time.time() + timeout_s
        while self.ledger_time() <= ripple_time:
            if time.time() > deadline:
                raise LedgerError("timeout", f"ledger close_time never passed {ripple_time}")
            time.sleep(4)

    # --- submission -------------------------------------------------------------

    def submit(self, tx: Transaction, wallet: Wallet) -> TxResult:
        """Sign, record Pending, submit, record Confirmed/Failed. Never raises for tec; raises LedgerError otherwise."""
        try:
            signed = autofill_and_sign(tx, self.client, wallet)
        except Exception as e:
            self.repo.audit(self.loan_id, self.phase, type(e).__name__, str(e)[:4000], tx.to_xrpl())
            raise LedgerError(type(e).__name__, str(e), tx.to_xrpl()) from e
        envelope = signed.to_xrpl()
        tx_hash = signed.get_hash()
        self.repo.tx_pending(self.loan_id, tx_hash, envelope)
        try:
            resp = submit_and_wait(signed, self.client)
        except Exception as e:
            code = _classify(e)
            self.repo.tx_failed(tx_hash, code, str(e)[:4000])
            self.repo.audit(self.loan_id, self.phase, code, str(e)[:4000], envelope)
            raise LedgerError(code, str(e), envelope) from e
        res = resp.result
        meta = res.get("meta", {}) if isinstance(res.get("meta"), dict) else {}
        result = TxResult(
            hash=res.get("hash", tx_hash),
            result=meta.get("TransactionResult", res.get("engine_result", "unknown")),
            ledger_index=res.get("ledger_index"),
            meta=meta,
            envelope=envelope,
            sequence=envelope.get("Sequence"),
        )
        if result.ok:
            self.repo.tx_confirmed(result.hash, result.result, result.ledger_index, meta)
        else:
            self.repo.tx_failed(result.hash, result.result, json.dumps(meta)[:4000])
            self.repo.audit(self.loan_id, self.phase, result.result, json.dumps(res)[:4000], envelope)
        return result

    def submit_expect_failure(self, tx: Transaction, wallet: Wallet) -> str:
        """Phase 3: run a broadcast that should fail; return the triaged code. Never propagates."""
        try:
            r = self.submit(tx, wallet)
            return r.result
        except LedgerError as e:
            return e.code

    def tx(self, tx_hash: str) -> dict:
        return self.request(Tx(transaction=tx_hash))

    # --- wallets ----------------------------------------------------------------

    def load_or_fund_wallets(self, path: Path, roles: tuple[str, ...], faucet_host: str | None) -> dict[str, Wallet]:
        wallets: dict[str, Wallet] = {}
        stored: dict[str, str] = {}
        if path.exists():
            stored = json.loads(path.read_text())
        for role in roles:
            if role in stored:
                wallets[role] = Wallet.from_seed(stored[role])
                continue
            for attempt in range(3):
                try:
                    wallets[role] = generate_faucet_wallet(self.client, debug=False, faucet_host=faucet_host)
                    break
                except Exception as e:
                    if attempt == 2:
                        raise LedgerError("faucet", f"{role}: {e}") from e
                    time.sleep(5)
            stored[role] = wallets[role].seed
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(stored, indent=2))
        return wallets


def _classify(e: Exception) -> str:
    text = str(e)
    for prefix in ("tec", "tef", "tem", "tel", "ter"):
        i = text.find(prefix)
        if i >= 0:
            token = text[i:i + 40].split()[0].strip("',.:\"")
            if token.startswith(prefix) and token[3:4].isupper():
                return token
    name = type(e).__name__
    if "timed out" in text.lower() or "timeout" in name.lower():
        return "timeout"
    return name
