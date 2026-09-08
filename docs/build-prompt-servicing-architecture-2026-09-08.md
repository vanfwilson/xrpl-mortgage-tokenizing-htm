# Build prompt: mortgage-servicing "smart contract" architecture on the XRP Ledger

Date: 2026-09-08. Baseline commit: 94cf71d. Inputs merged: `docs/xrpl-servicing-research-audit-design-2026-09-08.md` (Codex, verified research), `docs/servicing-research-2026-09-08.md` and `docs/audit-2026-09-08-fable.md` (Fable 5.1). Where the two disagreed, the Codex corrections were re-verified on 2026-09-08 and adopted (see "Facts re-verified today").

Intended executor: a coding model with repository write access, a shell, and Testnet connectivity (Claude Fable 5.1 in Claude Code, or Codex). Effort levels use the five-tier scale low / medium / high / xhigh / max; set the stated level before each phase.

---

```
EFFORT: read this whole prompt at max before doing anything.

WHO WE ARE AND WHAT WE ARE BUILDING
High Tech Mortgage, Inc. (HTM) is a licensed California mortgage broker with
an operations centre in Manila. We originate standard Fannie Mae uniform-
instrument, fixed-rate, 30-year residential purchase loans (the fixture is FHA-
insured, Idaho property) that are funded and owned by banks we work with under
contract. We do not raise capital, sell participations, or run a lending pool.
A bank-owned licensed subservicer is servicer of record; HTM is the technology
provider and its Manila team executes servicing tasks as the subservicer's
vendor under dual control. Our "smart contract" is the mechanism that services
one such loan for 30 years after close of escrow: receive the monthly payment,
apply it to the cent, remit P&I to the note-holding bank, reserve tax and
insurance, pay the county and the carrier on their statutory dates, run the
annual escrow analysis (cushion, surplus, shortage, deficiency), advance
shortfalls, and produce borrower statements and IRS Form 1098 data. The
closing escrow run by the title company is out of scope.

REPOSITORY AND READING ORDER
/Volumes/BackupPlus/VideoLab/repos/xrpl-mortgage-tokenizing-htm at 94cf71d
(public: github.com/vanfwilson/xrpl-mortgage-tokenizing-htm). Read, in order:
  docs/xrpl-servicing-research-audit-design-2026-09-08.md  (authoritative)
  docs/servicing-research-2026-09-08.md
  docs/audit-2026-09-08-fable.md
  docs/grant-proposal-2026-08-24.pdf (7 pages; the Layer 1-5 architecture)
  data/documents/*.json, forms/closing-package-stack.pdf (the loan)
  src/ (all), tests/ (all), db/*.sql
The current code implements a different business (investor vault + XLS-66
warehouse loan + participation MPT). It is being replaced, not patched.

SETTLED DECISIONS (do not re-open; each was verified on 2026-09-08)
S1. Route: XRPL native Payment + TokenEscrow as a reconciled settlement and
    date-lock rail, driven by an off-ledger servicing engine that is the
    regulatory and accounting authority. The bank subservicer's custodial
    accounts and servicing books are legally authoritative; the ledger is
    evidence and enforcement of a date lock on a settlement token, never the
    HUD custodial account and never borrower money until the bank and counsel
    approve a production deposit token.
S2. Loan record: one XLS-20 NFToken per loan, minted by the bank servicing
    account, URI (<= 256 bytes) carrying only {schema, version, opaque
    loan_id, canonical bundle sha256, content-addressed pointer}. No economic
    rights, no principal units. Transferred by zero-price sell offer on
    servicing transfer. Token transfer is never a legal ownership transfer;
    ownership changes are separate events.
S3. Removed: XLS-65 vault, XLS-66 LoanBroker/LoanSet/LoanPay/LoanManage,
    investor and KYC wallets, Credentials, PermissionedDomains, the 45,000,000-
    unit participation MPT, the 60/40 distribution, usdPerXrp scaling.
    Not used: DynamicMPT, Batch, Smart Escrows/XLS-100, XRPL EVM sidechain,
    Hooks. Keep docs/appendix-deferred-amendments.md explaining each.
S4. Networks: Testnet (wss://s.altnet.rippletest.net:51233, explorer
    testnet.xrpl.org) proves Mainnet-shape behaviour; Devnet only for a
    compressed CI smoke run and is never cited as Mainnet proof. Mainnet and
    Testnet both run rippled 3.3.0 with MPTokensV1, Credentials,
    PermissionedDomains, TokenEscrow, fixTokenEscrowV1, NonFungibleTokensV1_1
    enabled and SingleAssetVault, LendingProtocol, DynamicMPT, BatchV1_1
    disabled (feature RPC, 2026-09-08). Reserve: 1 XRP base + 0.2 XRP per
    owned object; 10-drop minimum fee.
S5. Settlement asset: RLUSD cannot be escrowed today. account_info on
    2026-09-08 shows allowTrustLineLocking=false for the Mainnet issuer
    rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De and the Testnet issuer
    rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV. Use a controlled Testnet USD issuer
    that sets asfAllowTrustLineLocking BEFORE any trust line exists. Preflight
    the issuer flag at runtime and refuse to build an escrow if it is false.
    Label the asset "test USD"; never call it RLUSD, a deposit, or borrower
    funds.
S6. Libraries: xrpl.js 5.1.0 (Node >= 20.19) is sufficient for Payment,
    NFTokenMint/CreateOffer/AcceptOffer, TrustSet, AccountSet, EscrowCreate/
    Finish/Cancel with issued-currency amounts. Do not upgrade without a
    changelog check. Python twin (extras/) on xrpl-py 5.1.0 or delete it.
S7. Escrow economics: never pre-create 360 escrows (~72 XRP reserve, immutable
    dates). Keep a rolling 12-18 month forecast; create one TokenEscrow only
    for a verified near-term bill (normally two tax halves and one hazard
    renewal in flight), fully funded, with a bounded CancelAfter and a verified
    recovery destination. FinishAfter is uint32 Ripple epoch (ceiling
    2136-02-07) and cannot be amended: a corrected bill after creation is
    handled by an adjustment escrow or advance (increase) or by finishing the
    lawful amount and refunding the excess (decrease), with recorded approval.
S8. FHA MIP is NOT part of the annual hazard bucket. It is a monthly HUD
    remittance from its own payable. The three impound-side buckets are
    tax, hazard insurance, and MIP; P&I is a fourth leg to the note holder.
S9. P&I is the note's fixed amount for the life of the loan ($2,770.73 on
    the fixture). Only the analysed escrow deposit changes, once a year.
S10. Privacy: no memo, token, account name or Data field ever contains a
    name, address, SSN, APN, county account number, policy number or FHA case
    number. Memo JSON, versioned, <= 256 bytes:
    {"v":1,"loan":"<opaque>","period":"YYYY-MM","leg":"tax","cents":28500,
     "run":"<uuid>"}.
S11. Batch is not live, so the monthly legs are independent transactions
    submitted with one idempotency key and a compensating/reconciliation
    workflow. Never describe them as atomic.
S12. Time: public networks cannot advance the clock. The auditable full-year
    demo is a deterministic replay with an injected business clock, plus a
    Testnet run in which statutory dates are mapped to near-future timestamps
    under a published mapping manifest. A literal 12-month Testnet run is an
    optional endurance test, not the proof.

FACTS RE-VERIFIED TODAY (2026-09-08) THAT CORRECT EARLIER DOCUMENTS
- 12 CFR 1024.17(f)(4) deficiency: under one month's escrow payment -> do
  nothing, repay within 30 days, or 2+ equal monthly payments; one month or
  more -> do nothing or 2+ equal monthly payments. (Not "12 months".)
- 12 CFR 1024.17(f)(3) shortage: under one month -> do nothing, 30 days, or
  equal payments over at least 12 months; one month or more -> do nothing or
  at least 12 months.
- 12 CFR 1024.17(g): initial escrow statement at settlement OR within 45
  calendar days of settlement.
- 12 CFR 1024.17(c)(1)(ii): cushion no greater than one-sixth of estimated
  total annual payments from the account (or lower state/contract limit).
- 12 CFR 1024.17(k)(1): servicer pays disbursements timely as long as the
  borrower's payment is not more than 30 days overdue.
- Cal. Civ. Code 2954.8: 2 % simple interest on ordinary impounds, credited
  at least annually. AB 493 (2025) created a separate loss-draft rule
  (2954.85); it is not a general amendment to premium impounds.
- Credentials activated on Mainnet 2025-09-04 (per Codex; live RPC confirms
  enabled), PermissionedDomains 2026-02-04, TokenEscrow 2026-02-12,
  MPTokensV1 2025-10-01.
- Form 1098: first recipient of the interest files; $600 per mortgage; Box 2
  is Jan 1 principal; Box 5 depends on current statutory reportability of
  MIP, not merely the $600 amount; Box 10 optional; Box 11 only for an
  in-year acquisition; borrower copy Jan 31, paper Feb 28, e-file Mar 31
  (adjusted for non-business days).
- Idaho Code 63-903: full or first half due Dec 20; second half by Jun 20.
  Idaho interest-on-escrow requirement: UNVERIFIED; block the Idaho
  production profile behind a counsel flag.

REGULATORY CONTROL MAP (every row becomes a function, a data structure and
a test; cite the row id in the code comment and the test name)
 R01 1024.17(b)   escrow = servicing impound; reject closing-escrow purposes
 R02 1024.17(c)(1)(i),(d) aggregate method, month-by-month trial balances
 R03 1024.17(c)(1)(ii) cushion <= min(1/6 annual, state cap, contract cap)
 R04 1024.17(c)(2) initial deposit from the Closing Disclosure enters the
                 tax/hazard subledgers on day one
 R05 1024.17(g)  initial statement at settlement or within 45 days
 R06 1024.17(i)  annual statement within 30 days of computation year end
 R07 1024.17(f)(2) surplus >= $50 & current -> refund in 30 days; < $50 ->
                 refund or credit
 R08 1024.17(f)(3) shortage options exactly as above
 R09 1024.17(f)(4) deficiency options exactly as above
 R10 1024.17(k)(1) timely disbursement; ServicerAdvance path mandatory
 R11 1024.33     servicing-transfer notices, 60-day misdirected-payment grace
 R12 1024.35/.36 notice-of-error and information-request cases with SLA clocks
 R13 1024.37     force-placed insurance notices and refunds
 R14 1024.38     policies, records, reconciliation, transfer data
 R15 1024.39/.41 early intervention and loss-mitigation state machine
 R16 1026.36(c)(1) credit as of receipt date; suspense/partial rules
 R17 1026.41     periodic statement content
 R18 1026.39     ownership-transfer notice; partial-interest exception narrow
 R19 1026.3(a)   consumer purpose; business-credit exemption unavailable
 R20 24 CFR 203.25 FHA late charge <= 4 % after 15 days ($110.83 on fixture)
 R21 HUD ML 2023-05 UFMIP 1.75 % of BASE ($442,125 -> $7,737.19); annual
                 MIP on base/LTV/term table
 R22 HUD 4000.1 III custodial accounts; stablecoin is never sole custody;
                 daily bank reconciliation
 R23 Civ. Code 2954.8 CA 2 % impound interest, daily accrual, annual credit
 R24 Civ. Code 2954.85 separate LossDraftAccount (never merged with impounds)
 R25 Idaho 63-903 Dec 20 / Jun 20 calendar; interest rule UNVERIFIED gate
 R26 CA DFPI CRMLA / Idaho licensing registry; boarding blocked if authority
                 missing or expired
 R27 CFPB Bulletin 2016-02 vendor oversight; Manila access review evidence
 R28 GLBA Safeguards: RBAC, encryption, MFA, logging, vendor controls
 R29 IRS 1098 boxes 1-11 with effective-dated tax rules; calendar
 R30 IRS 1099-INT (CA interest >= $10); 1099-A/C handoff flags only
 R31 No participation, no Reg D, no ASC 860 allocation; legal_owner_id only

PHASES, EFFORT AND DEFINITION OF DONE

PHASE A - ARCHITECTURE DOCUMENT (effort: xhigh)
Write docs/architecture.md (replace) containing: trust boundary (bank
authoritative, ledger evidence); object/ownership table (Loan,
LoanDocumentVersion, NFToken, collection account, note-holder payable, tax
impound, hazard impound, MIP payable, advance account, refund payable,
EscrowAnalysis, XRPL test-USD accounts, ReconciliationEvent); monthly
sequence diagram; impound-release procedure incl. corrected-bill handling;
annual analysis flow; 1098 flow; servicing-transfer procedure; key
management (HSM regular keys, 2-of-3 SignerList across bank roles,
lsfDisableMaster only after recovery drill; Manila users never hold keys);
tenant isolation (company_id, loan_id on every row); and the R01-R31 map to
modules. DONE when a reviewer can trace every R-row to a module and a test
name without reading code.

PHASE B - FIXTURE CORRECTION (effort: high)
Replace Fannie 3200/3013 labels with FHA model note / FHA security
instrument; late charge 4 % / 15 days; UFMIP 1.75 % of base; total financed
$449,862.19 (or re-base so total is $450,000.00 - pick one and state it);
annual MIP on base with the term/LTV table; LTV = base / lesser of price and
appraisal; MIP separated from hazard in the CD escrow block; regenerate the
canonical record, every tie-out in src/ingest/canonical.ts, the 23-page
package, consistency tests. DONE when npm run ingest and npm test pass with
the new numbers and grep finds no "5 %", "138.54", "7,875", "3200", "3013"
in data/, forms/, README.md.

PHASE C - SERVICING ENGINE (effort: max for escrow-analysis and payment-
application math; high elsewhere). src/servicing/ modules:
  apply.ts        planMonthlyApplication(): integer cents; received =
                  principal + interest + tax + hazard + mip + fees + suspense
                  +- adjustments or refuse; received_at immutable; suspense,
                  partial, reversal, weekend/cutoff cases (R16)
  analysis.ts     analyzeEscrowYear(): aggregate method, lowest balance,
                  cushion cap, new monthly deposit, surplus/shortage/
                  deficiency classification returning ONLY permitted options
                  (R02,R03,R07,R08,R09); CA interest accrual (R23)
  disburse.ts     ensureDisbursement(): verified bill -> funded? -> advance
                  first if required (R10) -> escrow build request; corrected-
                  bill branches (S7)
  statements.ts   initial, annual, periodic statement JSON + PDF (R05,R06,R17)
  transfer.ts     ServicingTransferCase, OwnershipTransfer (R11,R18)
  cases.ts        NoticeOfError, InformationRequest, ForcePlaced, EarlyInter-
                  vention/LossMitigation state machines with SLA clocks
                  (R12,R13,R15) - minimal but real, not stubs
  tax.ts          build1098(year), build1099INT(year) with effective-dated
                  rules and the filing calendar (R29,R30)
  reconcile.ts    bank = servicing = ledger three-way match; unresolved
                  differences raise (R14,R22)
Postgres: extend db/ with the subledgers above; company_id + loan_id on every
table; append-only event log with hash anchor. DONE when property tests
prove integer-cent conservation for 360 periods, CFPB-style aggregate
fixtures reproduce every projected balance, and every R-row has a passing
test named R<nn>_*.

PHASE D - LEDGER ADAPTER (effort: xhigh). src/xrpl/:
  issuer.ts       Testnet test-USD issuer bootstrap: AccountSet
                  asfAllowTrustLineLocking before any TrustSet; preflight
                  check that refuses escrow builds when false (S5)
  record.ts       NFTokenMint per loan with the S2 URI; zero-price offer
                  transfer on servicing transfer
  settle.ts       exact-cent issued-currency Payment per leg with S10 memo
                  and idempotency key; independent submission with
                  compensation (S11)
  escrow.ts       EscrowCreate (issued currency, FinishAfter from the
                  verified due date, bounded CancelAfter, allowlisted
                  Destination), EscrowFinish after the date, EscrowCancel
                  path; reserve accounting per object (S7)
  keys.ts         SignerListSet 2-of-3, RegularKey, lsfDisableMaster drill
DONE when every function has a Testnet transaction hash in
docs/testnet-run.md and the issuer-lock preflight is exercised in a test
that expects refusal.

PHASE E - FULL LOAN-YEAR PROOF (effort: xhigh)
Track 1 deterministic replay (injected clock): 12 receipts, initial deposit,
Dec 20 and Jun 20 tax halves, Sep 1 hazard renewal, monthly MIP, one annual
analysis with a surplus case and a shortage case, CA profile with 2 %
interest and a 1099-INT trigger, 1098 with every box, one servicing
transfer, one corrected-bill event, one advance.
Track 2 Testnet (timestamp-mapped): NFToken mint, 12 x 4 Payments, three
TokenEscrows created and finished, one cancelled, one NFToken transfer;
mapping manifest published.
Track 3 Devnet compressed smoke for CI.
DONE when docs/testnet-run.md links every hash, docs/escrow-analysis-
example.md shows both cases reconciled to the cent, docs/form-1098-
example.json reconciles Box 1 to posted interest and Box 2 to Jan 1
principal, and T1-T12 below pass.

PHASE F - SECURITY AND PRIVACY (effort: xhigh)
Schema scan proving no PII field can reach a memo/URI/Data (S10); tenant-
isolation tests; signer-threshold tests; key-rotation and incident runbook;
threat model rewritten for the servicing design (replace docs/threat-model.md).
DONE when a grep of all ledger-bound payload builders for name/address/apn/
ssn/policy/case fields returns nothing and the tests enforce it.

PHASE G - DOCUMENTATION AND GRANT ALIGNMENT (effort: high for README and
grant narrative; medium for glossary and walkthrough)
Rewrite README.md, GLOSSARY.md, WALKTHROUGH.md, docs/grant-narrative.md,
docs/standards-mapping.md around the servicing-only design; compliance
section lists R01-R31 with the explicit non-guarantees (a ledger tx is not
proof of legal compliance, payee receipt, document validity, servicing
authority, or custody); grant narrative maps to the XRPL Grants rubric
(team, problem, XRPL alignment, code quality, roadmap, utility, traction,
sustainability) and carries the UNVERIFIED list verbatim: HTM licence scope
and MSR treatment; bank-subservicer contract; production stablecoin custody;
Idaho interest rule; bank acceptance of ledger evidence; traction metrics.
DONE when grep -ri "vault\|LoanSet\|LoanPay\|investor\|accredited\|
participation\|private_credit\|Reg D\|RLUSD escrow" over README.md GLOSSARY.md
WALKTHROUGH.md docs/ src/ returns only docs/appendix-deferred-amendments.md
and the two audit files.

TESTS TO REPORT (PASS/FAIL with evidence)
 T1  Four-leg application equals receipt to the cent for all 12 periods and
     for a 360-period property run.
 T2  Tax escrow is NOT created after two receipts; advance is created when the
     bill is due and short (R10); escrow IS created when funded.
 T3  Cushion never exceeds min(1/6 annual, state cap, contract cap) under
     property testing (R03).
 T4  Surplus $49.99 vs $50.00, current vs delinquent -> correct option (R07).
 T5  Shortage and deficiency option sets match (f)(3)/(f)(4) exactly at the
     one-month boundary (R08,R09).
 T6  Initial statement on day 45 passes, day 46 alerts; annual on day 30
     passes, day 31 alerts (R05,R06).
 T7  CA profile: 2 % daily accrual with leap year and payoff proration;
     1099-INT at $10.00 not $9.99 (R23,R30).
 T8  1098: Box 1 == posted interest; Box 2 == Jan 1 principal; Box 11 only on
     in-year acquisition; Box 5 governed by an effective-dated rule (R29).
 T9  Issuer-lock preflight refuses escrow when allowTrustLineLocking=false;
     succeeds on the controlled issuer (S5).
 T10 EscrowFinish before FinishAfter fails on Testnet (tecNO_PERMISSION or
     equivalent); succeeds after; CancelAfter path returns funds to the
     allowlisted recovery account (S7).
 T11 No ledger-bound payload contains PII; NFToken URI <= 256 bytes and
     carries the bundle sha256 (S2,S10).
 T12 Fixture: late charge == round2(0.04 x 2770.73) == 110.83; UFMIP ==
     round2(0.0175 x 442125) == 7737.19; grace == 15 (R20,R21).

STOP CONDITIONS
Do not push to GitHub. Do not touch Mainnet. Do not create escrows on any
network with an asset whose issuer has not enabled trust-line locking. Stop
after Phase E and report: T1-T12, the R01-R31 coverage table (module + test
per row), the Testnet hash list, the reserve consumed per loan, and the
status (FIXED / OBSOLETE / WON'T-FIX + reason) of every finding in
docs/audit-2026-09-08-fable.md and in the Codex Phase 1 table. A second
model reviews the diff before commit.
```
