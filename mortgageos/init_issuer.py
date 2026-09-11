"""Standalone: set asfAllowTrustLineLocking (flag 17) on the USDm issuer and mirror the result to councilforge.

Exit codes: 0 flag active and recorded; 2 ledger refused or transport failed (logged to audit_log, no traceback).
Usage: python -m mortgageos.init_issuer [role]   (default role: usdm_issuer)
"""
from __future__ import annotations

import json
import sys

from .config import ROLES, Settings
from .db.repo import Repo
from .ledger.client import Ledger, LedgerError
from .ledger.issuer import enable_trustline_locking
from .ledger.tx import TxBuilder


def main(role: str = "usdm_issuer") -> int:
    settings = Settings.load()
    repo = Repo(settings.dsn)
    repo.apply_schema()
    try:
        with Ledger(settings.xrpl_wss, repo, phase="issuer_init") as ledger:
            wallets = ledger.load_or_fund_wallets(settings.wallets_file, ROLES, settings.faucet_host)
            res = enable_trustline_locking(ledger, TxBuilder(ledger), repo, wallets[role], role)
    except LedgerError as e:
        print(json.dumps({"halt": "ledger", "code": e.code, "detail": e.detail[:800]}, indent=1))
        return 2
    finally:
        repo.close()
    print(json.dumps(res.__dict__, indent=1))
    if res.halted:
        print(f"HALT: {res.code} — see mortgageos.audit_log and issuer_accounts.last_error")
        return 2
    print(f"asfAllowTrustLineLocking active on {res.account}; issuer_accounts.escrow_enabled = true; tx {res.tx_hash}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "usdm_issuer"))
