# Retired Python sketches

The build prompt's settled decision S6 permits removal of the Python twin.
On 2026-09-10 the three obsolete sketches were removed: the unpinned XRPL
sender used fictitious XRP/USD scaling and an APN memo; the dashboard read
the retired export schema; the scheduler duplicated superseded calculations.
They remain recoverable in Git history at `a4fc5c9` and earlier.

Use the tested TypeScript implementation in `src/servicing/` and `src/xrpl/`.
Run `npm run demo` for the deterministic replay, `npm test` for controls, and
read [Testnet evidence](../../docs/testnet-run.md). There is no supported
Python transaction sender in this repository.
