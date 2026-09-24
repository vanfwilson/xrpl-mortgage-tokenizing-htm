"""Standalone smoke: boards a loan as a note asset, settles one fixed P&I period through escrow, proves error triage,
runs the audit sweep, prints the success string, exits 0."""
from __future__ import annotations

import json
import sys
import time

from . import SUCCESS_STRING
from .canonical import load_canonical_loan
from .config import Settings
from .ledger.client import LedgerError
from .phases import audit, boot, phase1, phase2, phase3

# Derived from docs/demo/canonical-loan.json — the closing package reviewers read beside the
# ledger. Never hand-copy these: v3 kept a separate copy and it drifted on rate and both impounds.
LOAN = load_canonical_loan()


def main(loan_id: str | None = None) -> int:
    settings = Settings.load()
    loan_id = loan_id or f"L-{int(time.time())}"
    evidence: dict = {"loan_id": loan_id, "network": settings.xrpl_wss}
    repo = ledger = None
    try:
        repo, ledger, tx, w = boot(settings, loan_id)
        evidence["phase1"] = phase1(repo, ledger, tx, w, loan_id, settings.company_id, **LOAN)
        evidence["phase2"] = phase2(repo, ledger, tx, w, loan_id)
        evidence["phase3"] = phase3(repo, ledger, tx, w, loan_id, settings)
        evidence["audit"] = audit(repo, ledger, loan_id)
        evidence["tx_states"] = repo.tx_states(loan_id)
        assert evidence["audit"]["audit_ok"]
        assert evidence["tx_states"].get("Pending", 0) == 0, evidence["tx_states"]
    except LedgerError as e:
        print(json.dumps({"halt": "ledger", "code": e.code, "detail": e.detail[:800], "evidence": evidence}, default=str, indent=1))
        return 2
    except AssertionError as e:
        print(json.dumps({"halt": "assertion", "detail": str(e)[:800], "evidence": evidence}, default=str, indent=1))
        return 3
    finally:
        if ledger:
            ledger.__exit__(None, None, None)
        if repo:
            repo.close()
    print(json.dumps(evidence, default=str, indent=1))
    print(SUCCESS_STRING)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else None))
