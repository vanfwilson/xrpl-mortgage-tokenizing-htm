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
| 2 | **FHA Fixed Rate Note (HUD model note), Idaho** | Payment due day and first payment date (s.3); late-charge % (4 % cap, 24 CFR 203.25) and 15-day grace (s.6); maturity | HUD Model Note: <https://www.hud.gov/sites/documents/41651x3hsgh.pdf> · 24 CFR 203.25: <https://www.ecfr.gov/current/title-24/section-203.25> · Uniform-instrument base kept for reference in `forms/blank/reference/` |
| 3 | **FHA Idaho Deed of Trust** (HUD model security instrument on the uniform-instrument base) | APN, legal description, lien position, Transfer of Rights in the Property, recording block | HUD Handbook 4000.1 model documents: <https://www.hud.gov/hud-partners/single-family-handbook-4000-1> · Uniform-instrument base (Fannie Mae legal documents index): <https://singlefamily.fanniemae.com/fannie-mae-legal-documents> |
| 4 | **Recorded Warranty Deed** (county registry copy) | Instrument number, recording date and time, grantor/grantee, APN | Ada County Recorder: <https://adacounty.id.gov/clerk/recorder/> · Public index of recorded deeds: <https://deedrecords.idahoofficialrecords.com/county/ada> · Ada County warranty-deed form + completed example: <https://www.deeds.com/forms/idaho/warranty-deed/ada/> |

Plus, for the servicing loop test only: the **monthly mortgage statement / payment coupon** the
servicer issues (12 CFR 1026.41 periodic statement). We generate it; there is no agency form.

Fannie Mae's site blocks non-browser downloads (HTTP 403 to curl); the PDFs in `forms/blank/` were fetched with a
real browser session. The URLA forms are true AcroForms and are field-filled. The CFPB Closing Disclosure is flat, and HUD publishes model-note and security-instrument language rather than fillable forms, so those are produced by coordinate overlay or typeset rendering in `src/pdf/` (uniform-instrument masters kept in `forms/blank/reference/`).

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
- **Downstream of the note holder** (the bank's own reporting, sub-servicer fees) — beyond what the closing documents describe.

## The four legs, from the Closing Disclosure page 1

| Bucket | CD block | Sample | On-ledger leg |
|---|---|---|---|
| Principal & Interest | Loan Terms → Monthly Principal & Interest | $2,770.73 | `Payment` to the note holder (funding bank); fixed for the life of the loan |
| Property tax impound | Estimated Taxes, Insurance & Assessments → Property Taxes | $285.00 | `Payment` to the Tax Impound sub-account → `EscrowCreate` to the County Treasurer, time-locked to Dec 20 / Jun 20 |
| Hazard impound | Estimated Taxes… → Homeowner's Insurance | $125.00 | `Payment` to the Hazard Impound sub-account → `EscrowCreate` to the carrier, time-locked to renewal |
| FHA MIP | Projected Payments → Mortgage Insurance (0.50 % of base / 12) | $184.28 | `Payment` to the MIP payable, remitted monthly to HUD; never escrowed with hazard |
| **Payment** | Estimated Total Monthly Payment | **$3,365.01** | `Payment` homeowner → servicer, audited to the cent before the split |

Numbers are corrected from the original brief and from the 2026-09-08 audits: P&I on $450,000 at 6.25 % for 360 months is
$2,770.73; the note is re-based so that base $442,260.44 + UFMIP $7,739.56 (1.75 % of base) = $450,000.00; FHA annual MIP
is 0.50 % of the base at 78.98 % LTV ($184.28/month) and is remitted monthly to HUD, not escrowed with hazard; the late charge is
4 % of P&I ($110.83) per 24 CFR 203.25. The monthly payment is therefore $3,365.01.
