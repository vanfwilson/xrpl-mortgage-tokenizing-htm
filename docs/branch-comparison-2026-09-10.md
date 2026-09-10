# Branch comparison: `claude/servicing-rebuild` vs `codex-servicing-rebuild`

Date: 2026-09-10. Both branches start from Phase A (`3bac61c`). Reviewer: Claude Fable 5.1. Purpose: pick the strongest parts of each for the v2.0 codebase.

## Headline

| Dimension | claude/servicing-rebuild (7 commits) | codex-servicing-rebuild (2 commits, paused) |
|---|---|---|
| Offline tests | 82 in 17 files, all pass | 112 in 15 files pass; 1 file needs `@electric-sql/pglite` (in its devDependencies) |
| Testnet proof | One coupled loan-year run: 105 transactions, borrower receipt leg on-ledger, bills escrowed on mapped statutory dates after the engine's advance-first gate, early-finish refused, cancel path, NFToken hand-off, master-key drill | 81-hash flat run (servicer pre-funded, 48 outgoing legs, three escrows with the same near-term `FinishAfter`, payees were internal wallets) plus 5 supplemental proofs: two-of-three multisig recovery, +$250 bill adjustment, persisted-journal idempotency across a database restart |
| End-to-end orchestration | `src/loan-year.ts`: engine → subledger → ledger, business-clock replay and Testnet track share one code path; year-end analysis feeds year two; 1098 from receipt-dated legs | `replay.ts` + `year-ledger.ts` are pure simulations; the Testnet CLI is a separate script not driven by the engine |
| Settlement idempotency | In-memory map per run (S11) | Persisted `settlement_jobs` with the signed blob; `settleOnce` re-uses the blob after an ambiguous result and never re-signs; proven across a PGlite reopen |
| Escrow analysis | Aggregate method, cushion caps, exact (f)(2)–(f)(4) options, CA interest; monthly deposit `round(annual/12)` | Same rules; monthly deposit `ceil(annual/12)` with a final-month rounding adjustment so the year conserves exactly; `resolveAnalysis` produces cent-conserving installments; delinquent borrower → `loan_document_review` |
| Escrow statements | Deadline clocks + minimal PDF | Full initial/annual content: account activity history tie-out, prior-projection evidence id, difference explanation required, delivery evidence with e-consent |
| Case workflows | Deadline clocks (NOE/RFI, force-placed, early intervention, loss mitigation) | Evidence-bearing state machines with exception routing to specialist review, appeal handling, independent-reviewer check, overdue tasks |
| Servicing transfer | Notice clocks, misdirected-payment grace, NFToken hand-off | Same plus a hashed nine-record transfer manifest, cutover acceptance, late-fee/adverse-reporting suppression for protected receipts |
| Calendar | Federal holidays computed, Idaho and California tax tables, escrow-interest rule table with the Idaho UNVERIFIED gate | Idaho dates only; holidays injected by the bank; Idaho gate throws unless counsel flag |
| Ledger adapter | Live client helpers (faucet, wait-for-ledger-time with the 10-second close-time margin, expected-failure submits), issuer preflight at escrow build | Pure transaction builders (easier to unit-test); issuer preflight also validates the issuer identity; repairs issuer-side NoRipple flags (found `tecPATH_DRY` the hard way) |
| Database | `003_servicing_engine.sql`; tests do not touch SQL | `003_servicing_architecture.sql`, `004_servicing_event_log.sql` with append-only triggers; PGlite-executed migration tests; Postgres event store with hash chain |
| Documentation | README, glossary, walkthrough, standards mapping, grant narrative rewritten to the servicing story; demo page | `standards-mapping.md` still describes XLS-65/66; README partially updated; strong validation and checkpoint reports that state limits candidly |
| Self-assessment | `rebuild-status-2026-09-08.md`: T1–T12, R01–R31, findings mapped | `build-validation-2026-09-09.md`, `checkpoint-2026-09-10.md`: explicit partials and unverified items |

## Defects found in each

**Claude branch**
- Settlement idempotency is not durable; a crash between sign and validate can double-pay on retry.
- Statement content is thin; delivery evidence is not modelled.
- Case modules stop at deadlines; no evidence, no exceptions, no appeals.
- Monthly escrow deposit rounding can leave the annual total short by up to 6 cents.
- `docs/demo/run.json` live view mixes runs when wallets are reused.

**Codex branch**
- The Testnet year is not driven by the engine: escrows are created before the "monthly" legs, all with `FinishAfter = now + 25 s`, and paid to internal wallets rather than payee roles, so it does not prove the advance-first rule or statutory-date locks.
- No borrower receipt on the ledger; the servicer is pre-funded.
- Idaho calendar throws in test unless a counsel flag is set, so the Idaho fixture cannot run a realistic year without a bypass.
- `standards-mapping.md` and parts of the README still carry the vault/lending story.
- Canonical schema still labelled `/2` with a renamed MIP field; the OCR fixture diverged.
- Single-run guard on the Testnet CLI blocks re-runs by design.

## Decision for v2.0

Base: `claude/servicing-rebuild` (working coupled orchestrator and published proof). Adopt from Codex, adapted to the base's types:

1. Persisted settlement journal (`settleOnce`, `SettlementStore`, `XrplSettlementTransport`) with the PGlite-backed store and restart test; wire it into `loan-year.ts` so every leg is journaled before submission.
2. Analysis refinements: `ceil(annual/12)` with final-month adjustment; `resolveAnalysis` installments; `loan_document_review` for delinquent borrowers.
3. Escrow statements with activity history, difference explanation and delivery evidence; periodic statement with counseling contact.
4. Evidence-bearing NOE/RFI, force-placed and loss-mitigation state machines; early-intervention repeat-contact tracking.
5. Transfer package manifest and protected-receipt rules.
6. Issuer identity check and NoRipple repair in the issuer preflight; two-of-three multisig recovery in the key drill.
7. Postgres event store + `004` migration with append-only triggers; PGlite migration tests.

Kept from the base: calendar, boarding, apply, disburse, loan-year orchestrator, ledger client, docs, demo, Testnet proof.
