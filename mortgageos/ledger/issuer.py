"""Issuer initialization: asfAllowTrustLineLocking (flag 17) must be set before any trust line exists.

For an MPT settlement asset escrowability comes from tfMPTCanEscrow at issuance; this flag is what makes an
issued-currency (trust-line) form of the same asset escrowable, so it is set first, idempotently, and recorded.
"""
from __future__ import annotations

from dataclasses import dataclass

from xrpl.wallet import Wallet

from ..db.repo import Repo
from .client import Ledger, LedgerError
from .tx import TxBuilder

LSF_ALLOW_TRUSTLINE_LOCKING = 0x40000000


@dataclass
class IssuerInitResult:
    account: str
    escrow_enabled: bool
    flags: int
    tx_hash: str | None
    halted: bool = False
    code: str | None = None
    detail: str | None = None


def enable_trustline_locking(ledger: Ledger, tx: TxBuilder, repo: Repo, issuer: Wallet, role: str) -> IssuerInitResult:
    """Set flag 17 on the issuer, verify it via account_info, mirror to issuer_accounts. Never raises for ledger failures."""
    phase_before, ledger.phase = ledger.phase, "issuer_init"
    try:
        flags = int(ledger.account_info(issuer.address)["account_data"]["Flags"])
        if flags & LSF_ALLOW_TRUSTLINE_LOCKING:
            row = repo.issuer_account(issuer.address)
            repo.upsert_issuer_account(issuer.address, role, escrow_enabled=True, flags=flags,
                                       flag_tx_hash=row["flag_tx_hash"] if row else None)
            return IssuerInitResult(issuer.address, True, flags, row["flag_tx_hash"] if row else None)

        try:
            r = tx.allow_trustline_locking(issuer)
        except LedgerError as e:  # already audited by the submit path
            repo.upsert_issuer_account(issuer.address, role, escrow_enabled=False, flags=flags, last_error=e.code)
            return IssuerInitResult(issuer.address, False, flags, None, halted=True, code=e.code, detail=e.detail)
        if not r.ok:
            repo.upsert_issuer_account(issuer.address, role, escrow_enabled=False, flags=flags, flag_tx_hash=r.hash, last_error=r.result)
            return IssuerInitResult(issuer.address, False, flags, r.hash, halted=True, code=r.result, detail="ledger result not tesSUCCESS")

        flags_after = int(ledger.account_info(issuer.address)["account_data"]["Flags"])
        enabled = bool(flags_after & LSF_ALLOW_TRUSTLINE_LOCKING)
        repo.upsert_issuer_account(issuer.address, role, escrow_enabled=enabled, flags=flags_after, flag_tx_hash=r.hash,
                                   last_error=None if enabled else "flag not visible after tesSUCCESS")
        return IssuerInitResult(issuer.address, enabled, flags_after, r.hash, halted=not enabled,
                                code=None if enabled else "FLAG_NOT_SET")
    except LedgerError as e:  # account_info transport failure, already audited
        repo.upsert_issuer_account(issuer.address, role, escrow_enabled=False, flags=None, last_error=e.code)
        return IssuerInitResult(issuer.address, False, 0, None, halted=True, code=e.code, detail=e.detail)
    finally:
        ledger.phase = phase_before
