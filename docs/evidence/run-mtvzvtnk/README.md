# Evidence pack for loan HTM-d4790bba9e7c

Run `run-mtvzvtnk` on network `testnet`, recorded 2026-09-10T20:58:01.391Z; pack generated 2026-09-10T20:58:22.947Z.
Closing-document bundle SHA-256: `c950d51d745ffb77c94fb17a47a252fb175cf9fd46b7adf40164a699f8079cb0`.

## What is in this folder

- `control-map.csv`: every regulatory (R), settlement-safety (S) and tie-out (T) control with the automated tests that carry its name.
- `settlement-legs.csv`: every ledger transaction in the run with engine result, journal status and explorer link.
- `periods.csv`: the monthly cycles with the exact-cent split of each receipt.
- `escrow-analysis.json`: initial and annual 12 CFR 1024.17 analyses with the elected option.
- `statements.json`: initial and annual escrow statements and the periodic statement, with delivery evidence.
- `tax-forms.json`: Form 1098 boxes per year and the 1099-INT decision.
- `reconciliation.json`: the bank / subledger / ledger three-way match and the hash-chained reconciliation events.
- `event-log.json`: count, head hash and types of the append-only business-event chain.
- `escrows.json`, `transfer.json`, `proofs.json`, `clock-mapping.json`: impound escrows, the servicing-transfer manifest, named proofs, and the business-date to ledger-time mapping.
- `MANIFEST.sha256`: SHA-256 of every file above; re-hash to prove the folder is unaltered.

## Summary

- Ledger transactions: 108; journaled settlement legs: 75 (validated 75, not validated 0).
- Monthly cycles: 12.
- Controls: 52; without a named test: none.
- Three-way match: 75 matched, 0 unmatched; bank-authoritative balance 8448675 cents.
- All v2.0 sections present.

## How to verify

1. Open any hash in `settlement-legs.csv` on the explorer; the memo carries only `{v, loan, period, leg, cents, run}`.
2. Re-run `npm run loan-year:replay` on the same closing documents; the periods and analyses must match this folder cent for cent.
3. Re-hash the files and compare with `MANIFEST.sha256`.
