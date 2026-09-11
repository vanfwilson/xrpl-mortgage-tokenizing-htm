from __future__ import annotations

import json
import re

from xrpl.models.transactions import Memo
from xrpl.utils import hex_to_str, str_to_hex

MEMO_TYPE = "mortgageos/v3"
_PII = re.compile(r"(ssn|social|dob|birth|email|phone|address_line|name)", re.I)


def build_memo(payload: dict) -> Memo:
    """Structural memo: loan opaque id, kind, P&I/escrow split in cents, regulatory markers. No PII."""
    for k in payload:
        if _PII.search(k):
            raise ValueError(f"memo key looks like PII: {k}")
    data = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    if len(data.encode()) > 1024:
        raise ValueError("memo exceeds 1024 bytes")
    return Memo(memo_type=str_to_hex(MEMO_TYPE), memo_format=str_to_hex("application/json"), memo_data=str_to_hex(data))


def parse_memo(envelope: dict) -> dict | None:
    for m in envelope.get("Memos", []) or []:
        memo = m.get("Memo", {})
        if hex_to_str(memo.get("MemoType", "")) == MEMO_TYPE:
            return json.loads(hex_to_str(memo["MemoData"]))
    return None
