# forms/

**Filled, signed closing package** for the fictitious homeowner Jordan A. Sandbox, 123 Sandbox Lane, Meridian, ID.
Every document carries the same loan (MORT-2026-88492X, $450,000 FHA, 6.250 %, 360 months) and every signature line is
signed in blue ink. These are what you print and scan. Regenerate with `npm run print`.

| File | Document | Pages | Blank it was filled from |
|---|---|---|---|
| `01-urla-1003-borrower-information.pdf` | Uniform Residential Loan Application, Fannie Mae Form 1003 (09/2020), Borrower Information | 9 | `blank/01-urla-1003-borrower-information-blank.pdf` (official AcroForm) |
| `02-urla-1003-lender-loan-information.pdf` | Form 1003 Lender Loan Information | 2 | `blank/02-urla-1003-lender-loan-information-blank.pdf` (official AcroForm) |
| `03-closing-disclosure.pdf` | CFPB Closing Disclosure (H-25) | 2 | `blank/03-closing-disclosure-blank.pdf` (official CFPB, overlaid) |
| `04-alta-settlement-statement.pdf` | ALTA Settlement Statement, Borrower/Buyer | 2 | `blank/04-alta-settlement-statement-blank.pdf` (official ALTA, overlaid) |
| `05-escrow-holding-instructions.pdf` | Escrow holding instructions (title company) | 1 | `blank/05-escrow-holding-instructions-blank.pdf` |
| `06-fha-amendatory-clause.pdf` | FHA Amendatory Clause & Real Estate Certification | 1 | `blank/06-fha-amendatory-clause-blank.pdf` |
| `07-note-form-3200.pdf` | Multistate Fixed Rate Note, Fannie Mae Form 3200 | 1 | `blank/07-note-form-3200-blank.pdf` (official Fannie Mae, flat; filled version is typeset) |
| `08-deed-of-trust-form-3013.pdf` | Idaho Deed of Trust, Fannie Mae Form 3013 | 1 | `blank/08-deed-of-trust-form-3013-blank.pdf` (typeset template) + `blank/08-deed-of-trust-form-3013-official.docx` (official Fannie Mae Word master) |
| `09-warranty-deed-recorded.pdf` | Warranty Deed, county-recorded copy | 1 | `blank/09-warranty-deed-blank.pdf` |
| `10-county-recorder-certification.pdf` | Ada County Recorder receipt and certification | 1 | `blank/10-county-recorder-certification-blank.pdf` |
| `11-servicing-statement-period-1.pdf` | Monthly mortgage statement, period 1 | 1 | `blank/11-servicing-statement-blank.pdf` |
| `12-ocr-stress-test-page.pdf` | OCR stress-test sheet | 1 | `blank/12-ocr-stress-test-page-blank.pdf` |
| `closing-package-stack.pdf` | all of the above merged | 23 | |

The tokenizer needs only 03, 07, 08 and 09. The rest are in the stack so the scanner is tested on a realistic bundle.

## blank/

One blank per filled form, same number prefix. Official blanks (URLA, CFPB Closing Disclosure, ALTA statement, Form 3200; Form 3013 as the official Word master) plus typeset blank templates for the title-company and county documents that have no agency form. Also `03-closing-disclosure-cfpb-sample-fixed-rate.pdf`, the CFPB completed sample used as the layout benchmark. See
[docs/forms-and-sources.md](../docs/forms-and-sources.md) for the source URLs.
