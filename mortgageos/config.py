from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

MAINNET_MARKERS = ("xrplcluster.com", "s1.ripple.com", "s2.ripple.com", "xrpl.ws")

# Deliberate opt-in phrase for Mainnet. The default posture stays "refuse": a Mainnet run spends
# real XRP and cannot be undone, so it must never be reachable by an accidental env var.
MAINNET_OPT_IN = "yes-real-xrp"

ROLES = ("issuer", "lender", "impound", "borrower", "usdm_issuer", "tax_authority")


@dataclass(frozen=True)
class Settings:
    xrpl_wss: str
    faucet_host: str | None
    dsn: str
    wallets_file: Path
    company_id: str
    mainnet: bool

    @classmethod
    def load(cls) -> "Settings":
        wss = os.environ.get("XRPL_WSS", "wss://s.altnet.rippletest.net:51233")
        mainnet = any(m in wss for m in MAINNET_MARKERS)
        if mainnet and os.environ.get("MOS_ALLOW_MAINNET") != MAINNET_OPT_IN:
            raise SystemExit(
                f"refusing Mainnet endpoint: {wss}\n"
                f"Mainnet spends real XRP and is irreversible. To proceed deliberately, set:\n"
                f'  MOS_ALLOW_MAINNET="{MAINNET_OPT_IN}"\n'
                "There is no faucet on Mainnet — run `python -m mortgageos.provision` first to\n"
                "generate the role wallets and print how much XRP each one needs."
            )
        dsn = os.environ.get("COUNCILFORGE_DSN", "")
        if not dsn:
            raise SystemExit("COUNCILFORGE_DSN is not set")
        return cls(
            xrpl_wss=wss,
            faucet_host=os.environ.get("XRPL_FAUCET_HOST") or None,
            dsn=dsn,
            wallets_file=Path(os.environ.get(
                "MOS_WALLETS_FILE",
                ROOT / "out" / ("wallets.py.mainnet.json" if mainnet else "wallets.py.testnet.json"),
            )),
            company_id=os.environ.get("MOS_COMPANY_ID", "htm"),
            mainnet=mainnet,
        )
