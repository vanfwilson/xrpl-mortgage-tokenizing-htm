# Changelog

## 3.1.0 — 2026-09-11

The MPT is repositioned from a non-transferable "record of account" to the **note asset**: the digital twin of the
fixed-rate mortgage note, held by the lending institution at face value, transferable between authorized institutions,
escrowable and lockable, never clawback-able. Servicing is a strict 30-year fixed P&I stream through TokenEscrow; each
validated finish is the on-chain proof of payment.

### Changed
- Note-asset flags `CanEscrow | CanTransfer | CanLock | RequireAuth`; `CanClawback` removed. Metadata `ai.kind =
  mortgage_note` with the fixed terms (`principal_cents`, `rate_bps`, `term_months`, `pi_cents`).
- Roles: `servicer` → `lender` (asset holder and P&I recipient). DepositAuth/Preauth on issuer, lender, impound.
- `assert_fixed_rate()` in the schedule builder: identical P&I every period (final payment absorbs cent rounding only);
  the full 360-row schedule is written to `payment_schedule`.
- `reconcile()` → `audit()`: lender holds the note at face value, and every settled leg's finish transaction is re-read
  from the ledger and stamped with `proof_ledger_index` / `proof_verified_at`.
- Schema migration (idempotent): `mpt_issuances.purpose` accepts `note_asset`; `loans.lender_account`, `loans.pi_cents`;
  `escrow_legs.proof_ledger_index`, `escrow_legs.proof_verified_at`.
- README, v3 architecture, proposal and deck: tokenomics and institutional liquidity section; XLS-65 / XLS-66 stated as
  forward compatibility only (enabled on Devnet, not Testnet or Mainnet, verified 2026-09-11); counsel items for the
  note asset (UCC 3/9, eNote / ESIGN / UETA / MERS, securities) listed as open.

### Removed
- Clawback-based amortization (`tx.clawback`, the monthly principal burn, on-chain outstanding balance). Outstanding
  principal is a servicing figure in the books only. There was no variable-rate or ARM code to remove; v3 was fixed-rate
  from the start.

## 3.0.0 — 2026-09-11

Rewrite of the ledger and settlement core in Python (`xrpl-py` 5.x) on XRPL Multi-Purpose Tokens and TokenEscrow,
mirrored into the `mortgageos` schema of the councilforge PostgreSQL database. The v2 TypeScript engine is removed from
this branch and archived on `main`.

### Added
- `mortgageos/`: one non-transferable record-of-account MPT per loan (`CanLock | RequireAuth | CanEscrow | CanClawback`,
  no `CanTransfer`, XLS-89d metadata with manifest hash and CID slot); DepositAuth + DepositPreauth on the issuer and both
  custodial accounts; P&I and impound legs as TokenEscrow of a self-issued settlement MPT with the split and regulatory
  markers in the memo; monthly amortization by issuer `Clawback` so the on-ledger balance equals `loans.outstanding_cents`;
  lock / unlock for the unsettled-period path; reconciliation sweep.
- `mortgageos/db/schema.sql`: `loans`, `mpt_issuances`, `ledger_transactions` (Pending → Confirmed / Failed with envelope,
  meta and parsed memo), `audit_log`, `payment_schedule`, `escrow_legs`.
- One wrapped submit path (`ledger/client.py`): every ledger error code and timeout is triaged into `audit_log` and the
  loop continues; a forced `tec` and a forced timeout are part of the live suite.
- `tests/py/test_mpt_core.py`: offline amortization checks plus the live Testnet phases; prints
  `ALL COUNCILFORGE MPT VERIFICATION PASSES` only after the reconciliation test passes. Independent evaluator: 12/12.
- `docs/v3-architecture.md`, `docs/grant-proposal-2026-09-11.md` / `.pdf`, `docs/grant-deck-2026-09-11.pptx`.
- `mortgageos/ledger/issuer.py` + `python -m mortgageos.init_issuer`: `asfAllowTrustLineLocking` (flag 17) on the USDm
  issuer before any allocation, read back via `account_info`, mirrored to `issuer_accounts.escrow_enabled`.
- `hooks/`: the payment-firewall Hook from the design notes as working C, compiled to WASM and proven on Xahau Testnet
  (sidecar, not part of the demo); `portainer/hooks-builder/`: server-side pipeline that compiles, deploys and re-proves
  it on every push to `v3`, publishing `status.json` / `xahau-proof.json` per commit.

### Removed
- `src/`, the TypeScript tests and toolchain, the Devnet/Testnet npm workflows. OCR ingest, statements, aggregate escrow
  analysis with cushion, case workflows, servicing transfer and Form 1098 are not in v3.0; they remain on `main` and are
  the porting roadmap.

### Verified
- XRPL Testnet Amendments object, 2026-09-11: MPTokensV1, TokenEscrow, Clawback, DepositAuth, DepositPreauth, Credentials,
  PermissionedDomains enabled; Hooks, SmartEscrow, DynamicMPT not enabled. Xahau Testnet has Hooks but neither MPT nor
  TokenEscrow, which is why the Hook-based payment firewall from the v3 design notes was not built.

## 2.0.0 — 2026-09-10

Servicing-only architecture on Mainnet-live XRPL primitives, merged from two independent builds
(`claude/servicing-rebuild` and `codex-servicing-rebuild`; see docs/branch-comparison-2026-09-10.md).

### Added
- Persisted settlement journal: every ledger leg is signed once, stored with its fingerprint and hash, and re-used after an
  ambiguous result; a second call after a database restart neither signs nor submits (`src/xrpl/settlement-journal.ts`,
  `src/db/settlement-store.ts`, `db/005_settlement_journal.sql`).
- Durable business-event log with a hash chain and append-only triggers (`src/servicing/event-log.ts`,
  `src/db/event-store.ts`, `db/006_servicing_event_log.sql`).
- Escrow analysis: `ceil(annual/12)` deposits with a final-month adjustment so the year conserves exactly;
  cent-conserving recovery installments; loan-document review path for delinquent borrowers.
- Initial and annual escrow statements with full 12 CFR 1024.17(g)/(h)/(i) content, activity tie-out, difference
  explanation and delivery evidence (`src/servicing/escrow-statements.ts`).
- Evidence-bearing notice-of-error, information-request, force-placed-insurance and loss-mitigation state machines with
  exception routing, appeals and overdue tasks (`src/servicing/cases.ts`, `src/servicing/loss-mitigation.ts`).
- Servicing-transfer package manifest (nine hashed record kinds) and protected-receipt rules (`src/servicing/transfer.ts`).
- Issuer preflight now binds the locking flag to the validated issuer account and repairs issuer-side NoRipple lines;
  two-of-three multisig recovery drill alongside the regular-key drill (`src/xrpl/issuer.ts`, `src/xrpl/keys.ts`).
- PGlite-backed tests for migrations, the journal restart path and the event chain.
- Roast RESHAPE items (docs/roast-v2-2026-09-10.md): bank receipt-file contract and parser feeding the three-way match
  (`src/servicing/bank-receipts.ts`, T13); examiner evidence pack `npm run evidence` with control map, settlement legs,
  statements, reconciliation, event-chain head and SHA-256 manifest (`src/cli/evidence-pack.ts`); per-loan-year ledger
  cost model and scale note (`src/servicing/cost-model.ts`, docs/cost-model.md, T14); degraded-mode contract
  (architecture §7b); README "What v2.0 is and is not" and "Open business items".

### Changed
- Grant package: `docs/grant-proposal-2026-09-10.md` (+PDF) supersedes the August 2026 proposal with servicing-only
  milestones, budget and targets; 14-slide reviewer deck `docs/grant-deck-2026-09-10.pptx` from `scripts/build-grant-deck.py`;
  demo page reads Testnet over WebSocket; docs describe HTM's two operating models (servicer of record or bank's contractor).
- Multisig recovery drill: the below-quorum attempt is submitted for its preliminary engine result only and the
  two-signer proof is autofilled fresh, so the refused attempt no longer consumes the ledger window (`tefMAX_LEDGER`
  observed on Testnet 2026-09-10).
- Testnet escrow pacing: the ledger-track `CancelAfter` window is at least 240 s (a six-leg period takes about 100 s of
  Testnet time) and escrow finishes run before the period's payment legs, so a finish can no longer land past
  `CancelAfter` (`tecNO_PERMISSION` observed 2026-09-10).
- Setup and drill submits (`submit` in `src/xrpl/client.ts`) re-prepare once the ledger window has provably closed
  (`tefMAX_LEDGER` on Testnet congestion); settlement legs are unaffected and still go through the journal only.
- Journal restart proof keeps the reopened PGlite store live for the key-drill events and the final chain read.
- Wallet loader detects `lsfDisableMaster` on a reused Testnet wallet (left by an earlier key drill) and funds a fresh
  wallet for that role instead of failing with `tefMASTER_DISABLED`.
- Fixture re-based so the FHA note stays $450,000.00: base $442,260.44 + UFMIP $7,739.56; MIP $184.28 separated from
  hazard; late charge 4 % ($110.83); monthly payment $3,365.01.
- Canonical schema `htm.canonical-loan/3` with `credit_purpose` and R19/R20/R21 validation.
- Loan-year orchestrator drives the engine, subledger and ledger from one code path; Testnet track maps statutory dates
  and publishes a clock manifest.

### Removed
- XLS-65 vault, XLS-66 lending, MPT participation token, credentials/permissioned domains, Python extras, XRP scaling.

## 0.1.0 — 2026-09-04

Initial Devnet prototype (funding-pool architecture). Superseded.
