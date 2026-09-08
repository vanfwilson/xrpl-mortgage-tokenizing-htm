# forms/

**Filled, signed closing package** for the fictitious homeowner Jordan A. Sandbox, 123 Sandbox Lane, Meridian, ID.
Every document carries the same loan (MORT-2026-88492X, $450,000 FHA note = $442,260.44 base + $7,739.56 UFMIP, 6.250 %, 360 months, 4 % late charge) and every signature line is
signed in blue ink with the signer's name in a handwriting font, one consistent hand per person (see `assets/signatures/signature-sheet.pdf`; fonts are SIL Open Font License, `assets/fonts/`). These are what you print and scan. Regenerate with `npm run print`.

| File | Document | Pages | Blank it was filled from |
|---|---|---|---|
| `01-urla-1003-borrower-information.pdf` | Uniform Residential Loan Application, Fannie Mae Form 1003 (09/2020), Borrower Information | 9 | `blank/01-urla-1003-borrower-information-blank.pdf` (official AcroForm) |
| `02-urla-1003-lender-loan-information.pdf` | Form 1003 Lender Loan Information | 2 | `blank/02-urla-1003-lender-loan-information-blank.pdf` (official AcroForm) |
| `03-closing-disclosure.pdf` | CFPB Closing Disclosure (H-25) | 2 | `blank/03-closing-disclosure-blank.pdf` (official CFPB, overlaid) |
| `04-alta-settlement-statement.pdf` | ALTA Settlement Statement, Borrower/Buyer | 2 | `blank/04-alta-settlement-statement-blank.pdf` (official ALTA, overlaid) |
| `05-escrow-holding-instructions.pdf` | Escrow holding instructions (title company) | 1 | `blank/05-escrow-holding-instructions-blank.pdf` |
| `06-fha-amendatory-clause.pdf` | FHA Amendatory Clause & Real Estate Certification | 1 | `blank/06-fha-amendatory-clause-blank.pdf` |
| `07-fha-model-note.pdf` | FHA Fixed Rate Note, Idaho (HUD model note language) | 1 | `blank/07-fha-model-note-blank.pdf` (typeset template; HUD model note source in docs/forms-and-sources.md) |
| `08-fha-deed-of-trust-idaho.pdf` | FHA Idaho Deed of Trust (HUD model security instrument on the uniform-instrument base) | 1 | `blank/08-fha-deed-of-trust-idaho-blank.pdf` (typeset template); uniform-instrument masters kept in `blank/reference/` |
| `09-warranty-deed-recorded.pdf` | Warranty Deed, county-recorded copy | 1 | `blank/09-warranty-deed-blank.pdf` |
| `10-county-recorder-certification.pdf` | Ada County Recorder receipt and certification | 1 | `blank/10-county-recorder-certification-blank.pdf` |
| `11-servicing-statement-period-1.pdf` | Monthly mortgage statement, period 1 | 1 | `blank/11-servicing-statement-blank.pdf` |
| `12-ocr-stress-test-page.pdf` | OCR stress-test sheet | 1 | `blank/12-ocr-stress-test-page-blank.pdf` |
| `closing-package-stack.pdf` | all of the above merged | 23 | |

The tokenizer needs only 03, 07, 08 and 09. The rest are in the stack so the scanner is tested on a realistic bundle.

## blank/

One blank per filled form, same number prefix. Official blanks (URLA, CFPB Closing Disclosure, ALTA statement) plus typeset blank templates for the FHA note, the FHA deed of trust and the title-company and county documents. `blank/reference/` keeps the Fannie Mae/Freddie Mac uniform-instrument masters the FHA documents are modelled on; they are reference material, not the forms this package uses. Also `03-closing-disclosure-cfpb-sample-fixed-rate.pdf`, the CFPB completed sample used as the layout benchmark. See
[docs/forms-and-sources.md](../docs/forms-and-sources.md) for the source URLs.
