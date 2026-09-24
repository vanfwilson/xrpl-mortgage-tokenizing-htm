from __future__ import annotations

import hashlib
import json

from xrpl.models.requests.account_objects import AccountObjectType
from xrpl.utils import hex_to_str, str_to_hex

from .client import Ledger, TxResult

# tf flag bits per MPTokenIssuanceCreate; lsf bits on the MPTokenIssuance ledger object share these values
TF_CAN_LOCK, TF_REQUIRE_AUTH, TF_CAN_ESCROW, TF_CAN_TRADE, TF_CAN_TRANSFER, TF_CAN_CLAWBACK = 0x02, 0x04, 0x08, 0x10, 0x20, 0x40
LSF_MPT_LOCKED = 0x01


# XLS-89d discovery fields. Explorers and indexers validate these; a non-compliant MPT may not be
# displayed at all, which would defeat the point of a publicly verifiable note on Mainnet.
# `icon` must resolve publicly — GitHub Pages does not serve /assets, so this points at raw.
ICON_URL = "https://raw.githubusercontent.com/vanfwilson/xrpl-mortgage-tokenizing-htm/main/assets/brand/mortgageos-lockup-tight.png"
REPO_URL = "https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm"
EVIDENCE_URL = "https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/evidence/v3/"

# A mortgage note is a credit instrument, not the property itself — `private_credit`, not
# `real_estate`. One of: stablecoin, commodity, real_estate, private_credit, equity, treasury, other.
NOTE_ASSET_SUBCLASS = "private_credit"


def note_asset_metadata(loan_id: str, terms: dict, cid: str | None) -> tuple[str, str]:
    """Returns (hex metadata <=1024 bytes, sha256 of the canonical terms manifest). No PII: opaque id, terms, hashes."""
    canonical = json.dumps(terms, separators=(",", ":"), sort_keys=True).encode()
    sha = hashlib.sha256(canonical).hexdigest()
    # XLS-89d compact shape so explorers index it; note terms live under `ai` (additional info).
    # `us` gives a reviewer a path from the explorer straight to the source and the evidence run.
    meta = {
        "t": "HTMMTG", "n": "MortgageOS mortgage note (digital twin)", "ac": "rwa",
        "as": NOTE_ASSET_SUBCLASS, "in": "HighTechMortgage", "i": ICON_URL,
        "d": "Digital twin of one 30-year fixed-rate residential mortgage note: the holder's right to the fixed P&I cash flow. Servicing and borrower data stay off-ledger.",
        "us": [{"u": REPO_URL, "c": "source", "t": "Repository"},
               {"u": EVIDENCE_URL, "c": "website", "t": "Evidence report"}],
        "ai": {"v": 4, "kind": "mortgage_note", "loan": loan_id, "principal_cents": terms["principal_cents"],
               "rate_bps": terms["rate_bps"], "term_months": terms["term_months"], "pi_cents": terms["pi_cents"],
               "sha256": sha, "cid": cid or ""},
    }
    data = json.dumps(meta, separators=(",", ":"), sort_keys=True)
    if len(data.encode()) > 1024:
        raise ValueError(f"MPTokenMetadata exceeds 1024 bytes ({len(data.encode())})")
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
