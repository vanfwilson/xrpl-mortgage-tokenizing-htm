# What happens to a scanned closing package, step by step

One command does everything: `npm run tokenize -- <your-scan.pdf>`. This page shows each stage, the file it produces,
and what a reviewer can check. Times are for the 23-page test package on a laptop; the ledger steps run on the
XRP Ledger's **Devnet** (a public test network with play money; see [GLOSSARY.md](GLOSSARY.md)).

| Stage | What happens | Input → output | Where to look |
|---|---|---|---|
| **0. Paper** | The title/escrow company delivers the closing package. For testing we print our own: `npm run print`. | fixtures in `data/documents/` and `data/supporting/` → `out/print/closing-package-stack.pdf` (23 pages, every signature line signed in blue ink) | [package/closing-package-stack.pdf](package/closing-package-stack.pdf) |
| **1. Scan** | You print the stack and scan it back on any office scanner to one PDF (300 dpi is plenty). | paper → `my-scan.pdf` | your scanner |
| **2. OCR** | Each page is rendered to an image and read by `tesseract`. Confidence is recorded per page. | `my-scan.pdf` → `out/tokenize/my-scan.ocr.txt` | `src/scan/ocr.ts` |
| **3. Classify pages** | Each page is recognised by its own wording: Closing Disclosure, Note, Deed of Trust, Warranty Deed, URLA, settlement statement, escrow instructions, FHA clause, recorder receipt, statement. Nothing is assumed from page order. | text → page kinds (printed to the console) | `src/ingest/from-scan.ts` → `classifyPage` |
| **4. Rebuild the loan from the paper** | Loan number, amounts, rate, term, dates, P&I, tax and insurance figures, borrower, seller, lender, trustee, APN, legal description, both recording numbers. Each field records which document supplied it. **No database lookup.** | text → `out/tokenize/my-scan.canonical.json` (with `_provenance`) | `src/ingest/from-scan.ts` → `buildCanonicalFromScan` |
| **5. Tie-out (fail closed)** | P&I must match rate and term; base loan + financed UFMIP must equal the note; closing costs and cash to close must balance; the three servicing buckets must sum to the monthly payment; late charge must match the Note. If anything is missing or disagrees, the run **stops with exit code 2** and names the field. Nothing reaches the ledger. | canonical → pass / STOP | `src/ingest/canonical.ts` → `validateCanonical` |
| **6. Fingerprint the paper** | The sha256 of the scan file itself becomes part of the token's metadata, so this token is bound to this exact paper. | `my-scan.pdf` → 64-character hash | console line "scan sha256 …" |
| **7. Eligibility** | A KYC account attests the two investors; the lending desk gathers those attestations into a permissioned domain. | → DomainID | `src/steps/01-credentials.ts` |
| **8. Tokenize the note** | The note is issued as **one token** using the ledger's MPT standard (XLS-33): 45,000,000 units = $450,000.00 of principal, allow-listed holders only, issuer can freeze and claw back, metadata (XLS-89) carries the paper's fingerprint. Participations are distributed 60/40 to the two investors. | → MPT issuance ID | `src/steps/02-mpt.ts` |
| **9. Fund it** | A private Single Asset Vault (XLS-65) accepts deposits from the attested investors. | → VaultID | `src/steps/03-vault.ts` |
| **10. Originate the facility** | The lending desk registers a LoanBroker, posts first-loss capital, and originates a 360-payment loan (XLS-66) to HTM Loan Servicing, co-signed by both parties. | → LoanBrokerID, LoanID | `src/steps/04-lending.ts` |
| **11. Service (optional, `--service`)** | Each month the homeowner's payment arrives and is split three ways: P&I repays the loan (`LoanPay`), the tax portion goes to the Tax Impound account, the insurance portion to the Insurance Impound account; the impounds are time-locked to the county treasurer and the carrier. | → payment transactions, impound escrows | `src/steps/05-servicing.ts`, `src/servicing/` |
| **12. Report** | Every transaction hash with an explorer link, every ledger object ID, and the notes. | → `out/latest.md`, `out/run-<time>.json` | [docs/devnet-run.md](docs/devnet-run.md) |

## What "tokenize the mortgage" means here, precisely

- The **legal** mortgage stays exactly where it is: the signed Note, the recorded Deed of Trust, the county record.
- The **token** (`HTMN1`) is a ledger record that says "here is a participation in the cash flows of the note whose paper has fingerprint X", with the issuer's controls attached. It does not replace the note or the lien.
- The **vault and loan** (XLS-65, XLS-66) are how that tokenized note is funded and repaid on the same ledger. They are the "send it through 65/66" part of the brief.

## Where the database fits

The Postgres schema in `db/` (`htm_mortgages`) is the servicer's system of record for documents, parties, the 360-row
payment schedule and the impound calendar. `npm run db:seed` fills it from the fixtures; `npm run db:record` mirrors
each Devnet run's object IDs and transaction hashes into it for reconciliation. The tokenizer itself never reads the
database, so a reviewer can verify the paper-to-ledger path without it.
