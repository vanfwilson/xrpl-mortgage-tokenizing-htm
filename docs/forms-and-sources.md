# The closing package: forms and where they come from

Two layers. **Tokenization needs four documents** (the servicer's minimum, below). **The printed test package
contains twelve** (23 pages): the four, plus the supporting paper a title company actually hands over, so the
scanner and the page classifier are tested on the real thing. All twelve are filled for the same fictitious
homeowner (Jordan A. Sandbox, 123 Sandbox Lane, Meridian ID) and every signature line carries a blue-ink signature.
The printed, signed package is committed at [`forms/`](../forms/), with a 1:1 blank for every filled form in `forms/blank/` (see [forms/README.md](../forms/README.md)).

## The four the tokenizer reads

| # | Document | What the scanner reads from it | Official source |
|---|---|---|---|
| 1 | **Closing Disclosure** (CFPB H-25) | Loan Amount, Interest Rate, Monthly P&I (Loan Terms / Projected Payments); Estimated Taxes, Insurance & Assessments; Escrow Account Information; Cash to Close | Blank model form: <https://files.consumerfinance.gov/f/201311_cfpb_kbyo_closing-disclosure_blank.pdf> · Completed fixed-rate sample: <https://files.consumerfinance.gov/f/201311_cfpb_kbyo_closing-disclosure.pdf> · Index: <https://www.consumerfinance.gov/compliance/compliance-resources/mortgage-resources/tila-respa-integrated-disclosures/forms-samples/> |
| 2 | **Multistate Fixed Rate Note, Fannie Mae/Freddie Mac Form 3200** | Payment due day and first payment date (s.3); late-charge % and grace days (s.6); maturity | Fannie Mae PDF: <https://singlefamily.fanniemae.com/media/document/pdf/legal-documents/form-3200> (also <https://singlefamily.fanniemae.com/media/27086/display>) · FHFA copy: <https://www.fhfa.gov/mortgage-translations/document/form-3200-multi-state-fixed-rate-note> |
| 3 | **Idaho Deed of Trust, Form 3013** (security instrument) | APN, legal description, lien position, Transfer of Rights in the Property, recording block | Fannie Mae legal documents index: <https://singlefamily.fanniemae.com/fannie-mae-legal-documents> · Freddie Mac Word master (same uniform instrument): <https://sf.freddiemac.com/docs/doc/uniform-instruments/3013-idahodeedoftrust.doc> · FHFA: <https://www.fhfa.gov/mortgage-translations/document/form-3013-idaho-deed-of-trust> |
| 4 | **Recorded Warranty Deed** (county registry copy) | Instrument number, recording date and time, grantor/grantee, APN | Ada County Recorder: <https://adacounty.id.gov/clerk/recorder/> · Public index of recorded deeds: <https://deedrecords.idahoofficialrecords.com/county/ada> · Ada County warranty-deed form + completed example: <https://www.deeds.com/forms/idaho/warranty-deed/ada/> |

Plus, for the servicing loop test only: the **monthly mortgage statement / payment coupon** the
servicer issues (12 CFR 1026.41 periodic statement). We generate it; there is no agency form.

Fannie Mae's site blocks non-browser downloads (HTTP 403 to curl); the PDFs in `forms/blank/` were fetched with a
real browser session. The URLA forms are true AcroForms and are field-filled. The Form 3200 PDF and the CFPB Closing
Disclosure are flat, and Form 3013 is distributed as Word (the official 07/2021 Idaho .docx is `forms/blank/08-deed-of-trust-form-3013-official.docx`), so
those are produced by coordinate overlay or typeset rendering in `src/pdf/`.

## The supporting documents (printed and scanned, not needed to tokenize)

| Document | Source of the blank | How we fill it |
|---|---|---|
| URLA / Form 1003 Borrower Information (9 pp) and Lender Loan Information (2 pp) | Fannie Mae interactive PDFs (AcroForm): <https://singlefamily.fanniemae.com/media/document/pdf/form-1003-4>, <https://singlefamily.fanniemae.com/media/document/pdf/1003-lender-loan-information> | 423 + 75 form fields filled by name; borrower and originator signatures drawn on the signature fields |
| ALTA Settlement Statement, Borrower/Buyer | <https://www.alta.org/topics/trid-download.cfm?tridID=6&type=pdf> | overlay on page 1 + a full debit/credit ledger page, signed by borrower and escrow officer |
| Escrow Holding Instructions | no agency form; title-company boilerplate | typeset, signed by buyer, seller, escrow officer |
| FHA Amendatory Clause & Real Estate Certification | HUD form language | typeset, signed by buyer, seller, both agents |
| County Recorder receipt and certification | Ada County Recorder format | typeset, deputy recorder signature |
| Monthly mortgage statement (12 CFR 1026.41) | servicer's own | typeset |
| OCR stress-test sheet | ours | letter-spaced figures, alignment strips, faint print |

Pre-qualification data on the URLA is not a servicing source of truth, and the settlement statement and FHA clause
are closing-table documents with nothing recurring on them, which is why the tokenizer ignores them. They are in the
stack so the scanner pipeline is tested on a realistic bundle, not a curated one.

## Explicitly out of scope

- **HOA dues, home warranty, mortgage credit life** — never impounded by a standard servicer; the homeowner pays them directly.
- **Downstream splits** after the lender vault (investor distributions, sub-servicer fees) — beyond what the closing documents describe.

## The three buckets, from the Closing Disclosure page 1

| Bucket | CD block | Sample | On-ledger leg |
|---|---|---|---|
| Principal & Interest | Loan Terms → Monthly Principal & Interest | $2,770.73 | `LoanPay` against the vault-funded loan (lender / lienholder vault) |
| Property tax impound | Estimated Taxes, Insurance & Assessments → Property Taxes | $285.00 | `Payment` to the Tax Impound sub-account → `EscrowCreate` to the County Treasurer, time-locked to Dec 20 / Jun 20 |
| Insurance impound | Estimated Taxes… → Homeowner's Insurance ($125.00) + Projected Payments → Mortgage Insurance (FHA MIP $187.50) | $312.50 | `Payment` to the Insurance Impound sub-account → `EscrowCreate` to the carrier, time-locked to renewal |
| **Sweep** | Estimated Total Monthly Payment | **$3,368.23** | `Payment` homeowner → servicer, audited to the cent before the split |

Numbers are corrected from the original brief: P&I on $450,000 at 6.25 % for 360 months is
$2,770.73 (not $2,770.52), and FHA annual MIP at 80 % LTV on a 30-year loan is 0.50 %
($187.50/month, not 0.85 %), so the sweep is $3,368.23 (not $3,499.27).
