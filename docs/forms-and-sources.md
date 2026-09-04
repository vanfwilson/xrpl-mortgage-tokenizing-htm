# The four-document servicing package: forms and where they come from

Scope rule (from the servicing brief): a standard Fannie Mae servicer automates exactly three
disbursements from the impound account, all of which are printed on page 1 of the Closing
Disclosure. The package therefore contains only the documents needed to run and audit those three:

| # | Document | What the scanner reads from it | Official source |
|---|---|---|---|
| 1 | **Closing Disclosure** (CFPB H-25) | Loan Amount, Interest Rate, Monthly P&I (Loan Terms / Projected Payments); Estimated Taxes, Insurance & Assessments; Escrow Account Information; Cash to Close | Blank model form: <https://files.consumerfinance.gov/f/201311_cfpb_kbyo_closing-disclosure_blank.pdf> · Completed fixed-rate sample: <https://files.consumerfinance.gov/f/201311_cfpb_kbyo_closing-disclosure.pdf> · Index: <https://www.consumerfinance.gov/compliance/compliance-resources/mortgage-resources/tila-respa-integrated-disclosures/forms-samples/> |
| 2 | **Multistate Fixed Rate Note, Fannie Mae/Freddie Mac Form 3200** | Payment due day and first payment date (s.3); late-charge % and grace days (s.6); maturity | Fannie Mae PDF: <https://singlefamily.fanniemae.com/media/document/pdf/legal-documents/form-3200> (also <https://singlefamily.fanniemae.com/media/27086/display>) · FHFA copy: <https://www.fhfa.gov/mortgage-translations/document/form-3200-multi-state-fixed-rate-note> |
| 3 | **Idaho Deed of Trust, Form 3013** (security instrument) | APN, legal description, lien position, Transfer of Rights in the Property, recording block | Fannie Mae legal documents index: <https://singlefamily.fanniemae.com/fannie-mae-legal-documents> · Freddie Mac Word master (same uniform instrument): <https://sf.freddiemac.com/docs/doc/uniform-instruments/3013-idahodeedoftrust.doc> · FHFA: <https://www.fhfa.gov/mortgage-translations/document/form-3013-idaho-deed-of-trust> |
| 4 | **Recorded Warranty Deed** (county registry copy) | Instrument number, recording date and time, grantor/grantee, APN | Ada County Recorder: <https://adacounty.id.gov/clerk/recorder/> · Public index of recorded deeds: <https://deedrecords.idahoofficialrecords.com/county/ada> · Ada County warranty-deed form + completed example: <https://www.deeds.com/forms/idaho/warranty-deed/ada/> |

Plus, for the servicing loop test only: the **monthly mortgage statement / payment coupon** the
servicer issues (12 CFR 1026.41 periodic statement). We generate it; there is no agency form.

Fannie Mae's site blocks non-browser downloads (HTTP 403 to curl); the PDFs in `forms/blank/`
were fetched with a real browser session. The Form 3200 PDF is flat (no AcroForm fields), the
CFPB Closing Disclosure is flat, and Form 3013 is distributed as Word, so all three are produced
by coordinate overlay or typeset rendering in `src/pdf/`, never by field-filling.

## Explicitly out of the package

- **URLA / Form 1003** — pre-qualification data, unverified, not a servicing source of truth.
- **ALTA settlement statement, FHA amendatory clause** — closing-table documents; nothing recurring.
- **HOA dues, home warranty, mortgage credit life** — never impounded by a standard servicer.

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
