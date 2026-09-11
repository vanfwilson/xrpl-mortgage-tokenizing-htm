# MortgageOS v3 — XRPL Testnet, MPT note asset + TokenEscrow servicing, Python

Branch `v3`, version 3.1. Replaces the v2 TypeScript servicing engine. No Hooks on XRPL, no WASM, no sidechains in the
core: every on-ledger step is a Mainnet-live XRPL primitive, and every rule that needs judgment runs off-chain in Python
and is mirrored into the `mortgageos` schema of the councilforge PostgreSQL database.

## Two layers, strictly separated

| Layer | On the ledger | Off the ledger |
|---|---|---|
| **Asset** — the note | One MPT issuance per loan: the digital twin of the fixed-rate note, held by the lending institution at face value for the life of the loan | Who the lender is, the loan file, the CID-pinned terms manifest |
| **Servicing** — the payments | TokenEscrow legs for the fixed P&I and the impounds, each validated finish a proof of payment | Outstanding principal, escrow analysis, statements, the borrower |

## What is on the ledger

| Concern | Primitive | Why |
|---|---|---|
| Note asset | `MPTokenIssuanceCreate`, one issuance per loan, `AssetScale=2`, `MaximumAmount = face value in cents`, flags `CanEscrow \| CanTransfer \| CanLock \| RequireAuth`, **no `CanClawback`** | A transferable, escrowable instrument the bank can hold, move between authorized institutions, and later use with XLS-65 / XLS-66 credit primitives. Face value never changes; amortization is a servicing figure. `RequireAuth` keeps holding institutional. Metadata is XLS-89d shaped (`t/n/d/ac/in`) with `ai.kind = mortgage_note`, the fixed terms, the terms-manifest sha256 and an IPFS CID slot. |
| Holder authorization and delivery | `MPTokenAuthorize` (holder, then issuer), `Payment` of MPT units | The lender is authorized and receives the whole issuance. |
| Asset hold | `MPTokenIssuanceSet` `tfMPTLock` / `tfMPTUnlock` on the holder | Issuer can freeze a holding on a title dispute or foreclosure and release it; drilled live. |
| Payment authorization | `AccountSet asfDepositAuth` + `DepositPreauth` on the issuer, the lender and the impound account | The accounts that receive money accept only pre-authorized counterparties. |
| Settlement issuer init | `AccountSet asfAllowTrustLineLocking` (flag 17) on the USDm issuer, before any trust line, verified via `account_info`, mirrored to `issuer_accounts.escrow_enabled` (`python -m mortgageos.init_issuer`) | Makes an issued-currency form of USDm escrowable; the MPT form is escrowable through `tfMPTCanEscrow`. A ledger refusal is logged to `audit_log` and halts the pipeline without a traceback. |
| Fixed P&I and impound legs | `EscrowCreate` of the USDm settlement MPT, `FinishAfter = due date`, `EscrowFinish` by the destination (lender for P&I, impound account for impounds) | Date-locked settlement; the split and regulatory markers ride in the `Memos`; the validated finish is the immutable proof of payment. |
| Settlement asset | Self-issued USDm MPT (`CanTransfer \| CanEscrow \| CanClawback`, `AssetScale=2`) | Testnet RLUSD's issuer does not allow trust-line locking, so it cannot be escrowed; USDm is the only escrowable USD stand-in on Testnet and is labelled as such. |

Not used: `Clawback` on the note (removed in 3.1 — the asset is never burned as the loan amortizes), Hooks on XRPL (kept
as working C in `hooks/`, proven on Xahau), Smart Escrows, NFTokens, XLS-65 / XLS-66 (Devnet only; forward compatibility
is a design property, not a feature of this phase).

## What is off the ledger

- `mortgageos/servicing/amortization.py`: fixed-rate schedule in exact cents; `assert_fixed_rate()` refuses any schedule
  whose P&I is not identical for every period (the final payment may absorb cent rounding only); RESPA 12 CFR 1024.17
  impounds as a rolling 1/12 of the last actual annual bill, servicer advance on shortfall.
- `mortgageos/db/schema.sql`: `loans` (incl. `pi_cents`, `outstanding_cents`, `lender_account`), `issuer_accounts`,
  `mpt_issuances` (`purpose = note_asset | settlement`), `ledger_transactions` (Pending → Confirmed / Failed, full envelope,
  meta, parsed memo), `audit_log`, `payment_schedule` (360 rows), `escrow_legs` (create / finish hashes,
  `proof_ledger_index`, `proof_verified_at`). Migrations are idempotent `ALTER … IF NOT EXISTS`.
- `mortgageos/ledger/client.py`: the single submit path. Signs once, records Pending, submits, records the result; every
  ledger call is wrapped, `tec/tef/tem` codes and timeouts are triaged into `audit_log` and the loop continues.
- `mortgageos/phases.py`: Phase 1 (guards, tokenize, deliver to lender, mirror), Phase 2 (schedule → escrow legs → finish
  on the due date → books amortize → asset-hold drill → audit), Phase 3 (forced `tec` and forced timeout, both logged),
  `audit()` (lender holds face value; every settled leg's finish tx re-read from the ledger, validated, `tesSUCCESS`).

## Run it

```bash
uv venv --python 3.12 /Volumes/BackupPlus/venvs/mortgageos
uv pip install --python /Volumes/BackupPlus/venvs/mortgageos/bin/python -r requirements-py.txt
cp .env.example .env   # set COUNCILFORGE_DSN (writer role), XRPL_WSS stays Testnet
/Volumes/BackupPlus/venvs/mortgageos/bin/python -m mortgageos.verify          # tokenizes a loan, settles one period, audits, exit 0
/Volumes/BackupPlus/venvs/mortgageos/bin/python -m pytest tests/py/test_mpt_core.py -q
```

Both print `ALL COUNCILFORGE MPT VERIFICATION PASSES` only when the live phases and the audit sweep passed.
Wallets are faucet-funded once into `out/wallets.py.testnet.json` (gitignored) and reused.

## Verified feature state (2026-09-11, on-ledger Amendments object)

XRPL Testnet: MPTokensV1, TokenEscrow, Credentials, PermissionedDomains, Clawback, DepositAuth/DepositPreauth enabled;
Hooks, SmartEscrow, DynamicMPT not enabled. XRPL Devnet additionally has SingleAssetVault (XLS-65) and LendingProtocol
(XLS-66). Xahau Testnet has Hooks but no MPT and no TokenEscrow, which is why the Hook firewall from the design notes lives
in `hooks/` as a sidecar rather than in the core.
