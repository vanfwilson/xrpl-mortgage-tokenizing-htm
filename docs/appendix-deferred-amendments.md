# Appendix: deferred amendments and rejected routes

Checked 2026-09-08 against the live `feature` RPC on Mainnet (rippled 3.3.0), Testnet and Devnet, and against the published XLS texts.

| Route / amendment | Status | Why not used for servicing | What would change the decision |
|---|---|---|---|
| XLS-65 Single Asset Vault | Devnet only; ~37 % validator support | A vault is a funding pool. An already-funded loan has no depositors; HTM does not raise capital. | Mainnet activation **and** a business reason to pool capital |
| XLS-66 Lending Protocol | Devnet only; ~31 % support | `LoanSet` always draws principal from a vault and pays the borrower on-ledger; it cannot represent a loan funded off-ledger. Its 60-second-interval arithmetic is correct but unrelated to the consumer note. | Mainnet activation plus an "import existing loan" transaction, which the spec does not define |
| DynamicMPT (XLS-94) | Devnet only; ~26 % support | Would allow mutable loan-record metadata; without it an MPT record is immutable. NFToken with an off-ledger pointer covers the need. | Activation; then an MPT record could carry current balance on-ledger |
| Batch / BatchV1_1 | Not on Mainnet (original Batch withdrawn after a critical bug) | Monthly legs would be atomic. Until then they are independent with one idempotency key and a compensating workflow. | Activation; then wrap the four legs in one Batch |
| Smart Escrows (XLS-100) | In development; special WASM Devnet only | Programmable finish conditions. No production tooling or audit. Native `FinishAfter` already gives the one guarantee servicing needs. | Mainnet activation, audited tooling, and a control native escrow cannot express |
| XRPL EVM sidechain + Axelar | Live, separate network | Bridged, non-atomic path for impound money; more keys, relayers and reconciliation; not an XRPL Mainnet proof for the grant. | A bank counterparty that requires Solidity contracts |
| Hooks / Xahau | Different ledger | Not XRPL Mainnet. | n/a |

Kept from the previous design: XLS-33 MPT knowledge is retained in `src/domain/metadata.ts` for the day a mutable on-ledger record becomes possible; XLS-70/80 credential gating is not needed when the only depositor is the servicer's own bank.
