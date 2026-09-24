"""MortgageOS v4: XRPL MPT + TokenEscrow servicing engine, Python/xrpl-py.

Runs on Testnet by default. Mainnet is reachable only behind the deliberate MOS_ALLOW_MAINNET
opt-in in config.py, because it spends real XRP and cannot be undone.
"""

SUCCESS_STRING = "ALL COUNCILFORGE MPT VERIFICATION PASSES"
