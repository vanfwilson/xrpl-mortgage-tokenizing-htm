# Changelog

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
