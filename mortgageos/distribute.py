"""Fan XRP out from the issuer to the other role wallets (Mainnet Option 1).

Rich funds ONE address from cold storage; this spreads it to the remaining roles on-ledger, which
costs about 0.00001 XRP per payment instead of an exchange withdrawal fee each.

Safety posture: DRY RUN BY DEFAULT. It prints exactly what it would send and changes nothing
unless --execute is passed, and it refuses outright if the issuer cannot cover every payment while
keeping its own funding target and base reserve intact. Real money, irreversible, so it would
rather do nothing than a partial job.

    python -m mortgageos.distribute              # dry run
    python -m mortgageos.distribute --execute    # actually send
"""
from __future__ import annotations

import json
import os
import sys

from xrpl.clients import WebsocketClient
from xrpl.models.transactions import Payment
from xrpl.transaction import submit_and_wait
from xrpl.utils import xrp_to_drops
from xrpl.wallet import Wallet

from .config import ROLES, Settings
from .provision import DROPS, FUNDING_PLAN, balance_xrp

BASE_RESERVE_XRP = 1.0
SOURCE = "issuer"


def main(execute: bool) -> int:
    os.environ.setdefault("COUNCILFORGE_DSN", "postgresql://unused/distribution-only")
    settings = Settings.load()
    if not settings.mainnet:
        print("refusing: this tool is for Mainnet Option 1; on test networks use the faucet.")
        return 2
    if not settings.wallets_file.exists():
        print(f"no wallet file at {settings.wallets_file} — run `python -m mortgageos.provision` first.")
        return 2

    seeds = json.loads(settings.wallets_file.read_text())
    wallets = {r: Wallet.from_seed(seeds[r]) for r in ROLES}

    with WebsocketClient(settings.xrpl_wss) as client:
        src_balance = balance_xrp(client, wallets[SOURCE].address) or 0.0

        plan: list[tuple[str, str, float]] = []
        for role in ROLES:
            if role == SOURCE:
                continue
            have = balance_xrp(client, wallets[role].address) or 0.0
            need = max(0.0, FUNDING_PLAN[role] - have)
            if need > 0:
                plan.append((role, wallets[role].address, round(need, 6)))

        if not plan:
            print("every role wallet is already funded — nothing to distribute.")
            return 0

        outgoing = sum(n for _, _, n in plan)
        # The issuer must still hold its own funding target after paying everyone else, and can
        # never drop below the network's base reserve.
        required = outgoing + max(FUNDING_PLAN[SOURCE], BASE_RESERVE_XRP)

        print(f"source   : {SOURCE}  {wallets[SOURCE].address}")
        print(f"balance  : {src_balance:.6f} XRP")
        print(f"{'ROLE':<14} {'ADDRESS':<36} {'SEND':>10}")
        for role, addr, amt in plan:
            print(f"{role:<14} {addr:<36} {amt:>10.6f}")
        print(f"{'':<14} {'total outgoing':<36} {outgoing:>10.6f}")
        print(f"{'':<14} {'issuer must retain':<36} {max(FUNDING_PLAN[SOURCE], BASE_RESERVE_XRP):>10.6f}")
        print(f"{'':<14} {'required balance':<36} {required:>10.6f}")

        if src_balance < required:
            print(f"\nREFUSING: issuer holds {src_balance:.6f} XRP but needs {required:.6f} XRP "
                  f"(short {required - src_balance:.6f}). Nothing sent.")
            return 1

        if not execute:
            print("\nDRY RUN — nothing sent. Re-run with --execute to send.")
            return 0

        print()
        failures = 0
        for role, addr, amt in plan:
            try:
                r = submit_and_wait(
                    Payment(account=wallets[SOURCE].address, destination=addr, amount=xrp_to_drops(amt)),
                    client, wallets[SOURCE],
                )
                code = r.result.get("meta", {}).get("TransactionResult")
                ok = code == "tesSUCCESS"
                failures += 0 if ok else 1
                print(f"{'OK ' if ok else 'FAIL'} {role:<14} {amt:>9.6f} XRP  {code}  {r.result.get('hash')}")
            except Exception as e:
                failures += 1
                print(f"FAIL {role:<14} {amt:>9.6f} XRP  {type(e).__name__}: {e}")

        print()
        if failures:
            print(f"{failures} payment(s) failed. Re-run — funded roles are skipped automatically.")
            return 1
        print("Distribution complete. Verify with: python -m mortgageos.provision")
        return 0


if __name__ == "__main__":
    sys.exit(main(execute="--execute" in sys.argv))
