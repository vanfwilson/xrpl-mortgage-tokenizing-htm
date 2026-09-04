# forms/

**Filled, signed closing package** for the fictitious homeowner Jordan A. Sandbox, 123 Sandbox Lane, Meridian, ID.
Every document carries the same loan (MORT-2026-88492X, $450,000 FHA, 6.250 %, 360 months) and every signature line is
signed in blue ink. These are what you print and scan. Regenerate with `npm run print`.

| File | Document | Pages | Blank it was filled from |
|---|---|---|---|
| `01-urla-1003-borrower-information.pdf` | Uniform Residential Loan Application, Fannie Mae Form 1003 (09/2020), Borrower Information | 9 | `blank/urla-1003-borrower-information.pdf` (official AcroForm) |
| `02-urla-1003-lender-loan-information.pdf` | Form 1003 Lender Loan Information | 2 | `blank/urla-1003-lender-loan-information.pdf` (official AcroForm) |
| `03-closing-disclosure.pdf` | CFPB Closing Disclosure (H-25) | 2 | `blank/cfpb-closing-disclosure-blank.pdf` (official, overlaid) |
| `04-alta-settlement-statement.pdf` | ALTA Settlement Statement, Borrower/Buyer | 2 | `blank/alta-settlement-statement-borrower.pdf` (official, overlaid) |
| `05-escrow-holding-instructions.pdf` | Escrow holding instructions (title company) | 1 | typeset |
| `06-fha-amendatory-clause.pdf` | FHA Amendatory Clause & Real Estate Certification | 1 | typeset |
| `07-note-form-3200.pdf` | Multistate Fixed Rate Note, Fannie Mae Form 3200 | 1 | `blank/fannie-form-3200.pdf` (official, flat; typeset) |
| `08-deed-of-trust-form-3013.pdf` | Idaho Deed of Trust, Fannie Mae Form 3013 | 1 | `blank/fannie-form-3013-idaho-deed-of-trust.docx` (official Word; typeset) |
| `09-warranty-deed-recorded.pdf` | Warranty Deed, county-recorded copy | 1 | typeset |
| `10-county-recorder-certification.pdf` | Ada County Recorder receipt and certification | 1 | typeset |
| `11-servicing-statement-period-1.pdf` | Monthly mortgage statement, period 1 | 1 | typeset |
| `12-ocr-stress-test-page.pdf` | OCR stress-test sheet | 1 | typeset |
| `closing-package-stack.pdf` | all of the above merged | 23 | |

The tokenizer needs only 03, 07, 08 and 09. The rest are in the stack so the scanner is tested on a realistic bundle.

## blank/

The official blank forms as downloaded from CFPB, ALTA, Fannie Mae and Freddie Mac. See
[docs/forms-and-sources.md](../docs/forms-and-sources.md) for the source URLs.
