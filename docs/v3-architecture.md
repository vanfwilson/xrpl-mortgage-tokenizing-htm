# MortgageOS v3 — XRPL Testnet, MPT + TokenEscrow, Python

Branch `v3`. Replaces the v2 TypeScript servicing engine. No Hooks, no WASM, no sidechains: every on-ledger step is a
Mainnet-defensible XRPL primitive, and every rule that needs judgment runs off-chain in Python and is mirrored into the
`mortgageos` schema of the councilforge PostgreSQL database.

## What is on the ledger

| Concern | Primitive | Why |
|---|---|---|
| Loan record | `MPTokenIssuanceCreate`, one issuance per loan, `AssetScale=2`, `MaximumAmount = principal in cents`, flags `CanLock \| RequireAuth \| CanEscrow \| CanClawback`, **no `CanTransfer`** | A *record of account*, not the note. Without `CanTransfer` the holder can only move units back to the issuer, so it can never trade. Metadata is XLS-89d shaped (`t/n/d/ac/in`) with `ai.kind = record_of_account`, the manifest sha256 and an IPFS CID slot. |
| Outstanding principal | Servicer's MPToken balance; each period's principal is `Clawback`-ed by the issuer | On-chain balance == `loans.outstanding_cents`; the reconciliation sweep proves it. Reversal = issuer re-sends units; payoff = clawback to zero then destroy; servicing transfer = new holder authorizes, clawback, re-send. |
| Payment authorization | `AccountSet asfDepositAuth` + `DepositPreauth` on the issuer **and** both custodial accounts (P&I, impound) | The borrower never pays the issuer, so the guard has to sit on the accounts that receive money. |
| Monthly P&I and impound legs | `EscrowCreate` of the USDm settlement MPT, `FinishAfter = due date`, `EscrowFinish` by the destination | Date-locked settlement with the P&I / tax / insurance split and regulatory markers in the `Memos` field. |
| Late-payment control | `MPTokenIssuanceSet` `tfMPTLock` / `tfMPTUnlock` on the holder | Freezes the record while a period is unsettled. |
| Issuer initialization | `AccountSet asfAllowTrustLineLocking` (flag 17) on the USDm issuer, set before any trust line or allocation, verified via `account_info`, mirrored to `issuer_accounts.escrow_enabled` with the tx hash (`python -m mortgageos.init_issuer`) | Makes an issued-currency form of USDm escrowable; the MPT form is escrowable through `tfMPTCanEscrow` regardless. A ledger refusal (e.g. `tefPAST_SEQ`) is logged to `audit_log` and halts the pipeline without a traceback. |
| Settlement asset | Self-issued USDm MPT (`CanTransfer \| CanEscrow \| CanClawback`, `AssetScale=2`) | Testnet RLUSD's issuer does not allow trust-line locking, so it cannot be escrowed; USDm is the only escrowable USD stand-in on Testnet and is labelled as such. |

## What is off the ledger

- `mortgageos/servicing/amortization.py`: fixed-rate schedule in exact cents; RESPA 12 CFR 1024.17 impounds as a rolling
  1/12 of the last actual annual bill, servicer advance on shortfall.
- `mortgageos/db/schema.sql`: `loans`, `mpt_issuances`, `ledger_transactions` (Pending → Confirmed / Failed, full
  envelope + meta + parsed memo), `audit_log` (every failed broadcast with raw code + envelope), `payment_schedule`,
  `escrow_legs`.
- `mortgageos/ledger/client.py`: the single submit path. Signs once, records Pending, submits, records the result;
  every ledger call is wrapped, `tec/tef/tem` codes and timeouts are triaged into `audit_log` and the loop continues.
- `mortgageos/phases.py`: Phase 1 (guards + issuance + mirror), Phase 2 (schedule → escrow → finish → clawback → lock
  cycle → reconcile), Phase 3 (forced `tec` and forced timeout, both logged), `reconcile()` sweep.

## Run it

```bash
uv venv --python 3.12 /Volumes/BackupPlus/venvs/mortgageos
uv pip install --python /Volumes/BackupPlus/venvs/mortgageos/bin/python -r requirements-py.txt
cp .env.example .env   # set COUNCILFORGE_DSN (writer role), XRPL_WSS stays Testnet
/Volumes/BackupPlus/venvs/mortgageos/bin/python -m mortgageos.verify          # boards a loan, settles one period, exit 0
/Volumes/BackupPlus/venvs/mortgageos/bin/python -m pytest tests/py/test_mpt_core.py -q
```

Both print `ALL COUNCILFORGE MPT VERIFICATION PASSES` only when the live phases and the reconciliation sweep passed.
Wallets are faucet-funded once into `out/wallets.py.testnet.json` (gitignored) and reused.

## Verified feature state (2026-09-11, on-ledger Amendments object)

XRPL Testnet: MPTokensV1, TokenEscrow, Credentials, PermissionedDomains, Clawback, DepositAuth/DepositPreauth enabled;
Hooks, SmartEscrow, DynamicMPT not enabled. Xahau Testnet has Hooks but no MPT and no TokenEscrow, which is why the
Hook firewall from the v3 notes was replaced by DepositAuth/Preauth plus off-chain enforcement.
