# MortgageOS™ Servicing Layer on the XRP Ledger

**Grant proposal to XRPL Grants** · High Tech Mortgage, Inc. (HTM) · Sacramento, California and Metro Manila, Philippines

Requested funding: **$200,000** · Program: **12 months** · Date: **September 10, 2026** · Supersedes the August 24, 2026 proposal

Repository: <https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm> (MIT) · Live Testnet demo: <https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/demo/> · Evidence pack: `docs/evidence/run-mtvzvtnk/`

---

## 1. Executive summary

A residential mortgage is a thirty-year credit asset. The hard problem is not issuing a token; it is keeping the legal asset, its servicing data, its cash flows and its evidence trail consistent for decades across tax changes, servicing transfers and audits. Escrow mistakes, misapplied payments and late tax disbursements are the most common servicing failures and the most expensive to remediate.

HTM has built and published version 2.0.0 of the servicing layer of MortgageOS™: software that takes the paper closing package a title company hands over, reads it, ties every figure out to the cent, boards the loan, and then does what a servicer does every month for thirty years, with the regulatory controls implemented as code and a named automated test for each one. The XRP Ledger is used for three things it does better than a private database: an immutable fingerprint of the loan file, exact-cent settlement events anyone can reconcile without seeing borrower data, and a native date lock that makes it impossible to release impound money before the day it is due.

Everything described as done in this proposal runs today on the XRP Ledger Testnet using only transaction types that are live on Mainnet. The grant funds the path from a proven engine to a controlled pilot with a bank: live custodial statements, a live property-tax bill source, production key management, counsel sign-off on the remaining legal questions, and an independent security review.

What this is not: the note is not tokenized, no interests in loans are sold, no capital is raised, and the ledger record does not replace the Note, the Deed of Trust, the lien, the county record, the bank's custodial accounts or the servicer's books.

## 2. Who we are and how we operate

High Tech Mortgage, Inc. is a licensed California mortgage broker (DFPI and DRE) with an operations centre in Manila. The loans are standard Fannie Mae uniform-instrument, fixed-rate, 30-year residential loans, funded and owned by banks we work with under contract. The fixture in the repository is FHA-insured on an Idaho property.

HTM operates in one of two ways, and the software is the same in both:

- **Servicer of record for its own clients**, under its California licences, through a servicing entity kept separate from the brokerage.
- **Servicing-operations and technology contractor to a bank** that is itself the official servicer and keeps banking compliance and liability. Several lending banks have asked for exactly this arrangement.

The Manila team executes servicing tasks under dual control in both models and never holds signing keys.

## 3. What the ledger does, and does not do

| The ledger does | The ledger does not |
|---|---|
| Fingerprint the loan file: one NFToken per loan whose URI carries only a version, an opaque loan id, the SHA-256 of the closing bundle and a pointer | Decide what the borrower owes; the servicer's books in the bank's custodial accounts are authoritative |
| Record every settlement leg to the cent as an issued-USD Payment with a six-key memo and no personal data | Replace custodial accounts, cure a shortage, send statutory notices or satisfy any regulation by itself |
| Lock each verified impound bill under a TokenEscrow that cannot be finished before its statutory date | Confer a licence, prove payee receipt, document validity or custody |
| Prove servicing hand-offs (NFToken transfer by zero-price offer) and key-management drills | Carry borrower PII, ever |

## 4. What is already true (v2.0.0, September 10, 2026)

**Paper in.** The 23-page synthetic closing package (Closing Disclosure, FHA Note, FHA Idaho Deed of Trust, Warranty Deed and supporting forms) is printed, scanned and read by OCR into a canonical loan record. Every figure is cross-checked: P&I must match rate and term ($2,770.73), base loan plus financed UFMIP must equal the note ($442,260.44 + $7,739.56 = $450,000.00), cash to close must balance, the FHA late charge may not exceed 4 % ($110.83), and the four payment legs must sum to the monthly payment ($3,365.01). If anything disagrees, the run stops.

**Servicing engine.** Receipt-date payment application (Regulation Z 1026.36(c)); aggregate escrow analysis under 12 CFR 1024.17 with the one-sixth cushion cap and the exact (f)(2) surplus, (f)(3) shortage and (f)(4) deficiency options; advance-first disbursement so a verified bill is always paid on time (1024.17(k)); initial and annual escrow statements with deadline clocks and delivery evidence; periodic statements (1026.41); notice-of-error, information-request, force-placed-insurance, early-intervention and loss-mitigation state machines with evidence; servicing-transfer notices and the 60-day misdirected-payment grace (1024.33) with a hashed nine-record transfer manifest; ownership-transfer notice (1026.39); FHA premiums on the base loan (HUD ML 2023-05); California impound interest (Civil Code 2954.8); Form 1098 and 1099-INT. The regulatory control map R01–R31 is implemented row by row with a named test per row: **127 offline tests**.

**Settlement safety.** Every ledger leg is signed once, journaled with its hash and fingerprint before submission, and re-used on retry; it is never re-signed, so a crash or timeout cannot double-pay. Business events are appended to a hash-chained, append-only log. The bank side of the reconciliation is a documented receipt-file contract, parsed strictly, and matched three ways against the subledger and the ledger.

**Testnet proof (run `run-mtvzvtnk`, September 10, 2026).** 108 ledger transactions; 75 settlement legs, all journaled as validated; three impound escrows created and finished on their mapped statutory dates; one corrected-bill escrow cancelled after its window; an early-finish attempt refused by the ledger (`tecNO_PERMISSION`); the NFToken handed to the successor servicer; a 2-of-3 multisig drill (one signature refused with `tefBAD_QUORUM`, two validate); the master key disabled and refused thereafter. The bank, subledger and ledger agree on all 75 legs. An examiner evidence pack with a SHA-256 manifest is committed with the run.

**Cost.** Ledger cost per loan-year in production is about 0.8 XRP of refundable owner reserve and under 0.005 XRP of fees; all-in under $0.35 per loan per month at $5 per XRP (`docs/cost-model.md`).

## 5. Architecture

Five layers, with the legal layer untouched:

1. **Legal asset.** Note, deed of trust, lien, title, escrow and servicing obligations stay governed by law and authoritative registries.
2. **Bank custodial accounts and servicing books.** Legally authoritative balances; daily receipt export in the documented file contract.
3. **MortgageOS servicing engine (this repository).** Postgres system of record for documents, schedule and subledgers; the engine applies payments, runs the annual analysis, builds statements, tax data and cases; Manila operators submit tasks to dual-control queues.
4. **XRP Ledger.** Issued-USD Payment legs, one NFToken record per loan, TokenEscrow date locks, bank-controlled 2-of-3 signer lists.
5. **Institutional interfaces.** Command line and evidence pack today; bank system integration during the grant.

Not used, and why: XLS-65 and XLS-66 (funding protocols for new loans, not on Mainnet, cannot represent an already-funded loan), MPT for the note (a note is not units of supply), DynamicMPT, Batch, Smart Escrows, the EVM sidechain and Hooks. The settlement asset on Testnet is a controlled test USD because RLUSD's issuers do not permit trust-line locking; the code refuses to build an escrow when the issuer flag is off.

## 6. Why this fits XRPL Grants

- **Payments and institutional settlement.** Exact-cent issued-currency legs with idempotent signing and three-way reconciliation, the pattern any regulated servicer needs before touching a ledger.
- **Real-world assets, done the way a bank can adopt.** A per-loan record handle with an operative-document hash chain, designed so nothing legally authoritative changes.
- **Open infrastructure.** MIT-licensed schemas and tests: the canonical loan record, the 1024.17 analysis, the subledger, the memo format, the receipt-file contract, the evidence pack, and R01–R31 as reusable compliance tests.
- **On-chain activity that means something.** Six validated transactions per loan per month, every one traceable to a regulatory obligation.

## 7. Twelve-month milestones

| ID | Months | Milestone | Evidence delivered |
|---|---|---|---|
| M1 | 1–2 | Counsel memos on California residential carve-outs, Idaho servicing posture and the custodial settlement asset; first bank servicing contract or LOI; production key-management runbook | memos in `docs/`, signed LOI, runbook |
| M2 | 2–4 | Live custodial statements through the bank receipt-file contract; daily three-way reconciliation; property-tax bill source (tax-service feed plus county connectors) behind an operator verification gate | reconciliation reports, verified-bill audit trail |
| M3 | 4–7 | Full 1024.35–.41 case workflows with SLA evidence; periodic statement PDFs with delivery evidence; dual-control task queue for the Manila team | case fixtures, golden PDFs, queue audit log |
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
| Servicing events (applications, analyses, disbursements, statements, cases) | 1,200 |
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
| XRPL settlement and evidence engineering | $60,000 | Production key management, settlement-asset integration, Mainnet dry-run tooling, evidence pack automation |
| Servicing and data engineering | $50,000 | Bank receipt integration, tax-bill source and verification gate, case workflows, statement PDFs, operator queue |
| Security and independent technical review | $25,000 | Threat-model review, key handling, access control, penetration test of the operator surface |
| Legal and regulatory | $25,000 | California residential carve-outs, Idaho posture, custodial asset, servicing contract |
| Document and AI ingestion | $15,000 | Scanner pipeline hardening, field extraction validation, anomaly flags |
| Pilot infrastructure and testing | $15,000 | Hosted rippled or API, controlled datasets, pilot execution |
| Developer documentation and open-source components | $7,000 | Reference implementation upkeep, technical paper, demo materials |
| Contingency | $3,000 | Unplanned integration and testing costs |

## 10. Team

All four people below are published, with photographs and credentials, at <https://hightechmortgage.com/about/>. Everything here is copied from that page.

**Rich Young, Founder, President and Lead Broker.** California DRE Broker's License #01106294; California Mortgage Broker NMLS #291547. Thirty-plus years in Bay Area real estate and mortgage work. Rich founded HighTechMortgage to apply modern digital-economy tools to real-estate facilitation and finance. On this project he owns the origination, servicing and compliance obligations the software models and is the licensed principal in both operating models.

**Dr Van Wilson, Data Science, AI and Blockchain Technology.** Twenty-plus years in data science, mostly in finance. He held a secret clearance while working for the U.S. Securities and Exchange Commission, where he built an AI model that turned previously unreadable legal submissions into structured data, and for Fannie Mae, where he built the financial-forecasting machine-learning model that answered whether borrowers would resume paying their mortgages after the COVID payment freeze and led the plan for its on-premises-to-cloud conversion. Earlier finance and data work includes a cloud migration that protected a billion dollars of transactions and a GAAP reporting product of more than five thousand accounting reports. Post-graduate degree in data science and AI from the Massachusetts Institute of Technology (2022); bachelor's degree, California State University, Fullerton. AWS Certified Developer; Databricks certified; Blockchain Training Alliance certified; Microsoft Certified Trainer; certified PostgreSQL, SQL Server and MySQL DBA; ERP certifications in Sage, QuickBooks and Microsoft NAV. A real-estate investor since 1998 with more than 120 closed transactions and a personally managed portfolio above $10 million across three U.S. states and two countries. On this project he designed the servicing engine, the settlement journal and the ledger adapter, and wrote and reviews the code in this repository. LinkedIn: <https://linkedin.com/in/drvanwilson>.

**Trish Wilson (Maria Theresa Wilson), Real Estate, Finance and Philippine Operations.** Active licensed U.S. Realtor; Philippine Real Estate Broker, PRC 0024025; Certified Public Accountant (St. Paul University, Philippines, BA Accounting); International Certified Financial Consultant; life insurance agent; blockchain-certified agent; property and asset manager; former internal auditor at Philippine Airlines. She brings U.S. professional standards to Philippine property work, combining banking, airline sales management, corporate operations and cross-border consulting, and has advised businesses and investors on investment strategy, estate planning, tax and asset protection. On this project she leads the Manila servicing-operations team under dual control and performs the accounting review of the tie-outs and escrow analyses.

**Bill Thompson, Operations, IT and Business Management.** ITIL v4; Six Sigma Quality; CompTIA A+; TOPCIT; Practical Project Management; URAC; FranklinCovey Management; Ateneo Graduate School of Business; California State University, Dominguez Hills. Bill pairs hands-on technical depth with disciplined, process-driven execution, focused on process excellence, practical decision-making and building organisational trust across technical and business teams. On this project he owns operations, infrastructure and process discipline for the pilot, including the dual-control task queue.

## 11. What is not yet true, stated plainly

- No bank has signed a servicing contract yet; the operating assumptions are ours.
- No production stablecoin can be escrowed today; the settlement asset is an open decision with the RLUSD and institutional teams.
- California residential consumer-protection carve-outs and the Idaho servicing posture go to counsel before a live loan; the Idaho escrow-interest rule is gated as unverified in the engine.
- Property-tax and hazard bills in the published runs come from a fixture; production needs a live bill source behind an operator verification gate (milestone M2).
- Documents are synthetic; production ingest hashes the custodian-held eNote, not a scan.
- There is no borrower portal or operator web UI; the product surface today is the command line and the evidence pack.

## 12. Sustainability and ecosystem contribution

Post-grant revenue comes from servicing fees in the servicer-of-record model and from servicing-operations contracts with banks, with the ledger evidence layer priced as an add-on at $0.50 to $1.50 per loan per month. Everything in this repository stays open: the canonical loan schema, the regulatory control map with its tests, the memo and receipt-file contracts, the evidence-pack format, the cost model, and the Testnet lessons (ledger-window handling, escrow pacing, key drills) that any regulated team building on XRPL will meet.

## 13. Submission positioning

MortgageOS is mortgage-servicing infrastructure with an XRPL evidence and settlement rail. We do not state or imply that an XRPL object replaces a deed, note, lien, title registry, escrow account or regulated servicing function; we do not promise liquidity, fractional trading or investor returns. Standard language: "MortgageOS uses the XRP Ledger to record cryptographic references, exact-cent settlement events and date-locked impound releases. The legally enforceable mortgage, lien, title and property records remain governed by applicable law and authoritative registries."

## 14. Sources and evidence

- Repository, README and architecture: <https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm>
- Live demo (reads Testnet in the browser): <https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/demo/>
- Testnet run record and explorer links: `docs/testnet-run.md`; evidence pack: `docs/evidence/run-mtvzvtnk/`
- Regulatory control map and tests: `docs/architecture.md` §11, `docs/standards-mapping.md`
- Roast verdict and open items: `docs/roast-v2-2026-09-10.md`; cost model: `docs/cost-model.md`
- XRPL Grants: <https://xrplgrants.org>; XRPL feature state verified 2026-09-08 (TokenEscrow, NonFungibleTokensV1_1 enabled on Mainnet; XLS-65, XLS-66, DynamicMPT, BatchV1_1 disabled)
