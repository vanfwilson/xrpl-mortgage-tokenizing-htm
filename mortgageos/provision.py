"""Mainnet wallet provisioning. There is no faucet on Mainnet, so the six role wallets must be
created locally and funded with real XRP by a human before any phase can run.

This module is deliberately read-only against the ledger: it creates keys, reports what each
account still needs, and exits non-zero until every role is funded. It never moves money.

    python -m mortgageos.provision
"""
from __future__ import annotations

import json
import os
import sys

from xrpl.clients import WebsocketClient
from xrpl.models.requests import AccountInfo
from xrpl.wallet import Wallet

from .config import ROLES, Settings

# XRP each role needs: 1 XRP base reserve + 0.2 per owned object + working headroom for a
# 12-month servicing run. Deliberately generous; leftover XRP stays spendable in the wallet.
FUNDING_PLAN = {
    "issuer": 5,        # MPTokenIssuance, USDM issuance, DepositPreauth x2
    "lender": 6,        # MPToken holding, preauths, receives escrow finishes
    "borrower": 8,      # originates every P&I and impound escrow (0.2 each, ~13/yr)
    "impound": 5,       # preauths, receives impound escrows
    "usdm_issuer": 3,   # stablecoin issuance
    "tax_authority": 3, # disbursement recipient
}

DROPS = 1_000_000


def balance_xrp(client: WebsocketClient, address: str) -> float | None:
    """Validated XRP balance, or None when the account does not exist yet (never funded)."""
    r = client.request(AccountInfo(account=address, ledger_index="validated"))
    if not r.is_successful():
        if r.result.get("error") == "actNotFound":
            return None
        raise RuntimeError(f"{address}: {r.result.get('error_message') or r.result.get('error')}")
    return int(r.result["account_data"]["Balance"]) / DROPS


def main() -> int:
    # Provisioning only creates keys and reads balances — it never opens the database. Settings
    # still requires a DSN, so stand one in rather than making the operator export a real one.
    os.environ.setdefault("COUNCILFORGE_DSN", "postgresql://unused/provisioning-only")
    settings = Settings.load()
    if not settings.mainnet:
        print(f"note: {settings.xrpl_wss} is not Mainnet — the faucet path already handles funding.")

    path = settings.wallets_file
    stored: dict[str, str] = json.loads(path.read_text()) if path.exists() else {}

    created = []
    for role in ROLES:
        if role not in stored:
            stored[role] = Wallet.create().seed
            created.append(role)
    if created:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(stored, indent=2))
        print(f"created {len(created)} new wallet(s): {', '.join(created)}")
        print(f"seeds written to {path}  (gitignored — this file controls real funds, back it up offline)\n")

    wallets = {role: Wallet.from_seed(stored[role]) for role in ROLES}

    rows, shortfall_total = [], 0.0
    with WebsocketClient(settings.xrpl_wss) as client:
        for role in ROLES:
            addr = wallets[role].address
            need = FUNDING_PLAN[role]
            bal = balance_xrp(client, addr)
            have = bal or 0.0
            short = max(0.0, need - have)
            shortfall_total += short
            rows.append((role, addr, "unfunded" if bal is None else f"{have:.2f}", f"{need}", f"{short:.2f}"))

    w = max(len(r[1]) for r in rows)
    print(f"{'ROLE':<14} {'ADDRESS':<{w}} {'BALANCE':>10} {'NEED':>6} {'SEND':>8}")
    for role, addr, have, need, short in rows:
        print(f"{role:<14} {addr:<{w}} {have:>10} {need:>6} {short:>8}")

    if shortfall_total <= 0:
        print(f"\nAll {len(ROLES)} role wallets funded. Safe to run the Mainnet deployment.")
        return 0
    print(f"\nTOTAL XRP TO SEND: {shortfall_total:.2f}")
    print("Fund the addresses above from your own XRP, then re-run this command to confirm.")
    print("Reminder: the first payment to a new XRP account must be at least the 1 XRP base reserve.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
