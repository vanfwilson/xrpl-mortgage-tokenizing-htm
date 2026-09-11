from __future__ import annotations

import hashlib
import json

from xrpl.models.requests.account_objects import AccountObjectType
from xrpl.utils import hex_to_str, str_to_hex

from .client import Ledger, TxResult

# tf flag bits per MPTokenIssuanceCreate; lsf bits on the MPTokenIssuance ledger object share these values
TF_CAN_LOCK, TF_REQUIRE_AUTH, TF_CAN_ESCROW, TF_CAN_TRADE, TF_CAN_TRANSFER, TF_CAN_CLAWBACK = 0x02, 0x04, 0x08, 0x10, 0x20, 0x40
LSF_MPT_LOCKED = 0x01


def record_of_account_metadata(loan_id: str, manifest: dict, cid: str | None) -> tuple[str, str]:
    """Returns (hex metadata <=1024 bytes, sha256 of canonical manifest). No PII: only opaque id + hashes."""
    canonical = json.dumps(manifest, separators=(",", ":"), sort_keys=True).encode()
    sha = hashlib.sha256(canonical).hexdigest()
    # XLS-89d shape (t/n/d/ac/in) so explorers index it; servicing fields live under `ai` (additional info)
    meta = {
        "t": "MOSREC", "n": "MortgageOS record of account", "ac": "rwa", "in": "HighTechMortgage",
        "d": "Non-transferable servicer record of account for one residential loan. Not a note, not an investment.",
        "ai": {"v": 3, "kind": "record_of_account", "loan": loan_id, "sha256": sha, "cid": cid or ""},
    }
    data = json.dumps(meta, separators=(",", ":"), sort_keys=True)
    if len(data.encode()) > 1024:
        raise ValueError("MPTokenMetadata exceeds 1024 bytes")
    return str_to_hex(data), sha


def decode_metadata(hex_meta: str) -> dict:
    return json.loads(hex_to_str(hex_meta))


def issuance_id_from_result(res: TxResult) -> str:
    mid = res.meta.get("mpt_issuance_id")
    if not mid:
        raise ValueError(f"validated meta lacks mpt_issuance_id: {list(res.meta)}")
    return mid


def issuance_object(ledger: Ledger, issuer: str, issuance_id: str) -> dict | None:
    for o in ledger.account_objects(issuer, AccountObjectType.MPT_ISSUANCE):
        if o.get("mpt_issuance_id") == issuance_id:
            return o
    return None


def holder_balance(ledger: Ledger, holder: str, issuance_id: str) -> int | None:
    """On-chain MPToken balance in base units (cents when AssetScale=2); None if the holder has no MPToken."""
    for o in ledger.account_objects(holder, AccountObjectType.MPTOKEN):
        if o.get("MPTokenIssuanceID") == issuance_id:
            return int(o.get("MPTAmount", "0"))
    return None


def holder_is_locked(ledger: Ledger, holder: str, issuance_id: str) -> bool:
    for o in ledger.account_objects(holder, AccountObjectType.MPTOKEN):
        if o.get("MPTokenIssuanceID") == issuance_id:
            return bool(o.get("Flags", 0) & LSF_MPT_LOCKED)
    return False
