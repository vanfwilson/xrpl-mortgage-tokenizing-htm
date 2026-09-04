#!/usr/bin/env python3
"""Impound disbursement transaction builder (xrpl-py). Sends the accumulated impound
balance from the Tax Impound sub-account to the County Treasurer node on Devnet with an
APN memo. Dry-run by default; pass --send to submit.

  pip install xrpl-py
  python xrpl_tax_disbursement.py --seed <TAX_IMPOUND_SEED> --to <TREASURER_ADDRESS> --usd 1710 [--send]

Demo scale matches the TypeScript repo: 1 XRP = US$10,000, so drops = usd * 100.
"""
import argparse, json, logging
from xrpl.clients import JsonRpcClient
from xrpl.wallet import Wallet
from xrpl.models.transactions import Payment, Memo
from xrpl.transaction import autofill_and_sign, submit_and_wait

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("impound-disbursement")
DEVNET = "https://s.devnet.rippletest.net:51234"

def usd_to_drops(usd: float) -> str:
    return str(int(round(usd * 100)))  # 1 XRP = $10,000 -> $1 = 100 drops

def build(seed: str, destination: str, usd: float, apn: str, kind: str = "tax") -> Payment:
    w = Wallet.from_seed(seed)
    memo = Memo(memo_type=f"htm/{kind}-disbursement".encode().hex().upper(),
                memo_data=json.dumps({"apn": apn, "usd": usd}).encode().hex().upper())
    return Payment(account=w.address, destination=destination, amount=usd_to_drops(usd), memos=[memo])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", required=True); ap.add_argument("--to", required=True)
    ap.add_argument("--usd", type=float, required=True); ap.add_argument("--apn", default="R993821-0014")
    ap.add_argument("--kind", default="tax", choices=["tax", "insurance"]); ap.add_argument("--url", default=DEVNET)
    ap.add_argument("--send", action="store_true")
    a = ap.parse_args()
    client = JsonRpcClient(a.url)
    tx = build(a.seed, a.to, a.usd, a.apn, a.kind)
    log.info("payload %s", tx.to_xrpl())
    if not a.send:
        log.info("dry run; add --send to submit"); return
    signed = autofill_and_sign(tx, client, Wallet.from_seed(a.seed))
    res = submit_and_wait(signed, client)
    meta = res.result.get("meta", {})
    log.info("hash %s result %s ledger %s", res.result.get("hash"), meta.get("TransactionResult"), res.result.get("ledger_index"))

if __name__ == "__main__":
    main()
