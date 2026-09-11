> **Archived v2 walkthrough.** The v3 Python engine is documented in [docs/v3-architecture.md](docs/v3-architecture.md) and the README.

# What happens to a scanned closing package, step by step

Two commands do everything: `npm run tokenize -- <your-scan.pdf>` boards the loan from the paper; `npm run loan-year`
services it for a year. This page shows each stage, the file it produces, and what a reviewer can check. Ledger steps run
on the XRP Ledger's **Testnet** (play money; only features that are live on Mainnet; see [GLOSSARY.md](GLOSSARY.md)).

| Stage | What happens | Input → output | Where to look |
|---|---|---|---|
| **0. Paper** | The title/escrow company delivers the closing package. For testing we print our own: `npm run print`. | fixtures in `data/` → `forms/closing-package-stack.pdf` (23 pages, every signature line signed in blue ink) | [forms/](forms/) |
| **1. Scan** | Print the stack and scan it back on any office scanner to one PDF (300 dpi is plenty). | paper → `my-scan.pdf` | your scanner |
| **2. OCR** | Each page is rendered to an image and read by `tesseract`. Confidence is recorded per page. | `my-scan.pdf` → `out/tokenize/my-scan.ocr.txt` | `src/scan/ocr.ts` |
| **3. Classify pages** | Each page is recognised by its own wording (Closing Disclosure, FHA note, deed of trust, deed, URLA, statement…). Nothing is assumed from page order. | text → page kinds | `src/ingest/from-scan.ts` |
| **4. Rebuild the loan from the paper** | Loan number, amounts, rate, term, dates, P&I, tax, hazard and MIP figures, borrower, seller, lender, trustee, APN, legal description, recording numbers. Each field records which document supplied it. **No database lookup.** | text → `out/tokenize/my-scan.canonical.json` | `src/ingest/from-scan.ts` |
| **5. Tie-out (fail closed)** | P&I must match rate and term; base + UFMIP (1.75 % of base) must equal the note; closing costs and cash to close must balance; the four legs must sum to the payment; the late charge must match the note and stay within the FHA 4 % cap; LTV and MIP must be computed on the base loan. Any disagreement stops the run with exit code 2. | canonical → pass / STOP | `src/ingest/canonical.ts` |
| **6. Fingerprint the paper** | The SHA-256 of the scan itself becomes the hash in the loan-record token. | `my-scan.pdf` → 64-character hash | `out/tokenize/my-scan.bundle.json` |
| **7. Board** | Licence and HUD-approval check for the servicer of record; the initial escrow deposit enters the tax and hazard subledgers pro-rata; the initial escrow analysis and statement clock (45 days) start. | canonical → terms, opening postings | `src/servicing/boarding.ts` |
| **8. Loan-record token** | One NFToken minted by the servicer with the hash, an opaque loan id and a pointer. Nothing else. | → NFTokenID | `src/xrpl/record.ts` |
| **9. Twelve monthly cycles** | Payment credited as of receipt; four exact-cent legs on the ledger (P&I to the note holder, tax, hazard, MIP → HUD); subledger and bank mirror updated. | → four `Payment` hashes per month | `src/servicing/apply.ts`, `src/xrpl/settle.ts` |
| **10. Bills** | Each verified county or carrier bill is escrowed on the ledger only when fully funded; a shortfall is advanced first. The escrow cannot be finished before its date (the run proves an early attempt fails) and is finished when the date passes. A corrected-bill path is shown by cancelling an adjustment escrow after `CancelAfter`. | → `EscrowCreate` / `EscrowFinish` / `EscrowCancel` | `src/servicing/disburse.ts`, `src/xrpl/escrow.ts` |
| **11. Year end** | Aggregate escrow analysis, annual statement (due within 30 days), Form 1098 for each calendar year touched, California profile illustration (2 % interest, 1099-INT). | → `docs/escrow-analysis-example.md`, `docs/form-1098-example.json`, PDFs in `out/statements/` | `src/servicing/analysis.ts`, `tax.ts` |
| **12. Transfer and reconcile** | Servicing-transfer notice clocks; the loan-record token moves to the successor by a zero-price offer; every leg is matched across bank, subledger and ledger and the result is hash-chained. Optional key drill proves the master key can be disabled after a regular key signs. | → `docs/testnet-run.md`, `out/loan-year/run-*.json` | `src/servicing/transfer.ts`, `reconcile.ts`, `src/xrpl/keys.ts` |

## Two clocks

Public networks cannot advance time, so the auditable proof has two tracks. **Track 1** replays the whole loan year on an
injected business clock with no network (`npm run loan-year:replay`): every regulatory deadline and every cent is checked
there. **Track 2** runs the same code on Testnet with statutory dates mapped to near-future ledger timestamps; the mapping is
published with every run in `docs/clock-mapping-manifest.json` so a reviewer can check that each `FinishAfter` is the mapped
statutory date. A compressed Devnet run exists for CI only.

## Where the database fits

The Postgres schema in `db/` (`htm_mortgages`) is the servicer's subledger and decision record: documents, the 360-row
schedule, integer-cent postings, verified bills and escrow decisions, analyses, statements, tax forms, cases and the
hash-chained reconciliation events. The bank's custodial accounts remain the legal cash; the ledger is the reconcilable
evidence. `npm run db:seed` fills the schema from the fixtures.
