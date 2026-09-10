# High Tech Mortgage servicing prototype

This Codex branch replaces the former lending-pool demo with residential mortgage servicing. A bank subservicer is the accounting and custody authority; HTM supplies the technology and vendor workflow. The loan has one borrower payment each month.

For the corrected FHA fixture, **12 monthly receipts produce 48 settlement transfers**:

| Monthly allocation | USD |
|---|---:|
| Principal and interest to note holder | 2,770.73 |
| Property-tax impound | 285.00 |
| Hazard-insurance impound | 125.00 |
| FHA MIP payable | 184.28 |
| Total borrower receipt | 3,365.01 |

The $450,000 note uses a $442,260.44 base and $7,739.56 financed UFMIP. P&I remains $2,770.73; the final amortization payoff absorbs cent-rounding drift. The fixture's FHA late-charge cap is $110.83 (4% of P&I), after the 15-day grace period. The PDFs are synthetic test documents, not legally operative loan instruments.

## Run and inspect

Node 20.19 or later and xrpl.js 5.1.0 are required.

```sh
npm ci
npm run ingest
npm test
npm run demo
npm run typecheck
```

`npm run print` regenerates the 23-page fixture package. `npm run scan -- forms/closing-package-stack.pdf` regenerates OCR with the local OCR dependencies.

The live Testnet evidence includes an NFToken document handle, exact issued-USD settlement transfers, three finished TokenEscrows, a cancelled escrow, a servicing-token transfer, and key-configuration transactions. Borrower bank receipts are simulated in the deterministic replay. Escrow finishing requires a submitted transaction; the ledger does not schedule or deliver county/insurer bank payments automatically.

- [Build report, acceptance results and audit dispositions](docs/build-validation-2026-09-09.md)
- [Testnet transaction hashes](docs/testnet-run.md)
- [Timestamp mapping](docs/timestamp-mapping.json)
- [Escrow analysis examples](docs/escrow-analysis-example.md)
- [Form 1098 example](docs/form-1098-example.json)
- [Architecture and R01–R31 map](docs/architecture.md)
- [Verified research with sources](docs/xrpl-servicing-research-audit-design-2026-09-08.md)
- [Deferred amendments](docs/appendix-deferred-amendments.md)

## Boundaries

Test USD is a controlled sandbox token. It is not RLUSD, bank custody or borrower funds. The NFToken carries no ownership or cash-flow rights. Payments are independent, with reconciliation and persisted-transaction retry requirements. A document hash detects changed bytes; it does not prove an authentic note, lien, legal ownership or compliance.

This delivery covers the Phase A–E prototype and its evidence. Production custody, bank connectivity, licensing approval, HSM integration, vendor controls and filing/delivery operations require the bank's implementation and approval. The build report distinguishes tested code from those operational requirements. Phase F security rollout and Phase G grant/glossary/walkthrough rewrite remain outside the requested stop point; those older documents may describe the superseded demo.

Original history remains available in Git. All implementation commits for this work are on `codex-servicing-rebuild`.
