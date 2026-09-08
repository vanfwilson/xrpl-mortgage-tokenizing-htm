# Architecture: residential mortgage servicing on the XRP Ledger

Status: Phase A of `docs/build-prompt-servicing-architecture-2026-09-08.md`. Branch `claude/servicing-rebuild`. This document replaces the investor/vault architecture; the previous version is in git history at commit 76ead3b.

## 1. Trust boundary

```
┌──────────────────────────── LEGALLY AUTHORITATIVE ────────────────────────────┐
│  Bank-owned licensed subservicer (servicer of record)                         │
│  • insured custodial accounts (collection, tax, hazard, MIP, advances, refunds)│
│  • servicing books, borrower accounting, notices, IRS filings                  │
│  • signs ledger transactions through 2-of-3 signer lists it controls           │
└───────────────────────────────────────────────────────────────────────────────┘
                 ▲ bank statements, ACH files            │ approvals, dual-control tasks
                 │                                       ▼
┌──────────────────────────── HTM SERVICING ENGINE (this repo) ─────────────────┐
│  Postgres htm_mortgages = system of record for documents, schedule, subledgers│
│  src/servicing/*  applies payments, runs 1024.17 analysis, builds statements, │
│                   1098 data, transfer and exception cases                      │
│  src/xrpl/*       builds exact-cent Payments, NFToken record, TokenEscrows    │
│  Manila operators submit tasks to dual-control queues; they never hold keys   │
└───────────────────────────────────────────────────────────────────────────────┘
                 │ signed tx                              ▲ validated hashes, objects
                 ▼                                       │
┌──────────────────────────── XRP LEDGER (evidence + date lock) ────────────────┐
│  Payment (issued USD)     exact-cent settlement events, versioned memos       │
│  NFToken                  per-loan document-version handle (hash + pointer)  │
│  TokenEscrow              impound money for a verified near-term bill cannot  │
│                           be released before FinishAfter                      │
└───────────────────────────────────────────────────────────────────────────────┘
```

Rules that follow from the boundary:

1. The bank's books decide what the borrower owes and what was received. The engine computes; the bank approves; the ledger records.
2. A validated ledger transaction is evidence of a settlement event. It is not proof of legal compliance, of payee receipt, of document validity, of servicing authority, or of custody.
3. Until the bank, HUD counsel and the bank's auditors approve a production deposit token, the escrowed asset is a mirrored settlement token, never borrower money and never the HUD custodial account.
4. No ledger-bound payload carries a name, address, SSN, APN, county account number, policy number or FHA case number (S10).

## 2. Objects and ownership

| Object | Where | Owner / controller | Holds | Purpose |
|---|---|---|---|---|
| `loans` row | Postgres | subservicer tenant (`company_id`) | opaque `loan_id`, product, state, terms, `legal_owner_id`, `servicer_of_record_id` | tenant boundary and authority |
| `loan_document_versions` | Postgres + bank eVault | bank document system | canonical bundle sha256, content-addressed pointer, effective dates | operative-document chain |
| NFToken (XLS-20) | ledger | bank servicing account (`servicer` wallet) | URI ≤ 256 B: `{v, loan, sha256, ptr}` | public digital-twin handle; no economic rights |
| Collection account | bank + `subledger_entries` | subservicer | borrower receipts, suspense | receipt-date credit and application (R16) |
| Note-holder payable | bank + subledger | subservicer | P&I due to the funding bank | remittance and reconciliation |
| Tax impound | bank custodial + subledger | subservicer | property-tax reserve | aggregate analysis and disbursement (R02–R10) |
| Hazard impound | bank custodial + subledger | subservicer | hazard-premium reserve | carrier disbursement |
| FHA MIP payable | bank clearing + subledger | subservicer | periodic MIP | monthly HUD remittance (S8); never merged with hazard |
| Advance account | bank + subledger | subservicer | servicer advances, deficiency recovery | timely disbursement (R10) |
| Refund payable | bank + subledger | subservicer | surplus and interest refunds | R07, R23 |
| Loss-draft account | bank + subledger (California only) | subservicer | insurance loss proceeds | R24; separate from impounds |
| `escrow_analyses` | Postgres | engine, approved by bank | projections, cushion, classification, options chosen | Reg X decision record (R02–R09) |
| Ledger settlement accounts | ledger | bank-controlled 2-of-3 signer lists | test USD (Testnet) / approved token (production) | exact-cent Payment and near-term TokenEscrow |
| Escrow objects | ledger | tax or hazard settlement account | one verified near-term bill each | date lock (S7) |
| `reconciliation_events` | Postgres, append-only, hash-chained | engine | bank ref, subledger ref, ledger hash, difference | three-way proof (R14, R22) |

Ledger wallets per loan on Testnet: `servicer` (NFToken holder, collection), `noteHolder` (funding bank), `taxImpound`, `hazardImpound`, `mipPayable`, `countyTreasurer`, `insuranceCarrier`, `hud`, `homeowner`, `issuer` (test USD). Production collapses these to bank-controlled accounts with signer lists.

## 3. Monthly cycle

```mermaid
sequenceDiagram
  autonumber
  participant HO as Homeowner (bank ACH / ledger Payment)
  participant COL as Collection account
  participant ENG as Servicing engine
  participant NH as Note holder (bank)
  participant TAX as Tax impound
  participant HAZ as Hazard impound
  participant MIP as FHA MIP payable
  participant L as XRPL
  HO->>COL: PITI payment
  COL->>ENG: received_at (immutable), bank reference
  ENG->>ENG: planMonthlyApplication(): integer cents; received = P + I + tax + hazard + MIP + fees + suspense ± adj, else REFUSE
  ENG->>NH: remit principal + interest (fixed $2,770.73)
  ENG->>TAX: allocate tax
  ENG->>HAZ: allocate hazard
  ENG->>MIP: allocate MIP
  ENG->>L: four exact-cent Payments, one idempotency key, versioned memos
  L-->>ENG: validated hashes
  ENG->>ENG: reconcile: bank = subledger = ledger; page on difference
```

P&I is fixed for the life of a fixed-rate loan. Only the analysed escrow deposit changes, once per year (R02–R09). Batch is not live on Mainnet, so the four legs are independent transactions with one idempotency key and a compensating workflow; they are never described as atomic (S11).

Memo (versioned, ≤ 256 bytes):

```json
{"v":1,"loan":"<opaque>","period":"2026-11","leg":"tax","cents":28500,"run":"<uuid>"}
```

## 4. Impound release

```
verified bill (payee, amount, statutory due date)          ← never a forecast alone
        │
        ▼
projected balance at due date ≥ amount due?
        │ no ──► ServicerAdvance Payment (memo leg=advance), deficiency record (R10, R09)
        │ yes
        ▼
preflight: issuer allowTrustLineLocking = true (S5); destination on allowlist; FinishAfter from due date;
           CancelAfter = due + 45 d; recovery destination verified; dual approval
        │
        ▼
EscrowCreate (issued USD, full amount)  → object id + reserve recorded
        │
        ▼ on/after FinishAfter
EscrowFinish by authorised automation → bank initiates the real ACH/wire → payee receipt tracked as an exception until confirmed
```

Corrected bill after creation (FinishAfter is immutable, S7): increase → second escrow or advance; decrease → finish the original, refund the excess through the refund payable; both with recorded approval. Never more than the near-term set in flight (two tax halves, one hazard renewal); rolling 12–18 month forecast for everything else.

## 5. Annual escrow analysis (12 CFR 1024.17)

```
inputs: computation year; purpose balances; verified bill calendar (tax Dec 20 / Jun 20, hazard Sep 1, MIP monthly);
        cushion cap = min(1/6 annual, state cap, contract cap); delinquency; prior shortage/deficiency; CA interest
        │
        ▼
analyzeEscrowYear(): aggregate method → 12 trial balances → lowest → cushion → new monthly deposit
        │
        ├─ surplus  ≥ $50 & current → refund within 30 d   |  < $50 → refund or credit           (R07)
        ├─ shortage < 1 mo → 30 d or ≥12 equal months     |  ≥ 1 mo → ≥12 equal months           (R08)
        ├─ deficiency < 1 mo → 30 d or ≥2 equal months    |  ≥ 1 mo → ≥2 equal months            (R09)
        │
        ▼
immutable EscrowAnalysis version → new escrow deposit effective next cycle → annual statement within 30 d (R06)
California profile: 2 % simple interest accrued daily, credited annually (R23); 1099-INT when ≥ $10 (R30)
```

## 6. Form 1098 pipeline (R29)

`build1098(year)` joins receipt-dated applications, the amortization schedule, MIP/tax/hazard disbursements, corrections and any acquisition date. Box 1 = interest posted; Box 2 = principal at January 1; Box 3 = origination date; Box 4 = refunds of prior-year interest; Box 5 = MIP under an effective-dated reportability rule; Box 6 = points (origination year); Boxes 7–9 = property address (off-ledger only); Box 10 = taxes and insurance paid from escrow (optional); Box 11 = acquisition date only for an in-year acquisition. Filer of record is configuration, not assumption. Calendar: borrower copy January 31, paper February 28, e-file March 31, adjusted for non-business days.

## 7. Servicing transfer and 30-year operations

- Quarterly rolling forecast; annual analysis; daily bank-to-subledger reconciliation; each near-term bill creates, finishes or cancels one escrow object.
- Transfer: freeze discretionary work → reconcile cash and items → export complete records → §1024.33 notices (15 days) and 60-day misdirected-payment grace → cut over signer lists and tenant access → NFToken transferred by zero-price sell offer. A legal owner change is a separate event and triggers §1026.39 when applicable (R11, R18).
- Reserve per loan: three simultaneous escrows ≈ 0.6 XRP owner reserve plus 0.2 XRP for the NFToken page; base reserve on each bank account. Never 360 pre-created escrows (S7).

## 8. Key management and tenancy

- Production ledger accounts: HSM-held regular keys, `SignerListSet` 2-of-3 across bank-controlled roles (operations, compliance, treasury), transaction allowlists and limits, monitored sequence and tickets, emergency rotation runbook, `lsfDisableMaster` only after a recovery drill has been proven.
- Manila users never receive signing secrets; they submit tasks to dual-control queues (R27).
- Every Postgres row carries `company_id` and `loan_id`; queries are scoped by both; the tenant boundary is enforced in code and tested (Phase F).

## 9. Networks and assets

| Network | Endpoint | Use |
|---|---|---|
| Testnet | `wss://s.altnet.rippletest.net:51233`, explorer testnet.xrpl.org | production-shape proof: NFToken, issued-USD Payments, TokenEscrow |
| Devnet | `wss://s.devnet.rippletest.net:51233` | compressed CI smoke only; never cited as Mainnet proof |
| Mainnet | not touched by this repo | rippled 3.3.0; MPTokensV1, Credentials, PermissionedDomains, TokenEscrow, NonFungibleTokensV1_1 enabled; SingleAssetVault, LendingProtocol, DynamicMPT, BatchV1_1 disabled (feature RPC 2026-09-08) |

Settlement asset on Testnet is a controlled `USD` issuer created by this repo with `asfAllowTrustLineLocking` set before any trust line exists. RLUSD cannot be escrowed on Mainnet or Testnet today (`allowTrustLineLocking=false` on both issuers, checked 2026-09-08). The runtime preflight refuses to build an escrow when the flag is false (S5).

## 10. Deferred amendments

XLS-65 Single Asset Vault, XLS-66 Lending Protocol, DynamicMPT, Batch, Smart Escrows, XRPL EVM sidechain and Hooks are not used. See `docs/appendix-deferred-amendments.md` for the reason each was rejected and what would change the decision.

## 11. Regulatory control map → modules and tests

| Row | Requirement | Module | Test |
|---|---|---|---|
| R01 | 1024.17(b) escrow = servicing impound | `src/servicing/analysis.ts` `EscrowPurpose` guard | `R01_escrow_purpose` |
| R02 | 1024.17(c)(1)(i),(d) aggregate method | `analysis.ts` `analyzeEscrowYear` | `R02_aggregate_trial_balances` |
| R03 | 1024.17(c)(1)(ii) cushion ≤ min(1/6, state, contract) | `analysis.ts` `cushionLimit` | `R03_cushion_cap` (property) |
| R04 | 1024.17(c)(2) initial deposit enters subledgers | `src/servicing/boarding.ts` | `R04_initial_deposit` |
| R05 | 1024.17(g) initial statement ≤ 45 d | `statements.ts` `initialEscrowStatement` | `R05_initial_statement_deadline` |
| R06 | 1024.17(i) annual statement ≤ 30 d | `statements.ts` `annualEscrowStatement` | `R06_annual_statement_deadline` |
| R07 | 1024.17(f)(2) surplus | `analysis.ts` `resolveSurplus` | `R07_surplus_options` |
| R08 | 1024.17(f)(3) shortage | `analysis.ts` `shortageOptions` | `R08_shortage_options` |
| R09 | 1024.17(f)(4) deficiency | `analysis.ts` `deficiencyOptions` | `R09_deficiency_options` |
| R10 | 1024.17(k)(1) timely disbursement, advance | `disburse.ts` `ensureDisbursement` | `R10_advance_when_short` |
| R11 | 1024.33 transfer notices, 60-day grace | `transfer.ts` | `R11_transfer_notices` |
| R12 | 1024.35/.36 NOE and RFI | `cases.ts` | `R12_noe_rfi_clocks` |
| R13 | 1024.37 force-placed insurance | `cases.ts` | `R13_force_placed` |
| R14 | 1024.38 records, reconciliation | `reconcile.ts` | `R14_three_way_match` |
| R15 | 1024.39/.41 early intervention, loss mitigation | `cases.ts` | `R15_delinquency_state_machine` |
| R16 | 1026.36(c)(1) receipt-date credit | `apply.ts` | `R16_receipt_date_credit` |
| R17 | 1026.41 periodic statement | `statements.ts` `periodicStatement` | `R17_periodic_statement` |
| R18 | 1026.39 ownership notice | `transfer.ts` `ownershipTransfer` | `R18_ownership_notice` |
| R19 | 1026.3(a) consumer purpose | `src/ingest/canonical.ts` `credit_purpose` | `R19_consumer_purpose` |
| R20 | 24 CFR 203.25 late charge ≤ 4 % | `src/domain/loan-math.ts` `fhaLateCharge` | `R20_fha_late_charge` |
| R21 | ML 2023-05 UFMIP/MIP on base | `loan-math.ts` `fhaPremiums` | `R21_fha_premiums` |
| R22 | HUD 4000.1 custodial accounts | `reconcile.ts`, `docs/threat-model.md` | `R22_bank_balance_authoritative` |
| R23 | Cal. Civ. Code 2954.8 interest | `analysis.ts` `californiaInterest` | `R23_ca_interest` |
| R24 | Cal. Civ. Code 2954.85 loss draft | `boarding.ts` `LossDraftAccount` | `R24_loss_draft_separate` |
| R25 | Idaho 63-903 calendar; interest UNVERIFIED gate | `src/servicing/calendar.ts` | `R25_idaho_calendar_gate` |
| R26 | licensing registry gate | `boarding.ts` `authorityCheck` | `R26_license_gate` |
| R27 | CFPB 2016-02 vendor oversight | `docs/threat-model.md`, `src/xrpl/keys.ts` | `R27_no_operator_keys` |
| R28 | GLBA safeguards | `docs/threat-model.md`, Phase F scan | `R28_no_pii_payloads` |
| R29 | Form 1098 | `tax.ts` `build1098` | `R29_form_1098` |
| R30 | 1099-INT / 1099-A/C | `tax.ts` `build1099INT` | `R30_1099int_threshold` |
| R31 | no participation, no Reg D | schema: `legal_owner_id` only | `R31_no_participation_fields` |
