# MortgageOS™ Tokenization and Servicing Layer on the XRP Ledger

**Grant proposal to XRPL Grants** · High Tech Mortgage, Inc. (HTM) · Sacramento, California and Metro Manila, Philippines

Requested funding: **$200,000** · Program: **12 months** · Date: **September 11, 2026** · Supersedes the September 10, 2026 proposal

Repository: <https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm> (MIT, branch `v3`) · v3 Testnet evidence: `docs/evidence/v3/` · Hook firewall proven on Xahau: `hooks/evidence/` · v2 Testnet demo (archived): <https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/demo/>

---

## 1. Executive summary

A residential mortgage is a thirty-year credit asset. The hard problem is not issuing a token; it is keeping the legal asset, its servicing data, its cash flows and its evidence trail consistent for decades across tax changes, servicing transfers and audits — while the note itself stays an illiquid, siloed bank record. Escrow mistakes, misapplied payments and late tax disbursements are the most common servicing failures and the most expensive to remediate.

HTM has built and published version 3.1 of MortgageOS™, which puts two strictly separated things on the XRP Ledger for every 30-year fixed-rate loan. The **asset layer**: one Multi-Purpose Token issuance per loan is the unalterable digital twin of the mortgage note — the lending institution's right to the fixed principal-and-interest cash flow — held by the lender at face value, transferable between authorized institutions, escrowable, and never clawback-able. The **servicing rail**: every month's fixed P&I and the tax and insurance impounds settle through native TokenEscrow contracts that cannot be finished before the due date, and each validated finish is an on-chain, cryptographic proof of payment that an audit sweep re-reads from the ledger. Everything about the borrower, and the outstanding balance, stays in the servicer's PostgreSQL books.

Everything described as done in this proposal runs today on the XRP Ledger Testnet using only amendments that are live on Mainnet. The grant funds the path from a proven core to a controlled pilot with a bank: porting the v2 servicing controls (statements, annual aggregate analysis, case workflows, Form 1098) onto the v3 core, live custodial statements, a live property-tax bill source, production key management, counsel sign-off on the note-asset questions, and an independent security review.

What this is not: the token does not replace the Note, the Deed of Trust, the lien, the county record, the bank's custodial accounts or the servicer's books; no capital is raised and no interests are sold to the public — the note asset moves only between authorized financial institutions; and the borrower's obligation is a personal consumer debt under RESPA and TILA that nothing on the asset layer can change.

## 2. Who we are and how we operate

High Tech Mortgage, Inc. is a licensed California mortgage broker (DFPI and DRE) with an operations centre in Manila. The loans are standard Fannie Mae uniform-instrument, fixed-rate, 30-year residential loans, funded and owned by banks we work with under contract.

HTM operates in one of two ways, and the software is the same in both:

- **Servicer of record for its own clients**, under its California licences, through a servicing entity kept separate from the brokerage.
- **Servicing-operations and technology contractor to a bank** that is itself the official servicer and keeps banking compliance and liability. Several lending banks have asked for exactly this arrangement.

The Manila team executes servicing tasks under dual control in both models and never holds signing keys.

## 3. What the ledger does, and does not do

| The ledger does | The ledger does not |
|---|---|
| Hold one note asset per loan: an MPT issuance whose supply is the face value in cents, whose XLS-89d metadata carries the fixed terms, the terms-manifest hash and an IPFS CID slot, and whose flags allow escrow, transfer and lock but never clawback | Decide what the borrower owes; outstanding principal, escrow analysis and the borrower's identity are the servicer's books |
| Keep the asset with the lending institution at face value for the life of the loan; `RequireAuth` means only institutions the issuer authorizes can hold it | Replace custodial accounts, cure a shortage, send statutory notices or satisfy any regulation by itself |
| Lock each month's fixed P&I and impound legs under a TokenEscrow that cannot be finished before the due date, with the split and regulatory markers in the memo; the validated finish is the proof of payment | Confer a licence, prove payee receipt, document validity or custody |
| Refuse payments from anyone not pre-authorized (`DepositAuth` on the issuer, the lender and the custodial account) and place a holding on hold when a dispute requires it | Carry borrower PII, ever |

## 4. What is already true

**v3.1 (September 11, 2026).** A Python engine on `xrpl-py` with a PostgreSQL mirror. Phase 1 boards a loan: DepositAuth and DepositPreauth on the issuer, the lender and the impound account; the note asset minted with flags `CanEscrow | CanTransfer | CanLock | RequireAuth` and no `CanClawback`, its metadata carrying the fixed terms and the payment ($2,844.31 on $450,000 at 6.5 %); the lender authorized and delivered the full face value; the issuance id proven equal between the ledger and the database. Phase 2 settles a period: a strict fixed-rate schedule (identical P&I for all 360 periods, refused otherwise) is written to the database; the P&I leg to the lender and the impound leg to the custodial account are escrowed with the split in the memo; both finish on the due date with `tesSUCCESS`; the books reduce outstanding principal by $406.81 while the on-ledger face value stays 45,000,000 units; the issuer places the holding on hold and releases it. The audit sweep re-reads both finish transactions from the ledger and stamps their ledger index on the payment rows. Phase 3 proves error triage: a forced ledger error (`tecPATH_PARTIAL`) and a forced network timeout are both caught, written to the audit log with the raw code and the full envelope, and the engine exits cleanly.

**Hook firewall (sidecar).** The on-chain payment firewall from the design notes exists as working C, compiled to WebAssembly and proven on Xahau Testnet (`hooks/`): below-schedule payments and payments to a frozen account are rejected by the ledger itself, seven expectations met. It is rebuilt and re-proved on every push by a server-side pipeline. It is not part of the core because Hooks are not enabled on the XRP Ledger; it is ready as a later test stage.

**v2.0.0 (September 10, 2026, archived on `main`).** The prior TypeScript engine: OCR ingest of a 23-page synthetic closing package with cent-level tie-outs, the full RESPA / Regulation Z / FHA control map R01–R31 with 127 named tests, aggregate escrow analysis with the one-sixth cushion, statements, case workflows, servicing transfer, Form 1098, and a 108-transaction Testnet run. Its servicing controls are the porting roadmap for the grant period.

**Cost.** About 80 ledger transactions per loan-year in v3 (two escrow creates and two finishes per month, plus boarding), fees under 0.01 XRP, refundable owner reserve for two MPToken objects and transient escrows.

## 5. Architecture

Five layers, with the legal layer untouched:

1. **Legal asset.** Note, deed of trust, lien, title, escrow and servicing obligations stay governed by law and authoritative registries.
2. **Bank custodial accounts and servicing books.** Legally authoritative balances.
3. **MortgageOS engine (this repository, `mortgageos/`).** PostgreSQL schema `mortgageos` as system of record: loans, issuances, every ledger transaction with its state, the 360-row payment schedule, escrow legs with their payment proofs, and the audit log; Python event loop that reads the schedule and drives the ledger; audit sweep.
4. **XRP Ledger.** One note-asset MPT per loan held by the lender, DepositAuth-guarded accounts, TokenEscrow settlement legs of a settlement MPT, lock / unlock for asset holds.
5. **Institutional interfaces.** Command line and database today; bank system integration during the grant.

Not used, and why: `Clawback` on the note (the asset is never burned as the loan amortizes; amortization is a servicing figure), Hooks on the XRP Ledger (not enabled on Mainnet or Testnet, verified on the Amendments object 2026-09-11; the policy is kept as working C in `hooks/` and proven on Xahau), Smart Escrows (WASM devnet only), NFTokens (replaced by the MPT asset). The settlement asset on Testnet is a self-issued test USD MPT because RLUSD's issuers do not permit trust-line locking.

## 5a. Tokenomics and institutional liquidity architecture

The platform transitions mortgage notes from illiquid, siloed bank assets into on-ledger financial instruments, and does it by strictly bifurcating the asset ledger from the payment servicing rail using native XRPL primitives.

```
        [ Lending institution ]  holds the note asset
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  ┌─────────────┐        ┌─────────────┐
  │ TokenEscrow │        │  MPT note   │
  │  (XLS-85)   │        │ digital twin│
  └──────┬──────┘        └──────┬──────┘
         ▼                      ▼
  ┌─────────────┐        ┌─────────────┐
  │  immutable  │        │ XLS-65/66   │
  │ payment rail│        │ (future)    │
  └─────────────┘        └─────────────┘
```

**The MPT as a secondary-market financial asset.** Instead of representing a consumer liability that burns down over time, the MPT is a secure, unalterable digital twin of the underlying 30-year fixed-rate promissory note: the lending institution's legal right to receive the fixed P&I cash flow. It is minted with `CanTransfer` and `CanEscrow`, so it is structurally transferable between authorized financial entities and can be locked into ledger-native escrows, and with `RequireAuth`, so the issuer decides which institutions may hold it. Abandoning clawback mechanics removes a non-standard control that only introduced consumer-compliance friction: nothing on the ledger can shrink a holder's position.

**Regulatory stability by separation.** The borrower's consumer rights are protected by isolating them from the asset's secondary-market utility. The mortgage remains a non-negotiable personal debt obligation governed by RESPA Regulation X and TILA; the borrower's identity, escrow analysis and outstanding balance are anchored off-chain in the servicer's PostgreSQL books; what reaches the ledger is a date-locked escrow with a split and no personal data.

**Native XLS-65 / XLS-66 forward compatibility.** Because the MPT is a standardized, fixed-term, fungible-unit instrument, it is engineered to be natively compatible with the XRP Ledger's credit primitives: it could be deposited into a Single Asset Vault (XLS-65) or pledged as verifiable on-chain collateral in the Lending Protocol (XLS-66) so a bank can secure short-term stablecoin financing against its portfolio without liquidating it. **Secondary hypothecation is outside the scope of this phase**: on September 11, 2026 both amendments are enabled on XRPL Devnet and not on Testnet or Mainnet, and nothing in this implementation depends on or exercises them. Whether and when to fund 30-year notes with short-term liabilities is an asset-liability decision for the bank and its regulator.

**Automated servicing and the immutable audit rail.** Servicing is handled entirely through native TokenEscrow (XLS-85). The monthly fixed P&I stream is a sequence of programmatic, time-locked escrow contracts that execute deterministically over the term; every successful finish transaction generates a unique on-chain cryptographic proof of payment. The audit sweep re-reads those proofs from the ledger and records their ledger index, giving bank regulators and external auditors a transparent, unalterable ledger of account that proves loan performance and reduces reporting cost.

## 6. Why this fits XRPL Grants

- **Multi-Purpose Tokens used as an institutional asset.** A transferable, escrowable, lockable note twin with XLS-89d metadata, plus a second MPT as the escrowable settlement asset: two of the newest Mainnet primitives exercised end to end with tests, and designed for the credit primitives that follow them.
- **Institutional settlement.** Date-locked TokenEscrow legs with an exact-cent split in the memo, DepositAuth-guarded accounts, and payment proofs re-verified from the ledger, the pattern any regulated servicer needs before touching a ledger.
- **Open infrastructure.** MIT-licensed schema, metadata shape, memo format, builders, the audit-log contract and the tests that any team can reuse for a regulated asset on XRPL, plus a Hook firewall proven on Xahau.
- **On-chain activity that means something.** Four validated transactions per loan per month, every one traceable to a servicing obligation and provable to an auditor.

## 7. Twelve-month milestones

| ID | Months | Milestone | Evidence delivered |
|---|---|---|---|
| M1 | 1–2 | Counsel memos on the note asset (UCC 3/9, eNote / ESIGN / UETA / MERS, securities characterization), California residential carve-outs, Idaho servicing posture and the custodial settlement asset; first bank servicing contract or LOI; production key-management runbook | memos in `docs/`, signed LOI, runbook |
| M2 | 2–4 | Port the v2 aggregate escrow analysis (cushion, surplus, shortage, deficiency) and statements onto the v3 core; property-tax bill source behind an operator verification gate; IPFS pinning of the terms manifest with the CID verified in the asset metadata | ported tests, verified-bill audit trail, CID checks |
| M3 | 4–7 | Live custodial statements and daily three-way reconciliation against the payment proofs; 1024.35–.41 case workflows with SLA evidence; dual-control task queue for the Manila team | reconciliation reports, case fixtures, queue audit log |
| M4 | 6–9 | Production key management (HSM regular keys, 2-of-3 signer lists, rotation drills); settlement-asset decision with the RLUSD and institutional teams; authorized-holder policy for the note asset; Mainnet dry-run criteria | drill logs, decision records |
| M5 | 8–10 | Controlled pilot on real, redacted loan files with the contracting bank; Form 1098 season dry run; evidence packs delivered to the bank's examiner | pilot report, examiner feedback |
| M6 | 9–11 | XLS-65 / XLS-66 readiness study on Devnet (vault deposit and collateral flows with the note asset), with the asset-liability policy questions written for the bank | Devnet run record, policy memo |
| M7 | 11–12 | Independent security review of the threat model; public technical paper; refreshed demo; Mainnet go/no-go | review notes, paper, video |

## 8. Targets and funding logic

Grant-period targets, not commercial commitments:

| By month 12 | Target |
|---|---|
| Tokenized loan records (test and pilot) | 50 |
| Ledger transactions (Testnet and permitted production) | 5,000 |
| Servicing events (settlements, analyses, disbursements, statements, cases) | 1,200 |
| Counterparties engaged (banks, counsel, auditors, RLUSD/institutional team) | 4 |
| Payment proofs re-verified against benchmark cases | 100 % (deterministic today) |

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
| XRPL asset and settlement engineering | $60,000 | Production key management, settlement-asset integration, authorized-holder policy, XLS-65/66 readiness on Devnet, Mainnet dry-run tooling |
| Servicing and data engineering | $50,000 | Porting the v2 controls onto the v3 core, bank receipt integration, tax-bill source and verification gate, case workflows, statement PDFs, operator queue |
| Security and independent technical review | $25,000 | Threat-model review, key handling, access control, penetration test of the operator surface |
| Legal and regulatory | $25,000 | Note-asset characterization (UCC, eNote, securities), California residential carve-outs, Idaho posture, custodial asset, servicing contract |
| Document and AI ingestion | $15,000 | Porting the scanner pipeline, field extraction validation, IPFS manifest pinning |
| Pilot infrastructure and testing | $15,000 | Hosted rippled or API, controlled datasets, pilot execution |
| Developer documentation and open-source components | $7,000 | Reference implementation upkeep, technical paper, demo materials |
| Contingency | $3,000 | Unplanned integration and testing costs |

## 10. Team

All four people below are published, with photographs and credentials, at <https://hightechmortgage.com/about/>. Everything here is copied from that page.

**Rich Young, Founder, President and Lead Broker.** California DRE Broker's License #01106294; California Mortgage Broker NMLS #291547. Thirty-plus years in Bay Area real estate and mortgage work. Rich founded HighTechMortgage to apply modern digital-economy tools to real-estate facilitation and finance. On this project he owns the origination, servicing and compliance obligations the software models and is the licensed principal in both operating models.

**Dr Van Wilson, Data Science, AI and Blockchain Technology.** Twenty-plus years in data science, mostly in finance. He held a secret clearance while working for the U.S. Securities and Exchange Commission, where he built an AI model that turned previously unreadable legal submissions into structured data, and for Fannie Mae, where he built the financial-forecasting machine-learning model that answered whether borrowers would resume paying their mortgages after the COVID payment freeze and led the plan for its on-premises-to-cloud conversion. Earlier finance and data work includes a cloud migration that protected a billion dollars of transactions and a GAAP reporting product of more than five thousand accounting reports. Post-graduate degree in data science and AI from the Massachusetts Institute of Technology (2022); bachelor's degree, California State University, Fullerton. AWS Certified Developer; Databricks certified; Blockchain Training Alliance certified; Microsoft Certified Trainer; certified PostgreSQL, SQL Server and MySQL DBA; ERP certifications in Sage, QuickBooks and Microsoft NAV. A real-estate investor since 1998 with more than 120 closed transactions and a personally managed portfolio above $10 million across three U.S. states and two countries. On this project he designed the v3 asset and settlement core and the v2 servicing engine, and wrote and reviews the code in this repository. LinkedIn: <https://linkedin.com/in/drvanwilson>.

**Trish Wilson (Maria Theresa Wilson), Real Estate, Finance and Philippine Operations.** Active licensed U.S. Realtor; Philippine Real Estate Broker, PRC 0024025; Certified Public Accountant (St. Paul University, Philippines, BA Accounting); International Certified Financial Consultant; life insurance agent; blockchain-certified agent; property and asset manager; former internal auditor at Philippine Airlines. She brings U.S. professional standards to Philippine property work, combining banking, airline sales management, corporate operations and cross-border consulting, and has advised businesses and investors on investment strategy, estate planning, tax and asset protection. On this project she leads the Manila servicing-operations team under dual control and performs the accounting review of the schedules and escrow analyses.

**Bill Thompson, Operations, IT and Business Management.** ITIL v4; Six Sigma Quality; CompTIA A+; TOPCIT; Practical Project Management; URAC; FranklinCovey Management; Ateneo Graduate School of Business; California State University, Dominguez Hills. Bill pairs hands-on technical depth with disciplined, process-driven execution, focused on process excellence, practical decision-making and building organisational trust across technical and business teams. On this project he owns operations, infrastructure and process discipline for the pilot, including the dual-control task queue.

## 11. What is not yet true, stated plainly

- No bank has signed a servicing contract yet; the operating assumptions are ours.
- Counsel has not yet characterized the note asset: whether a transferable token that mirrors the note is a negotiable instrument under UCC Article 3, how a security interest in it is perfected under Article 9, whether it is an eNote under ESIGN / UETA with MERS implications, and whether a transferable cash-flow right is a security. Until answered, the asset stays `RequireAuth` with only the originating lender authorized to hold it.
- No production stablecoin can be escrowed today; the settlement asset is an open decision with the RLUSD and institutional teams.
- XLS-65 / XLS-66 are not on Testnet or Mainnet; the vault and collateral paths are a readiness study (M6), not a feature.
- California residential consumer-protection carve-outs and the Idaho servicing posture go to counsel before a live loan.
- Property-tax and hazard bills in the published runs are fixture values; production needs a live bill source behind an operator verification gate (M2).
- The terms manifest is hashed into the asset metadata but not yet pinned to IPFS; the CID slot is an operator step until a pinning service is on file (M2).
- v3 does not yet include the v2 statements, aggregate analysis with cushion, case workflows or Form 1098; they are archived on `main` and are ported during M2–M3.
- There is no borrower portal or operator web UI; the product surface today is the command line and the database.

## 12. Sustainability and ecosystem contribution

Post-grant revenue comes from servicing fees in the servicer-of-record model and from servicing-operations contracts with banks, with the tokenization and evidence layer priced as an add-on at $0.50 to $1.50 per loan per month. Everything in this repository stays open: the `mortgageos` schema, the note-asset MPT pattern and metadata shape, the memo format, the transaction builders, the payment-proof and audit-log contract, the Hook firewall, and the Testnet lessons any regulated team building on MPT and TokenEscrow will meet.

## 13. Submission positioning

MortgageOS is mortgage tokenization and servicing infrastructure with an XRPL asset layer and settlement rail. We do not state or imply that an XRPL object replaces a deed, note, lien, title registry, escrow account or regulated servicing function; we do not offer the asset to the public and we do not promise liquidity, fractional trading or investor returns. Standard language: "MortgageOS keeps a digital twin of each mortgage note on the XRP Ledger for the lending institution that owns it, settles the fixed monthly payments through date-locked escrows, and records each payment as an on-chain proof. The legally enforceable mortgage, lien, title and property records remain governed by applicable law and authoritative registries, and the borrower's obligation is unchanged by anything done with the asset."

## 14. Sources and evidence

- Repository, README (tokenomics section) and v3 architecture: <https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm> (branch `v3`, `docs/v3-architecture.md`)
- v3 Testnet evidence: `docs/evidence/v3/` (loan, issuance ids, transaction hashes, payment proofs, audit rows)
- Hook firewall on Xahau Testnet: `hooks/evidence/`; server-side rebuild and re-proof pipeline: `portainer/hooks-builder/`
- v2 archive: `docs/architecture.md`, `docs/testnet-run.md`, `docs/evidence/run-mtvzvtnk/`, demo <https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/demo/>
- XRPL Grants: <https://xrplgrants.org>; XRPL feature state verified 2026-09-11 on the Amendments ledger object (Testnet: MPTokensV1, TokenEscrow, Credentials, PermissionedDomains, Clawback enabled; SingleAssetVault and LendingProtocol on Devnet only; Hooks, SmartEscrow, DynamicMPT not enabled)
