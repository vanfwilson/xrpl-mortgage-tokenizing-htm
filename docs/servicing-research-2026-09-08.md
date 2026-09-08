# Servicing-only redesign: research, regulatory map and rebuild spec

Date: 2026-09-08. Author: Claude Fable 5.1 session with HTM. Companion document: [audit-2026-09-08-fable.md](audit-2026-09-08-fable.md) (the technical audit of the repository as it stood on 2026-09-04).

This document records the business clarifications given by HTM on 2026-09-08, the research done against primary sources, the legal citations that govern a residential mortgage servicing layer, and the resulting rebuild specification. It supersedes the investor/vault story in `grant-narrative.md`, `standards-mapping.md` and `README.md` until those files are rewritten.

## 1. Business facts (from HTM, 2026-09-08)

- HTM is a licensed US mortgage broker (California) with operations in Manila. It originates and sells residential loans. It does not raise capital and does not sell participations to investors.
- The goal is to **perform mortgage servicing** on standard Fannie Mae fixed-rate 30-year residential loans in California or Idaho, after close of escrow.
- P&I on a fixed-rate loan is stated, exact and unchangeable for the life of the loan.
- HTM intends to contract a **licensed bank-owned subservicer** as servicer of record; that contract carries the licensing and most of the liability. HTM's role is technology provider and (possibly) holder of servicing rights.
- The synthetic closing package is intentionally not a real mortgage. HTM staff are not escrow officers.
- The servicing "smart contract" must run for the life of the loan (30 years), not a 12-week demo horizon; must handle tax increases (shortage) and over-collection (surplus); and must produce whatever the servicer owes the IRS.

## 2. Consequences for the on-ledger design

### 2.1 The note is not a token

The promissory note is the signed legal instrument (paper, or a MERS-registered eNote). A ledger object can only be a **record** that points at it by hash. Without investors there is nobody to hold "participation certificates", so the repo's MPT with supply = principal in cents has no holder and no cash-flow meaning. The only useful on-ledger object is one loan record per loan (an MPT with supply 1, or an NFToken), carrying the document-bundle SHA-256, the loan id, the origination date and a pointer to the off-ledger record, held by the servicer of record. The repo's reasons for rejecting NFTs (no divisible balance, cannot be held by a vault) were vault reasons and no longer apply.

### 2.2 XLS-65 / XLS-66 are the wrong tool for post-close servicing

1. **XLS-66 cannot represent an already-funded loan.** `LoanSet` always draws `PrincipalRequested` from a Single Asset Vault and pays it to the borrower on-ledger. HTM's loans are funded off-ledger by a wholesale lender and sold. Modelling that with XLS-66 requires a fictitious funding event and a vault that owns money it never held. (Spec: [XLS-66 Lending Protocol](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0066-lending-protocol), "The protocol offers straightforward on-chain uncollateralized fixed-term loans, utilizing pooled funds".)
2. **Neither amendment is on Mainnet.** Latest reported validator support is roughly 37 % for SingleAssetVault and 34 % for LendingProtocol against the 80 % activation threshold ([KuCoin, validator vote status](https://www.kucoin.com/news/flash/xrp-ledger-validators-near-40-support-for-lending-protocol-amendments); [xrpldashboard amendments](https://xrpldashboard.com/amendments)). A servicing product that depends on them has no production date HTM controls.
3. **Everything servicing needs is live on Mainnet today:** MPTokensV1 (October 2025), Credentials and PermissionedDomains (4 February 2026), TokenEscrow / XLS-85 (12 February 2026), native Payment and Escrow ([xrpl.org Known Amendments](https://xrpl.org/resources/known-amendments); [XLS-85 Token-Enabled Escrows](https://xls.xrpl.org/xls/XLS-0085-token-escrow.html)).
4. DynamicMPT (XLS-94), which would allow a loan-record token's metadata to be updated, is **not** on Mainnet (about 20 % support as of 2026-08-31) ([XLS-94 Dynamic MPTs](https://opensource.ripple.com/docs/xls-94-dynamic-mpts)). Mutable loan state therefore lives off-ledger (Postgres) and on-ledger history is the transaction log.

Decision: remove XLS-65/66 from the servicing layer; keep an appendix describing how an XLS-66 loan object could mirror the schedule once the amendment activates. The 360-row `servicing_payments` table and `src/domain/loan-math.ts` are the amortization authority, which matches the Layer 3 / Layer 4 split in the August 2026 grant proposal.

### 2.3 What "the smart contract" is on XRPL

The XRP Ledger has no long-running program. The servicing contract is (a) an off-ledger monthly job that submits the sweep and the three legs, and (b) native escrow objects that hold impound money until a date. Duration is not a setting: an escrow can be created for any future `FinishAfter`, so a 30-year horizon is the same mechanism as a 52-week one. The demo must show a **full loan year**: 12 sweeps, both Idaho tax halves (Idaho Code § 63-903: on or before December 20, second half by June 20 — [Idaho Legislature](https://legislature.idaho.gov/statutesrules/idstat/title63/t63ch9/sect63-903/)), the insurance renewal, one annual escrow analysis, and the Form 1098 output.

## 3. Regulatory map for a residential servicing layer

### 3.1 Escrow (impound) accounts — RESPA / Regulation X, 12 CFR 1024.17

"Escrow" here is the **servicing escrow / impound account** (12 CFR 1024.17(b): "any account that a servicer establishes or controls on behalf of a borrower to pay taxes, insurance premiums (including flood insurance), or other charges"), not the closing escrow run by a title company. Source: [eCFR 12 CFR 1024.17](https://www.ecfr.gov/current/title-12/chapter-X/part-1024/subpart-B/section-1024.17); [CFPB § 1024.17](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/).

Rules the code must implement literally:

| Rule | Cite | Implementation |
|---|---|---|
| Aggregate accounting method for the analysis | 1024.17(c)(1)(i), (d) | Month-by-month projection of every disbursement |
| Cushion ≤ one-sixth of estimated annual disbursements (two months), or a lower amount required by state law or the loan documents | 1024.17(c)(1)(ii) | Config: `cushion_months` default 2, override per state/note |
| Monthly escrow payment = 1/12 of estimated annual disbursements plus cushion adjustment | 1024.17(c)(2), (d) | Recomputed at each annual analysis |
| Initial escrow account statement at settlement | 1024.17(g) | Generated from the Closing Disclosure initial deposit |
| Annual escrow account statement within 30 days of the end of the computation year | 1024.17(i) | JSON + PDF output |
| Surplus ≥ $50 and borrower current: refund within 30 days; surplus < $50: refund or credit | 1024.17(f)(2) | Refund Payment with memo, or credit to next year |
| Shortage < one month's escrow payment: collect within 30 days or over 12 months; shortage ≥ one month: over at least 12 months | 1024.17(f)(3) | Shortage schedule added to the monthly escrow amount |
| Deficiency (negative balance): servicer advances, recovers over 12 months (or 30 days if < one month) | 1024.17(f)(4) | Servicer-advance Payment with memo `htm/advance` |
| Servicer must pay disbursements on or before the deadline even if the account is short, as long as the borrower is not more than 30 days overdue | 1024.17(k)(1) | Escrow only when projected balance ≥ amount due; otherwise advance |

Related Regulation X servicing rules that apply to whoever is servicer of record: servicing transfer notices (1024.33), error resolution and information requests (1024.35–.36), force-placed insurance limits (1024.37), general servicing policies (1024.38), early intervention and loss mitigation (1024.39–.41).

### 3.2 Truth in Lending — Regulation Z, 12 CFR 1026

- Payments must be credited as of the day of receipt (1026.36(c)(1)).
- Periodic statements each billing cycle (1026.41).
- Notice to the borrower within 30 days when ownership of the loan is transferred; a transfer of only a partial interest is exempt if the party handling payments does not change (1026.39, (c)(3)) — [eCFR 12 CFR 1026.39](https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-E/section-1026.39). A transfer of the on-ledger loan-record token that reflects a change of note owner should trigger this notice.
- Regulation Z applies to consumer credit. The prior repo design made the on-ledger loan business credit between HTM entities (1026.3(a) exemption); the redesign services the consumer loan itself, so Regulation Z applies to the servicing layer.

### 3.3 FHA loans — HUD

- Late charge may not exceed **4 %** of the payment more than 15 days in arrears (24 CFR 203.25 — [eCFR](https://www.ecfr.gov/current/title-24/subtitle-B/chapter-II/subchapter-B/part-203/subpart-A/subject-group-ECFR9d15fe6609d4c08/section-203.25)); HUD's model note prints 4 % ([HUD Model Note](https://www.hud.gov/sites/documents/41651x3hsgh.pdf)). The fixture's 5 % / $138.54 must become 4 % / $110.83 and the fixture relabelled as the FHA model note and FHA security instrument rather than Fannie Mae Forms 3200/3013.
- Upfront MIP is 1.75 % of the **base** loan amount; annual MIP rates apply to the base loan amount and LTV ([HUD Mortgagee Letter 2023-05](https://www.hud.gov/sites/dfiles/OCHCO/documents/2023-05hsgml.pdf)). The fixture computes both on the total ($450,000); correct values on the $442,125 base are UFMIP $7,737.19 and monthly MIP $184.22 at 0.50 %.
- FHA servicing is governed by HUD Handbook 4000.1 Section III (servicing), including escrow custodial-account requirements; the subservicer must be a HUD-approved mortgagee.

### 3.4 State overlays

- **California**: Civil Code § 2954.8 requires **2 % simple interest per year** on impound balances for one-to-four-family loans, credited at least annually; AB 493 (signed 2025-08-29) extends it to hazard-insurance proceeds held after a disaster ([Nolo summary](https://www.nolo.com/legal-encyclopedia/can-i-cancel-my-impound-account-in-california.html); [AB-493 text](https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260AB493)). Interest paid of $10 or more is reportable on Form 1099-INT.
- **Idaho**: property tax halves due December 20 and June 20 (Idaho Code § 63-903). No Idaho interest-on-escrow requirement was found in this session; **unverified against Idaho statute** — confirm before relying on it.

### 3.5 IRS reporting — Form 1098

The servicer files. IRS instructions: "If you receive reportable interest payments (other than points) on behalf of someone else and you are the first person to receive the interest, such as a servicing bank collecting payments for a lender, you must file this form." Threshold: $600 or more of interest (or $600 or more of MIP) per mortgage per calendar year. Source: [Instructions for Form 1098](https://www.irs.gov/instructions/i1098); [About Form 1098](https://www.irs.gov/forms-pubs/about-form-1098).

| Box | Content | Data source in this system |
|---|---|---|
| 1 | Mortgage interest received (not points) | Σ interest rows of the schedule for the calendar year, reconciled to ledger P&I legs |
| 2 | Outstanding principal as of January 1 | Schedule balance at the last period of the prior year |
| 3 | Origination date | Canonical loan `origination_date` |
| 4 | Refund of overpaid interest | Escrow/interest correction records |
| 5 | Mortgage insurance premiums (reportable when ≥ $600) | Σ FHA MIP paid from the insurance impound |
| 6 | Points paid on purchase of principal residence | Closing Disclosure loan costs (year of origination only) |
| 7–9 | Property address or APN; number of properties | Canonical property record (off-ledger; never in memos) |
| 10 | Other, e.g. "real estate taxes, insurance paid from escrow" | Σ tax and insurance disbursements |
| 11 | Acquisition date if the mortgage was acquired that year | Loan-record token transfer date |

Deadlines: furnish to the borrower by January 31; file electronically with the IRS by March 31 (paper February 28). These dates are from the IRS General Instructions for Certain Information Returns and were not restated on the page fetched this session; confirm before building the calendar.

Other filings that may arise: Form 1099-INT for California escrow interest ≥ $10; Form 1099-A / 1099-C on foreclosure or debt cancellation (out of scope). The RESPA annual escrow statement (§ 3.1) is a borrower document, not an IRS filing.

### 3.6 Licensing and liability

- A bank-owned subservicer as servicer of record moves licensed servicing activity and most liability to the bank. Open questions for counsel: whether HTM holding **mortgage servicing rights** is licensed activity in California (DFPI, California Residential Mortgage Lending Act / Financing Law) or Idaho; and the treatment of HTM's Manila team as a **third-party service provider** to the subservicer (CFPB vendor-oversight expectations; GLBA cross-border data handling).
- Philippine licences are not relevant to US loan servicing.
- The grant narrative should describe HTM as **technology provider** and the bank subservicer as **servicer of record** until counsel says otherwise.

### 3.7 Securities and GAAP — no longer applicable

With no investor participations and no vault, Regulation D (17 CFR 230.506), accredited-investor verification, Form D, and the ASC 860 participating-interest analysis raised in the audit fall away. If HTM later sells whole loans, that is a whole-loan sale, not a securities offering; describe it as such and avoid the words "participation certificate".

## 4. Rebuild specification (servicing-only)

Objects per loan, Mainnet-available primitives only:

- One loan-record token (MPT supply 1 or NFToken): bundle SHA-256, loan id, origination date, off-ledger record pointer. Held by the servicer of record; transferred on servicing or ownership transfer (triggers 1026.39 / 1024.33 notices).
- One servicer collection account (RLUSD or bank stablecoin in production; a test-issued USD token at face value on Testnet — remove the 1 XRP = $10,000 scaling).
- Two impound sub-accounts per loan (tax, insurance).
- One native escrow per upcoming installment, created only when the scheduler's projected balance at the deadline covers the amount due; otherwise a servicer-advance Payment (memo `htm/advance`) and a deficiency record.
- Monthly: homeowner Payment of PITI → servicer; servicer Payments of P&I to the note-holder account, tax to the tax impound, insurance to the insurance impound; refuse to submit unless the three legs equal the sweep to the cent; memos carry loan id, period, leg and amount only (no APN, name or address).
- Annual: 1024.17 analysis (§ 3.1) → new monthly escrow amount, surplus refund or shortage schedule, RESPA annual statement, California interest credit where applicable, Form 1098 data set (§ 3.5).

Removed: vault, LoanBroker, LoanSet, LoanPay, LoanManage, investor and KYC wallets, credentials, permissioned domain, the 60/40 MPT distribution, `usdPerXrp`.

Kept: document hashing, OCR and tie-outs, canonical schema, three-way split with checksum, impound scheduler (extended into the 1024.17 analysis), Postgres record and run recorder, XLS-89 metadata encoder.

Fixture corrections: FHA model note and FHA security instrument labels; late charge 4 % / 15 days; UFMIP and MIP on the base loan; LTV = base ÷ price; every tie-out regenerated.

Demo: one full loan year on Testnet with 30-day intervals (12 sweeps, Dec 20 and Jun 20 tax escrows, Sep 1 insurance escrow, annual analysis, 1098 output), plus a compressed Devnet variant for CI.

## 5. Sequencing

1. GPT-6 Astra independent audit of the repository at commit b58e9d4 using the same prompt as the Fable pass, with this document supplied as the proposed direction.
2. `roast` council over both audits and this redesign.
3. Implementation (Fable 5.1, max effort) of the rebuild prompt below; diff reviewed by GPT-6 Astra at xhigh before commit.

## 6. Rebuild prompt

```
REASONING EFFORT: max.

Rebuild /Volumes/BackupPlus/VideoLab/repos/xrpl-mortgage-tokenizing-htm as a
servicing layer for ONE already-funded, fixed-rate, 30-year FHA residential
loan (Fannie Mae uniform note, Idaho or California), operated by HTM as
technology provider for a licensed bank subservicer that is servicer of record.
No investors, no vault, no lending protocol, no capital raising.

LOCKED DECISIONS
L1. Remove XLS-65 and XLS-66 entirely (steps 03-vault, 04-lending, LoanPay,
    LoanManage, investor and kyc wallets, credentials, permissioned domain).
    Keep a docs/appendix-xls66.md explaining why they are deferred until
    Mainnet activation.
L2. Use only Mainnet-live primitives: Payment, EscrowCreate/Finish/Cancel,
    MPTokensV1 (loan record, supply 1) or NFTokenMint, TokenEscrow for
    stablecoin impounds. Testnet profile uses a test-issued USD token at face
    value; remove usdPerXrp scaling.
L3. Amortization authority is src/domain/loan-math.ts and the Postgres
    servicing_payments table. P&I is constant for the life of the loan.
L4. Monthly cycle: homeowner Payment of PITI -> servicer; servicer Payments of
    P&I to the note-holder account, tax to tax impound, insurance to
    insurance impound; refuse to submit unless the three legs equal the sweep
    to the cent; memos carry loan id, period, leg, amount only (no APN).
L5. Impound escrows: EscrowCreate for an installment only when the scheduler's
    projected balance at the deadline >= amount due; otherwise submit a
    servicer-advance Payment with memo type htm/advance and record the
    deficiency. Seed sub-accounts with the CD initial escrow deposit.
L6. Implement 12 CFR 1024.17 annual escrow analysis: aggregate method,
    one-sixth cushion cap (override to 0 or state value via config), surplus
    >= $50 refund within 30 days when current, shortage < 1 month collected in
    30 days or 12 months, shortage >= 1 month over 12 months, deficiency
    recovery, new monthly escrow amount, RESPA annual statement (JSON + PDF).
    California profile adds 2 % interest credit per Civil Code 2954.8 and a
    1099-INT record when >= $10.
L7. Implement Form 1098 data generation from ledger history + schedule:
    boxes 1, 2, 3, 4, 5, 6, 7-9, 10 (taxes and insurance paid from escrow),
    11; $600 threshold per mortgage; output JSON + a filled f1098 PDF; a
    calendar entry for Jan 31 furnish and Mar 31 e-file.
L8. Fixture corrections: FHA model note and FHA security instrument labels;
    late charge 4 % of P&I, 15-day grace; UFMIP 1.75 % of base, annual MIP on
    base, LTV = base / price; regenerate all tie-outs.
L9. Demo = one full loan year on Testnet with 30-day intervals: 12 sweeps,
    Dec 20 and Jun 20 tax escrows, Sep 1 insurance escrow, annual analysis,
    1098 output. Provide a compressed Devnet variant for CI.
L10. Docs rewritten to the servicing-only story; README compliance section
     names: RESPA Reg X (1024.17, 1024.33-.41), Reg Z (1026.36(c), 1026.41,
     1026.39), HUD 4000.1, GLBA, Cal. Civ. Code 2954.8, IRS Form 1098; and
     states that HTM is a technology provider and the bank subservicer is
     servicer of record.

DEFINITION OF DONE
1. npm test green with new tests for L4-L8; no assertion deleted without a
   replacement.
2. Testnet loan-year run with every tx tesSUCCESS; out/latest.md and
   docs/testnet-run.md regenerated; explorer links resolve.
3. grep -ri "vault\|LoanSet\|LoanPay\|investor\|accredited\|participation\|
   private_credit\|Reg D" src docs README.md GLOSSARY.md WALKTHROUGH.md
   returns only the deferred-XLS-66 appendix.
4. docs/escrow-analysis-example.md shows one worked analysis with a surplus
   case and a shortage case, numbers reconciled to the cent.
5. docs/form-1098-example.json for the demo loan year with every box populated
   and box 1 equal to the sum of interest rows in the schedule for that year.
6. Every finding in docs/audit-2026-09-08-fable.md is marked FIXED
   (file:line), OBSOLETE (removed with the vault), or WON'T-FIX with reason.

TESTS TO REPORT
T1 Three-leg split equals sweep to the cent for all 12 periods.
T2 Tax escrow is NOT created after 2 sweeps (deficit logged); IS created when
   projected balance >= $1,710.
T3 Annual analysis: cushion <= 1/6 of $7,170; surplus of $60 produces a refund
   record; shortage of $400 produces a 12-month collection schedule.
T4 California profile credits 2 % interest and emits a 1099-INT record only
   when >= $10.
T5 1098 box 1 == sum of interest for the calendar year from the schedule;
   box 2 == principal outstanding at Jan 1; box 5 populated only if MIP >= $600.
T6 No memo contains APN, name, or address.
T7 Loan record token metadata <= 1024 bytes and contains the bundle sha256.
T8 Late charge in fixture == round2(0.04 x 2770.73) and grace == 15 days.

Do not push to GitHub. Stop after T1-T8 and the finding-status list.
```

## 7. Source list

XRPL

- XLS-66 Lending Protocol — https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0066-lending-protocol
- XLS-65 Single Asset Vault — https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0065-single-asset-vault
- XLS-33 Multi-Purpose Tokens — https://xls.xrpl.org/xls/XLS-0033-multi-purpose-tokens.html
- XLS-89 MPT metadata schema — https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0089-multi-purpose-token-metadata-schema
- XLS-85 Token-Enabled Escrows — https://xls.xrpl.org/xls/XLS-0085-token-escrow.html
- XLS-94 Dynamic MPTs — https://opensource.ripple.com/docs/xls-94-dynamic-mpts
- MPTokenIssuanceCreate reference — https://xrpl.org/docs/references/protocol/transactions/types/mptokenissuancecreate
- Known Amendments — https://xrpl.org/resources/known-amendments
- Live amendment status — https://xrpldashboard.com/amendments
- XLS-65/66 validator vote — https://www.kucoin.com/news/flash/xrp-ledger-validators-near-40-support-for-lending-protocol-amendments
- XRPL Grants FAQ and rubric — https://xrplgrants.org/faq

Federal

- 12 CFR 1024.17 Escrow accounts — https://www.ecfr.gov/current/title-12/chapter-X/part-1024/subpart-B/section-1024.17
- 12 CFR 1026.39 Mortgage transfer disclosures — https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-E/section-1026.39
- 24 CFR 203.25 Late charge — https://www.ecfr.gov/current/title-24/subtitle-B/chapter-II/subchapter-B/part-203/subpart-A/subject-group-ECFR9d15fe6609d4c08/section-203.25
- HUD Model Note (Appendix III) — https://www.hud.gov/sites/documents/41651x3hsgh.pdf
- HUD Mortgagee Letter 2023-05 (MIP) — https://www.hud.gov/sites/dfiles/OCHCO/documents/2023-05hsgml.pdf
- 17 CFR 230.506 Regulation D (no longer applicable) — https://www.ecfr.gov/current/title-17/chapter-II/part-230/subject-group-ECFR6e651a4c86c0174/section-230.506
- IRS Instructions for Form 1098 — https://www.irs.gov/instructions/i1098
- IRS About Form 1098 — https://www.irs.gov/forms-pubs/about-form-1098

State

- Idaho Code § 63-903 — https://legislature.idaho.gov/statutesrules/idstat/title63/t63ch9/sect63-903/
- Ada County Treasurer tax dates — https://adacounty.id.gov/treasurer/calculation-of-property-taxes/remember-important-tax-dates/
- California Civil Code § 2954.8 (summary) — https://www.nolo.com/legal-encyclopedia/can-i-cancel-my-impound-account-in-california.html
- California AB 493 (2025) — https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260AB493

Accounting (context for the superseded investor design)

- ASC 860 participating interest — https://dart.deloitte.com/USDART/home/codification/broad-transactions/asc860-10/roadmap-transfers-financial-assets/chapter-3-accounting-for-transfers-financial/3-2-meaning-term-participating-interest

Items cited from regulation text without a live fetch in this session (verify before quoting externally): 12 CFR 1026.3(a), 1026.36(c), 1026.41, 1024.33–.41; HUD Handbook 4000.1 servicing sections; Form 1098 furnishing and filing deadlines; ASC 310-20, ASC 326, ASC 470.
