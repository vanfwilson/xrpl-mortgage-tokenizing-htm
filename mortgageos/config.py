from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

MAINNET_MARKERS = ("xrplcluster.com", "s1.ripple.com", "s2.ripple.com", "xrpl.ws")

ROLES = ("issuer", "servicer", "impound", "borrower", "usdm_issuer", "tax_authority")


@dataclass(frozen=True)
class Settings:
    xrpl_wss: str
    faucet_host: str | None
    dsn: str
    wallets_file: Path
    company_id: str

    @classmethod
    def load(cls) -> "Settings":
        wss = os.environ.get("XRPL_WSS", "wss://s.altnet.rippletest.net:51233")
        if any(m in wss for m in MAINNET_MARKERS):
            raise SystemExit(f"refusing Mainnet endpoint: {wss}")
        dsn = os.environ.get("COUNCILFORGE_DSN", "")
        if not dsn:
            raise SystemExit("COUNCILFORGE_DSN is not set")
        return cls(
            xrpl_wss=wss,
            faucet_host=os.environ.get("XRPL_FAUCET_HOST") or None,
            dsn=dsn,
            wallets_file=Path(os.environ.get("MOS_WALLETS_FILE", ROOT / "out" / "wallets.py.testnet.json")),
            company_id=os.environ.get("MOS_COMPANY_ID", "htm"),
        )
