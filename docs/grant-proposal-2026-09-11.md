# MortgageOS™ Servicing Layer on the XRP Ledger

**Grant proposal to XRPL Grants** · High Tech Mortgage, Inc. (HTM) · Sacramento, California and Metro Manila, Philippines

Requested funding: **$200,000** · Program: **12 months** · Date: **September 11, 2026** · Supersedes the September 10, 2026 proposal

Repository: <https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm> (MIT, branch `v3`) · v3 Testnet evidence: `docs/evidence/v3/` · v2 Testnet demo (archived): <https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/demo/>

---

## 1. Executive summary

A residential mortgage is a thirty-year credit asset. The hard problem is not issuing a token; it is keeping the legal asset, its servicing data, its cash flows and its evidence trail consistent for decades across tax changes, servicing transfers and audits. Escrow mistakes, misapplied payments and late tax disbursements are the most common servicing failures and the most expensive to remediate.

HTM has built and published version 3.0.0 of the servicing layer of MortgageOS™. For each loan it keeps one **non-transferable record of account** on the XRP Ledger as a Multi-Purpose Token, collects the monthly payment and the tax and insurance impounds through **date-locked escrows**, amortizes the record every month so the on-ledger balance equals the outstanding principal in the servicer's books, and mirrors every ledger event into a PostgreSQL system of record with a full audit log. The XRP Ledger is used for what it does better than a private database: a record anyone can verify without seeing borrower data, exact-cent settlement events, and a native date lock that makes it impossible to release impound money before the day it is due.

Everything described as done in this proposal runs today on the XRP Ledger Testnet using only transaction types and amendments that are live on Mainnet. The grant funds the path from a proven ledger core to a controlled pilot with a bank: porting the v2 servicing controls (statements, annual aggregate analysis, case workflows, Form 1098) onto the v3 core, live custodial statements, a live property-tax bill source, production key management, counsel sign-off on the remaining legal questions, and an independent security review.

What this is not: the record of account is not the note and cannot be transferred, traded or sold; no interests in loans are sold; no capital is raised; and the ledger record does not replace the Note, the Deed of Trust, the lien, the county record, the bank's custodial accounts or the servicer's books.

## 2. Who we are and how we operate

High Tech Mortgage, Inc. is a licensed California mortgage broker (DFPI and DRE) with an operations centre in Manila. The loans are standard Fannie Mae uniform-instrument, fixed-rate, 30-year residential loans, funded and owned by banks we work with under contract.

HTM operates in one of two ways, and the software is the same in both:

- **Servicer of record for its own clients**, under its California licences, through a servicing entity kept separate from the brokerage.
- **Servicing-operations and technology contractor to a bank** that is itself the official servicer and keeps banking compliance and liability. Several lending banks have asked for exactly this arrangement.

The Manila team executes servicing tasks under dual control in both models and never holds signing keys.

## 3. What the ledger does, and does not do

| The ledger does | The ledger does not |
|---|---|
| Hold one record of account per loan: an MPT issuance whose supply is the principal in cents, whose metadata carries the loan-manifest hash and an IPFS CID slot, and whose flags allow lock, clawback and escrow but never transfer | Decide what the borrower owes; the servicer's books in the bank's custodial accounts are authoritative and the on-ledger balance is reconciled to them |
| Carry the outstanding principal as the servicer's balance of that record, reduced each month by an issuer clawback equal to the principal portion | Replace custodial accounts, cure a shortage, send statutory notices or satisfy any regulation by itself |
| Lock each month's P&I and impound legs under a TokenEscrow that cannot be finished before the due date, with the split and regulatory markers in the memo | Confer a licence, prove payee receipt, document validity or custody |
| Refuse payments from anyone not pre-authorized (`DepositAuth` on the issuer and the custodial accounts) and freeze the record while a period is unsettled | Carry borrower PII, ever |

## 4. What is already true

**v3.0.0 (September 11, 2026).** A Python engine on `xrpl-py` with a PostgreSQL mirror. Phase 1 boards a loan: DepositAuth and DepositPreauth on the issuer and both custodial accounts, the record-of-account MPT minted with flags `0x4e` (lock, require-auth, escrow, clawback; no transfer), the servicer authorized and delivered the principal, the issuance id proven equal between the ledger and the database. Phase 2 settles a period: the schedule is read from the database, the P&I and impound legs are escrowed with the split in the memo, the record is locked, the escrows finish on the due date with `tesSUCCESS`, the month's principal is clawed back and the on-ledger balance is proven equal to the database outstanding ($449,593.19 after month one on a $450,000 loan at 6.5 %). Phase 3 proves error triage: a forced ledger error (`tecPATH_PARTIAL`) and a forced network timeout are both caught, written to the audit log with the raw code and the full transaction envelope, and the engine exits cleanly. The live suite ends with an independent reconciliation sweep and 17 confirmed transactions per run.

**v2.0.0 (September 10, 2026, archived on `main`).** The prior TypeScript engine: OCR ingest of a 23-page synthetic closing package with cent-level tie-outs, the full RESPA / Regulation Z / FHA control map R01–R31 with 127 named tests, aggregate escrow analysis with the one-sixth cushion, statements, case workflows, servicing transfer, Form 1098, and a 108-transaction Testnet run with a 2-of-3 signer drill. It used an NFToken handle and issued-currency payments; v3 replaces those with the MPT record and TokenEscrow legs. Its servicing controls are the porting roadmap for the grant period, not a v3 feature.

**Cost.** About 90 ledger transactions per loan-year in v3 (two escrow creates, two finishes, one clawback, lock and unlock per month, plus boarding), fees under 0.01 XRP, refundable owner reserve for two MPToken objects and transient escrows.

## 5. Architecture

Five layers, with the legal layer untouched:

1. **Legal asset.** Note, deed of trust, lien, title, escrow and servicing obligations stay governed by law and authoritative registries.
2. **Bank custodial accounts and servicing books.** Legally authoritative balances.
3. **MortgageOS engine (this repository, `mortgageos/`).** PostgreSQL schema `mortgageos` as system of record: loans, issuances, every ledger transaction with its state, the payment schedule, escrow legs and the audit log; Python event loop that reads the schedule and drives the ledger; reconciliation sweep.
4. **XRP Ledger.** One record-of-account MPT per loan, DepositAuth-guarded custodial accounts, TokenEscrow settlement legs of a settlement MPT, issuer clawback for amortization, lock / unlock for control.
5. **Institutional interfaces.** Command line and database today; bank system integration during the grant.

Not used, and why: Hooks (not enabled on XRPL Mainnet or Testnet, verified on the Amendments object 2026-09-11; they run only on the Xahau sidechain, which has neither MPT nor TokenEscrow, so the on-chain payment firewall from the design notes is delivered by DepositAuth, DepositPreauth and off-chain enforcement instead), Smart Escrows (WASM devnet only), XLS-65 and XLS-66 (institutional vault lending, not servicing of an already-funded loan), NFTokens (replaced by the MPT record). The settlement asset on Testnet is a self-issued test USD MPT because RLUSD's issuers do not permit trust-line locking, so RLUSD cannot be escrowed.

## 6. Why this fits XRPL Grants

- **Multi-Purpose Tokens used as designed.** A non-transferable, lockable, clawback-able record with XLS-89d metadata, and a second MPT as the escrowable settlement asset: two of the newest Mainnet primitives exercised end to end with tests.
- **Institutional settlement.** Date-locked TokenEscrow legs with an exact-cent split in the memo, DepositAuth-guarded custodial accounts, and a reconciliation sweep between the ledger and the books, the pattern any regulated servicer needs before touching a ledger.
- **Open infrastructure.** MIT-licensed schema, memo format, builders and tests that any team can reuse for a regulated record-of-account on XRPL.
- **On-chain activity that means something.** Seven validated transactions per loan per month, every one traceable to a servicing obligation.

## 7. Twelve-month milestones

| ID | Months | Milestone | Evidence delivered |
|---|---|---|---|
| M1 | 1–2 | Counsel memos on California residential carve-outs, Idaho servicing posture and the custodial settlement asset; first bank servicing contract or LOI; production key-management runbook | memos in `docs/`, signed LOI, runbook |
| M2 | 2–4 | Port the v2 aggregate escrow analysis (cushion, surplus, shortage, deficiency) and statements onto the v3 core; property-tax bill source (tax-service feed plus county connectors) behind an operator verification gate; IPFS pinning of the loan manifest with the CID verified in the record | ported tests, verified-bill audit trail, CID checks |
| M3 | 4–7 | Live custodial statements and daily three-way reconciliation; 1024.35–.41 case workflows with SLA evidence; dual-control task queue for the Manila team | reconciliation reports, case fixtures, queue audit log |
| M4 | 6–9 | Production key management (HSM regular keys, 2-of-3 signer lists, rotation drills); settlement-asset decision with the RLUSD and institutional teams; Mainnet dry-run criteria | drill logs, decision record |
| M5 | 8–10 | Controlled pilot on real, redacted loan files with the contracting bank; Form 1098 season dry run; evidence packs delivered to the bank's examiner | pilot report, examiner feedback |
| M6 | 9–11 | Second-jurisdiction abstraction: the legal layer separated from the engine and mapped for the Manila servicing operation | jurisdiction matrix |
| M7 | 11–12 | Independent security review of the threat model; public technical paper; refreshed demo; Mainnet go/no-go | review notes, paper, video |

## 8. Targets and funding logic

Grant-period targets, not commercial commitments:

| By month 12 | Target |
|---|---|
| Boarded loan records (test and pilot) | 50 |
| Ledger transactions (Testnet and permitted production) | 5,000 |
| Servicing events (settlements, analyses, disbursements, statements, cases) | 1,200 |
| Counterparties engaged (banks, counsel, auditors, RLUSD/institutional team) | 4 |
| Reconciliation accuracy against benchmark cases | 99 %+ (deterministic today) |

| Checkpoint | Loan records | Ledger tx | Servicing events | Counterparties |
|---|---|---|---|---|
| Month 4 | 5 | 250 | 50 | 1 |
| Month 7 | 15 | 1,000 | 250 | 2 |
| Month 10 | 30 | 2,500 | 600 | 3 |
| Month 12 | 50 | 5,000 | 1,200 | 4 |

Funding gates: build and integration gates (M1–M3) 30 %, $60,000; usage and pilot gates (M4–M7) 70 %, $140,000.

## 9. Budget: $200,000

| Workstream | Amount | Purpose |
|---|---|---|
| XRPL settlement and evidence engineering | $60,000 | Production key management, settlement-asset integration, Mainnet dry-run tooling, evidence automation |
| Servicing and data engineering | $50,000 | Porting the v2 controls onto the v3 core, bank receipt integration, tax-bill source and verification gate, case workflows, statement PDFs, operator queue |
| Security and independent technical review | $25,000 | Threat-model review, key handling, access control, penetration test of the operator surface |
| Legal and regulatory | $25,000 | California residential carve-outs, Idaho posture, custodial asset, servicing contract |
| Document and AI ingestion | $15,000 | Porting the scanner pipeline, field extraction validation, IPFS manifest pinning |
| Pilot infrastructure and testing | $15,000 | Hosted rippled or API, controlled datasets, pilot execution |
| Developer documentation and open-source components | $7,000 | Reference implementation upkeep, technical paper, demo materials |
| Contingency | $3,000 | Unplanned integration and testing costs |

## 10. Team

All four people below are published, with photographs and credentials, at <https://hightechmortgage.com/about/>. Everything here is copied from that page.

**Rich Young, Founder, President and Lead Broker.** California DRE Broker's License #01106294; California Mortgage Broker NMLS #291547. Thirty-plus years in Bay Area real estate and mortgage work. Rich founded HighTechMortgage to apply modern digital-economy tools to real-estate facilitation and finance. On this project he owns the origination, servicing and compliance obligations the software models and is the licensed principal in both operating models.

**Dr Van Wilson, Data Science, AI and Blockchain Technology.** Twenty-plus years in data science, mostly in finance. He held a secret clearance while working for the U.S. Securities and Exchange Commission, where he built an AI model that turned previously unreadable legal submissions into structured data, and for Fannie Mae, where he built the financial-forecasting machine-learning model that answered whether borrowers would resume paying their mortgages after the COVID payment freeze and led the plan for its on-premises-to-cloud conversion. Earlier finance and data work includes a cloud migration that protected a billion dollars of transactions and a GAAP reporting product of more than five thousand accounting reports. Post-graduate degree in data science and AI from the Massachusetts Institute of Technology (2022); bachelor's degree, California State University, Fullerton. AWS Certified Developer; Databricks certified; Blockchain Training Alliance certified; Microsoft Certified Trainer; certified PostgreSQL, SQL Server and MySQL DBA; ERP certifications in Sage, QuickBooks and Microsoft NAV. A real-estate investor since 1998 with more than 120 closed transactions and a personally managed portfolio above $10 million across three U.S. states and two countries. On this project he designed the v3 ledger core and the v2 servicing engine, and wrote and reviews the code in this repository. LinkedIn: <https://linkedin.com/in/drvanwilson>.

**Trish Wilson (Maria Theresa Wilson), Real Estate, Finance and Philippine Operations.** Active licensed U.S. Realtor; Philippine Real Estate Broker, PRC 0024025; Certified Public Accountant (St. Paul University, Philippines, BA Accounting); International Certified Financial Consultant; life insurance agent; blockchain-certified agent; property and asset manager; former internal auditor at Philippine Airlines. She brings U.S. professional standards to Philippine property work, combining banking, airline sales management, corporate operations and cross-border consulting, and has advised businesses and investors on investment strategy, estate planning, tax and asset protection. On this project she leads the Manila servicing-operations team under dual control and performs the accounting review of the schedules and escrow analyses.

**Bill Thompson, Operations, IT and Business Management.** ITIL v4; Six Sigma Quality; CompTIA A+; TOPCIT; Practical Project Management; URAC; FranklinCovey Management; Ateneo Graduate School of Business; California State University, Dominguez Hills. Bill pairs hands-on technical depth with disciplined, process-driven execution, focused on process excellence, practical decision-making and building organisational trust across technical and business teams. On this project he owns operations, infrastructure and process discipline for the pilot, including the dual-control task queue.

## 11. What is not yet true, stated plainly

- No bank has signed a servicing contract yet; the operating assumptions are ours.
- No production stablecoin can be escrowed today; the settlement asset is an open decision with the RLUSD and institutional teams.
- California residential consumer-protection carve-outs and the Idaho servicing posture go to counsel before a live loan.
- Property-tax and hazard bills in the published runs are fixture values; production needs a live bill source behind an operator verification gate (milestone M2).
- The loan manifest is hashed into the record's metadata but not yet pinned to IPFS; the CID slot is filled by an operator step until a pinning service is on file (M2).
- v3 does not yet include the v2 statements, aggregate analysis with cushion, case workflows or Form 1098; they are archived on `main` and are ported during M2–M3.
- There is no borrower portal or operator web UI; the product surface today is the command line and the database.

## 12. Sustainability and ecosystem contribution

Post-grant revenue comes from servicing fees in the servicer-of-record model and from servicing-operations contracts with banks, with the ledger evidence layer priced as an add-on at $0.50 to $1.50 per loan per month. Everything in this repository stays open: the `mortgageos` schema, the record-of-account MPT pattern and metadata, the memo format, the transaction builders, the error-triage and audit-log contract, and the Testnet lessons any regulated team building on MPT and TokenEscrow will meet.

## 13. Submission positioning

MortgageOS is mortgage-servicing infrastructure with an XRPL evidence and settlement rail. We do not state or imply that an XRPL object replaces a deed, note, lien, title registry, escrow account or regulated servicing function; we do not promise liquidity, fractional trading or investor returns. Standard language: "MortgageOS uses the XRP Ledger to keep a non-transferable record of account per loan, exact-cent date-locked settlement events and an audit trail. The legally enforceable mortgage, lien, title and property records remain governed by applicable law and authoritative registries."

## 14. Sources and evidence

- Repository, README and v3 architecture: <https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm> (branch `v3`, `docs/v3-architecture.md`)
- v3 Testnet evidence: `docs/evidence/v3/` (loan, issuance ids, transaction hashes, audit rows)
- v2 archive: `docs/architecture.md`, `docs/testnet-run.md`, `docs/evidence/run-mtvzvtnk/`, demo <https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/demo/>
- XRPL Grants: <https://xrplgrants.org>; XRPL feature state verified 2026-09-11 on the Amendments ledger object (Testnet: MPTokensV1, TokenEscrow, Credentials, PermissionedDomains, Clawback enabled; Hooks, SmartEscrow, DynamicMPT not enabled)
