from __future__ import annotations

from xrpl.models.amounts import MPTAmount
from xrpl.models.transactions import (
    AccountSet,
    AccountSetAsfFlag,
    DepositPreauth,
    EscrowCreate,
    EscrowFinish,
    MPTokenAuthorize,
    MPTokenIssuanceCreate,
    MPTokenIssuanceCreateFlag as CF,
    MPTokenIssuanceSet,
    MPTokenIssuanceSetFlag as SF,
    Payment,
)
from xrpl.wallet import Wallet

from .client import Ledger, TxResult
from .memo import build_memo

# The mortgage-note asset: transferable between authorized institutions, escrowable, lockable. Never clawback-able:
# the note's face value is constant for the life of the loan; amortization lives in the servicer's books.
NOTE_FLAGS = [CF.TF_MPT_CAN_LOCK, CF.TF_MPT_REQUIRE_AUTH, CF.TF_MPT_CAN_ESCROW, CF.TF_MPT_CAN_TRANSFER]
USDM_FLAGS = [CF.TF_MPT_CAN_TRANSFER, CF.TF_MPT_CAN_ESCROW, CF.TF_MPT_CAN_CLAWBACK]


class TxBuilder:
    def __init__(self, ledger: Ledger):
        self.l = ledger

    def deposit_auth(self, w: Wallet) -> TxResult:
        return self.l.submit(AccountSet(account=w.address, set_flag=AccountSetAsfFlag.ASF_DEPOSIT_AUTH), w)

    def allow_trustline_locking(self, issuer: Wallet) -> TxResult:
        return self.l.submit(AccountSet(account=issuer.address, set_flag=AccountSetAsfFlag.ASF_ALLOW_TRUSTLINE_LOCKING), issuer)

    def preauth(self, w: Wallet, authorized: str) -> TxResult:
        return self.l.submit(DepositPreauth(account=w.address, authorize=authorized), w)

    def issue_mpt(self, issuer: Wallet, max_units: int, metadata_hex: str | None, flags: list, scale: int = 2) -> TxResult:
        return self.l.submit(
            MPTokenIssuanceCreate(
                account=issuer.address, asset_scale=scale, maximum_amount=str(max_units),
                mptoken_metadata=metadata_hex, flags=flags,
            ),
            issuer,
        )

    def holder_authorize(self, holder: Wallet, issuance_id: str) -> TxResult:
        return self.l.submit(MPTokenAuthorize(account=holder.address, mptoken_issuance_id=issuance_id), holder)

    def issuer_authorize(self, issuer: Wallet, issuance_id: str, holder: str) -> TxResult:
        return self.l.submit(MPTokenAuthorize(account=issuer.address, mptoken_issuance_id=issuance_id, holder=holder), issuer)

    def send_mpt(self, sender: Wallet, dest: str, issuance_id: str, units: int, memo: dict | None = None) -> TxResult:
        return self.l.submit(
            Payment(account=sender.address, destination=dest, amount=MPTAmount(mpt_issuance_id=issuance_id, value=str(units)),
                    memos=[build_memo(memo)] if memo else None),
            sender,
        )

    def lock(self, issuer: Wallet, issuance_id: str, holder: str, memo: dict | None = None) -> TxResult:
        return self.l.submit(MPTokenIssuanceSet(account=issuer.address, mptoken_issuance_id=issuance_id, holder=holder,
                                                flags=SF.TF_MPT_LOCK, memos=[build_memo(memo)] if memo else None), issuer)

    def unlock(self, issuer: Wallet, issuance_id: str, holder: str, memo: dict | None = None) -> TxResult:
        return self.l.submit(MPTokenIssuanceSet(account=issuer.address, mptoken_issuance_id=issuance_id, holder=holder,
                                                flags=SF.TF_MPT_UNLOCK, memos=[build_memo(memo)] if memo else None), issuer)

    def escrow_create(self, owner: Wallet, dest: str, issuance_id: str, units: int, finish_after: int,
                      cancel_after: int, memo: dict) -> TxResult:
        return self.l.submit(
            EscrowCreate(account=owner.address, destination=dest,
                         amount=MPTAmount(mpt_issuance_id=issuance_id, value=str(units)),
                         finish_after=finish_after, cancel_after=cancel_after, memos=[build_memo(memo)]),
            owner,
        )

    def escrow_finish(self, finisher: Wallet, owner: str, offer_sequence: int, memo: dict | None = None) -> TxResult:
        return self.l.submit(EscrowFinish(account=finisher.address, owner=owner, offer_sequence=offer_sequence,
                                          memos=[build_memo(memo)] if memo else None), finisher)
