# MortgageOS™ Tokenization and Servicing Layer on the XRP Ledger

**Joint grant proposal to XRPL Grants** · High Tech Mortgage, Inc. (HTM) and Global Realtor 4A Cause (GRC)

**Submitting and project contact:** Dr Van Wilson · [vanw@globalrealtor4acause.com](mailto:vanw@globalrealtor4acause.com)

Joint-venture footprint: HTM - California and Idaho · GRC - Philippines

Requested funding: **$200,000** · Program: **12 months** · Date: **September 17, 2026**

<ul class="links">
<li>Repository (MIT): <a href="https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm">https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm</a></li>
<li>Testnet evidence report: <a href="https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/evidence/v3/">https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/evidence/v3/</a></li>
</ul>

---

**To:** The XRPL Grants Committee and Ripple staff

Dear Committee Members,

## 1. Executive summary

MortgageOS™ is being built through a joint venture between **High Tech Mortgage, Inc. (HTM), owned by Rich Young, and Global Realtor 4A Cause (GRC), owned by Maria Theresa Wilson (aka Trish Wilson)**. The venture joins a licensed California mortgage operator with a Philippine real-estate, technology and international-logistics team. Rich and HTM will operate MortgageOS in California; Trish and GRC will lead the platform's development support and its Philippine market relationships. HTM's mortgage-broker and servicing activities remain under HTM's licenses, and this application does not represent GRC as holding those licenses.

Rich brings the operating environment in which MortgageOS can move from code to regulated mortgage use. He holds California DRE Broker's License #01106294 and NMLS #291547 and has more than thirty years of Bay Area mortgage-lending experience. Through HTM, he will direct California deployment, origination, servicing and compliance for the platform.

Dr Van Wilson and Bill Thompson work for GRC and bring the technical and cross-border execution capacity to build MortgageOS for HTM to run. Van designed and wrote MortgageOS™; he holds a post-graduate degree in data science and AI from MIT, built Fannie Mae's post-COVID mortgage-forbearance forecasting model, and developed an AI legal-document model for the U.S. Securities and Exchange Commission. Bill combines ITIL v4 and Six Sigma credentials, Ateneo Graduate School of Business training, infrastructure operations and international real-estate logistics. Together they provide the engineering, operational and process discipline needed to take the platform through a controlled pilot.

**Trish gives the joint venture a credible route into the Philippine real-estate and lender-bank ecosystem.** She owns GRC and is a licensed Philippine real estate broker, a former Certified Public Accountant and banker, and a licensed U.S. Realtor and financial consultant. Her executive-level standing and relationships involve three of the Philippines' largest developers - Megaworld, Ayala Land and ArthaLand - and their lender-bank groups. Megaworld recruited her for an International Marketing Director role, while Ayala Land and ArthaLand approached her for comparable positions. Those relationships are not presented as commitments to adopt MortgageOS; they are a practical path to the senior decision-makers who can evaluate a Philippine pilot.

**That combination is the reason XRPL should be interested:** the venture offers both a deployable California use case under an experienced mortgage operator and a relationship-led path to major Philippine property developers and banking groups. XRPL would not be funding a stand-alone token concept. It would be helping an American mortgage company and a Philippine real-estate technology organization turn a working testnet system into a regulated pilot, then present it to institutions capable of taking it to regional scale.

### The team

The four-person joint-venture team is published, with photographs and credentials, at <https://hightechmortgage.com/about/>.

<table class="grid">
<tr>
<td><div class="card"><div class="who"><img src="assets/brand/team/rich-young-hightechmortgage.jpg" alt="Rich Young"><div class="name">Rich Young</div><div class="role">Owner, President &amp; Lead Broker - HTM</div></div><div class="bio">California DRE Broker's License #01106294 and NMLS #291547. More than thirty years in Bay Area real estate and mortgage lending. He owns HTM and leads MortgageOS deployment in California, including the origination, servicing and compliance obligations the software models. He is the licensed principal in the two U.S. operating models.</div></div></td>
<td><div class="card"><div class="who"><img src="assets/brand/team/van-wilson-hightechmortgage.png" alt="Dr Van Wilson"><div class="name">Dr Van Wilson</div><div class="role">GRC - Data Science, AI &amp; Blockchain</div></div><div class="bio">Works for GRC and brings twenty-plus years in data science, mostly in finance, together with international real-estate experience. Post-graduate degree in data science and AI from MIT (2022). At Fannie Mae he built the machine-learning model that forecast whether borrowers would resume paying after the COVID payment freeze. At the U.S. Securities and Exchange Commission, under a secret clearance, he built an AI model that turned unreadable legal filings into structured data. AWS, Databricks, Blockchain Training Alliance and Microsoft certified; certified PostgreSQL, SQL Server and MySQL DBA. Real estate investor since 1998 with more than 120 closed transactions. On this project he designed the asset and settlement core and the servicing engine, and wrote and reviews the code. LinkedIn: <a href="https://linkedin.com/in/drvanwilson">linkedin.com/in/drvanwilson</a>.</div></div></td>
</tr>
<tr>
<td><div class="card"><div class="who"><img src="assets/brand/team/trish-wilson-hightechmortgage.jpeg" alt="Maria Theresa Wilson"><div class="name">Maria Theresa Wilson<br><span style="font-weight:400;font-size:0.85em;">(aka Trish Wilson)</span></div><div class="role">Owner, GRC - Philippine Real Estate &amp; Finance</div></div><div class="bio">Owns GRC. Former Certified Public Accountant (St. Paul University, Philippines) and banker. Philippine Real Estate Broker, PRC 0024025. Licensed U.S. Realtor and International Certified Financial Consultant. Former internal auditor at Philippine Airlines. Her executive-level developer and lender-bank relationships provide the venture's route to Philippine institutional decision-makers. On this project she leads Philippine market development and the Manila servicing-operations team under dual control.</div></div></td>
<td><div class="card"><div class="who"><img src="assets/brand/team/bill-thompson-hightechmortgage.jpg" alt="Bill Thompson"><div class="name">Bill Thompson</div><div class="role">GRC - Operations, IT &amp; Logistics</div></div><div class="bio">Works for GRC. An expert in ITIL v4 service management and Six Sigma quality assurance; also CompTIA A+ and TOPCIT certified. Ateneo Graduate School of Business and California State University, Dominguez Hills. He combines hands-on technical depth, international real-estate logistics and process-driven execution. On this project he owns operations, infrastructure and process discipline for the pilot, including the dual-control task queue.</div></div></td>
</tr>
</table>

Mortgage lending is still uncommon in the Philippines, and that is about to change. In 2025 the Bangko Sentral ng Pilipinas (BSP), the Philippine central bank and counterpart of the U.S. Federal Reserve, cut the reserve requirement for universal and commercial banks from 7% to 5%, effective March 28, 2025, an unprecedented level for the Philippines and a deliberate release of lending capacity. Banks now want to lend, but they do not know how to originate, fund or service residential loans without taking on risk they cannot measure. Servicing those loans through the XRP Ledger, with HTM running the servicing for them, and the ability, in time, to place seasoned loans into a liquidity pool, lowers their risk and their cost of servicing dramatically. That is what will make mortgage lending commonplace in the Philippines, and it is why the first bank-grade XRPL mortgage book belongs in Manila.

Ripple needs a venture that combines a regulated mortgage operator with a team able to build the platform and reach institutional decision-makers, and that is what this joint venture provides. HTM intends to acquire a 40% ownership position in a small provincial bank in the Philippines, preferably in the vicinity of Clark International Airport in Pampanga, the growth corridor north of Metro Manila. Through that bank we will originate and sell mortgages and service every one of them on MortgageOS™ with settlement on the XRP Ledger, giving XRPL a bank-grade mortgage servicing book in one of the fastest-growing regions of ASEAN rather than a stand-alone pilot.

The joint venture has built and published version 3.1 of MortgageOS™, led technically by GRC for HTM's operation. It puts two strictly separated things on the XRP Ledger for every 30-year fixed-rate loan. The **asset layer**: one Multi-Purpose Token issuance per loan is the unalterable digital twin of the mortgage note — the lending institution's right to the fixed principal-and-interest cash flow — held by the lender at face value, transferable between authorized institutions, escrowable, and beyond the issuer's power to reduce. The **servicing rail**: every month's fixed P&I and the tax and insurance impounds settle through native TokenEscrow contracts that cannot be finished before the due date, and each validated finish is an on-chain, cryptographic proof of payment that an audit sweep re-reads from the ledger. Everything about the borrower, and the outstanding balance, stays in the servicer's PostgreSQL books.

Everything described as done in this proposal now runs on **XRP Ledger Mainnet**, using only amendments enabled there. It was developed and proven on Testnet and deployed to Mainnet on September 24, 2026. The grant funds the path from a proven core to a controlled pilot with a bank: building the servicing controls (periodic statements, annual aggregate escrow analysis, case workflows, Form 1098) on the core, live custodial statements, a live property-tax bill source, production key management, counsel sign-off on the note-asset questions, and an independent security review.

What this is not: the token does not replace the Note, the Deed of Trust, the lien, the county record, the bank's custodial accounts or the servicer's books; no capital is raised and no interests are sold to the public — the note asset moves only between authorized financial institutions; and the borrower's obligation is a personal consumer debt under RESPA and TILA that nothing on the asset layer can change.

## 2. How we operate

HTM and GRC are undertaking the MortgageOS tokenization project through their joint venture. GRC's technical and international real-estate team builds and supports the platform; HTM operates it in California and supplies the regulated mortgage expertise that defines its controls. The operating models below describe HTM's mortgage and servicing roles. GRC's participation does not transfer or extend HTM's licenses.

The loans we work with are standard conventional, fixed-rate, 30-year residential loans documented on the Fannie Mae/Freddie Mac Uniform Instruments: the Multistate Fixed Rate Note (Form 3200) and, in California, the Deed of Trust (Form 3005). They are serviced to the Fannie Mae Servicing Guide and the CFPB mortgage servicing rules under RESPA (Regulation X, 12 CFR part 1024) and TILA (Regulation Z, 12 CFR part 1026).

HTM operates in three ways, and the software is the same in all of them:

- **Servicer of record for its own clients**, under its California licenses, through a servicing entity kept separate from the brokerage.
- **Servicing-operations and technology contractor to a bank** that is itself the official servicer and keeps banking compliance and liability. Several lending banks have asked for exactly this arrangement.
- **Shareholder in a licensed Philippine bank**, the provincial bank acquisition described above, where the bank originates and owns the loans and MortgageOS is its servicing platform.

The Manila team executes servicing tasks under dual control in all three models and never holds signing keys.

## 3. The servicing standard we implement

MortgageOS services a conventional fixed-rate loan the way the Fannie Mae Servicing Guide and the CFPB rules require, and uses the XRP Ledger only where an immutable, independently verifiable record improves on a private database. The table below is the control map: what the servicer must do, the authority for it, and where MortgageOS does it.

| Servicing obligation | Authority | Where it runs |
|---|---|---|
| Apply each periodic payment to principal, interest and escrow as of the day of receipt | Regulation Z, 12 CFR 1026.36(c)(1); Fannie Mae Servicing Guide C-1.1-01 | Books apply the payment; the ledger settles the fixed P&I leg to the lender on the due date and records the proof |
| Administer the escrow account: aggregate analysis, one-sixth cushion, annual statement, surplus / shortage / deficiency handling | RESPA Regulation X, 12 CFR 1024.17; Fannie Mae Servicing Guide B-1-01 | Books compute the analysis; the ledger holds each month's impound leg under a date lock in the custodial account |
| Send a periodic statement each billing cycle | Regulation Z, 12 CFR 1026.41 | Books; statement lines cite the ledger proof for each settled leg |
| Give notice of servicing transfer and of a change in loan ownership | Regulation X, 12 CFR 1024.33; Regulation Z, 12 CFR 1026.39 | Notices are off-ledger; a transfer of the note asset between authorized institutions is a validated ledger transaction the notice can cite |
| Resolve notices of error and requests for information within the statutory clocks | Regulation X, 12 CFR 1024.35 and 1024.36 | Books and case workflow; ledger proofs are the evidence attached to the response |
| Force-placed insurance, early intervention, continuity of contact, loss mitigation | Regulation X, 12 CFR 1024.37 through 1024.41 | Books and case workflow; the issuer can place the note-asset holding on hold while a dispute is open |
| Report mortgage interest received for the year | IRS Form 1098; 26 U.S.C. § 6050H | Books, from the settled P&I legs |
| Keep the note enforceable and its ownership provable | UCC Article 3 (negotiable instruments) and Article 9 (security interests); ESIGN 15 U.S.C. § 7021 and UETA § 16 (transferable records); MERS eRegistry | The legal layer, untouched; the note asset mirrors it and counsel's characterization is milestone M1 |

Nothing in the right-hand column moves a legal obligation onto the ledger. The servicer's books, held against the bank's custodial accounts, are legally authoritative; the ledger is evidence and enforcement of one narrow guarantee: the money moved to the cent, on the date, to the pre-authorized party, and anyone can verify it without seeing the borrower.

## 4. What the ledger does, and does not do

| The ledger does | The ledger does not |
|---|---|
| Hold one note asset per loan: a Multi-Purpose Token issuance whose supply is the face value in cents. Its XLS-89d metadata carries the fixed terms, the terms-manifest hash and an IPFS CID slot, and its flags allow escrow, transfer and hold while giving the issuer no power to take units back from a holder. | Decide what the borrower owes; outstanding principal, escrow analysis and the borrower's identity are the servicer's books. |
| Keep the asset with the lending institution at face value for the life of the loan; `RequireAuth` means only institutions the issuer authorizes can hold it. | Replace custodial accounts, cure a shortage, send statutory notices or satisfy any regulation by itself. |
| Lock each month's fixed P&I and impound legs under a TokenEscrow that cannot be finished before the due date, with the split and regulatory markers in the memo; the validated finish is the proof of payment. | Confer a license, prove payee receipt, document validity or custody. |
| Refuse payments from anyone not pre-authorized (`DepositAuth` on the issuer, the lender and the custodial account) and place a holding on hold when a dispute requires it. | Carry borrower PII, ever. |

## 5. What is already true

**MortgageOS (published September 11, 2026; deployed to Mainnet September 24, 2026).** A Python engine on `xrpl-py` with a PostgreSQL system of record. Phase 1 boards a loan: DepositAuth and DepositPreauth on the issuer, the lender and the impound account; the note asset minted with flags `CanEscrow | CanTransfer | CanLock | RequireAuth`, its metadata carrying the fixed terms and the payment ($2,770.73 on $450,000 at 6.25 % over 360 months); the lender authorized and delivered the full face value; the issuance id proven equal between the ledger and the database. Phase 2 settles a period: a strict fixed-rate schedule (identical P&I for all 360 periods, refused otherwise) is written to the database; the P&I leg to the lender and the impound leg to the custodial account are escrowed with the split in the memo; both finish on the due date with `tesSUCCESS`; the books reduce outstanding principal by $426.98 while the on-ledger face value stays 45,000,000 units; the issuer places the holding on hold and releases it. The audit sweep re-reads both finish transactions from the ledger and stamps their ledger index on the payment rows. Phase 3 proves error triage: a forced ledger error (`tecPATH_PARTIAL`) and a forced network timeout are both caught, written to the audit log with the raw code and the full envelope, and the engine exits cleanly.

**Live on Mainnet.** The full cycle above was executed on XRP Ledger Mainnet on September 24, 2026 and is publicly verifiable:

Note asset (MPT issuance) `0663EACAC1E295FCE4BA9E9ECD5EC0E84C5089AEE6B00E65`; issuance transaction `217A9632ED44DCCE273C1102446D137E709D81859620E3BBCC0A5C6BD642DFFC`; P&I settlement `40D8B7B72377D423DFB41756AD619C15CEC2B61CE7F56A7FD6405F7F8BE080E1` and impound settlement `CDA244FDA8F78E6EAB40EA6E6879DB0DA0E0C22208F6791D10D5AA4FFD74A118`, both `EscrowFinish` with `tesSUCCESS`.

The demonstration loan is synthetic — a fictitious borrower and property, no real promissory note, and no borrower data of any kind on the ledger. Tokenizing a live consumer note awaits the counsel work in M1.

**Escrow computation.** Impounds are computed under 12 CFR 1024.17 as a rolling one-twelfth of the last actual annual bill, with the servicer advancing any shortfall; the schedule is exact cents with rounding absorbed only in the final payment.

**Cost.** About 60 ledger transactions per loan-year (two escrow creates and two finishes per month, plus boarding), fees under 0.01 XRP, refundable owner reserve for two MPToken objects and transient escrows.

## 6. Architecture

Five layers, with the legal layer untouched:

1. **Legal asset.** Note, deed of trust, lien, title, escrow and servicing obligations stay governed by law and authoritative registries.
2. **Bank custodial accounts and servicing books.** Legally authoritative balances.
3. **MortgageOS engine (this repository, `mortgageos/`).** PostgreSQL schema `mortgageos` as system of record: loans, issuances, every ledger transaction with its state, the 360-row payment schedule, escrow legs with their payment proofs, and the audit log; Python event loop that reads the schedule and drives the ledger; audit sweep.
4. **XRP Ledger.** One note-asset MPT per loan held by the lender, DepositAuth-guarded accounts, TokenEscrow settlement legs of a settlement MPT, lock / unlock for asset holds.
5. **Institutional interfaces.** Command line and database today; bank system integration during the grant.

Design choices: every on-ledger step is an amendment live on Mainnet today; the face value of the note asset never changes, because amortization is a servicing figure that lives in the books; the issuer has no power to reduce what a holder holds; forward compatibility with the ledger's credit primitives (XLS-65 / XLS-66) is a design property of the asset, not a feature of this phase. The settlement asset on Testnet is a self-issued test USD MPT because RLUSD's Testnet issuer does not permit trust-line locking; the production settlement asset is a milestone decision (M4).

## 7. Tokenomics and institutional liquidity architecture

The platform transitions mortgage notes from illiquid, siloed bank assets into on-ledger financial instruments, and does it by strictly bifurcating the asset ledger from the payment servicing rail using native XRPL primitives.

<img class="figure" src="assets/brand/tokenomics-architecture.svg" alt="Asset layer and servicing rail: the lending institution holds the MPT note asset; monthly P&amp;I and impound legs settle through date-locked TokenEscrow, each validated finish a proof of payment; XLS-65/66 are forward compatibility only.">

**The MPT as a secondary-market financial asset.** The MPT is a secure, unalterable digital twin of the underlying 30-year fixed-rate promissory note: the lending institution's legal right to receive the fixed P&I cash flow. It is minted with `CanTransfer` and `CanEscrow`, so it is structurally transferable between authorized financial entities and can be locked into ledger-native escrows, and with `RequireAuth`, so the issuer decides which institutions may hold it. The issuer holds no power to reduce a holder's position: nothing on the ledger can shrink what a bank holds.

**Regulatory stability by separation.** The borrower's consumer rights are protected by isolating them from the asset's secondary-market utility. The mortgage remains a personal debt obligation governed by RESPA (Regulation X) and TILA (Regulation Z); the borrower's identity, escrow analysis and outstanding balance are anchored off-chain in the servicer's PostgreSQL books; what reaches the ledger is a date-locked escrow with a split and no personal data.

**Native XLS-65 / XLS-66 forward compatibility.** Because the MPT is a standardized, fixed-term, fungible-unit instrument, it is engineered to be natively compatible with the XRP Ledger's credit primitives: it could be deposited into a Single Asset Vault (XLS-65) or pledged as verifiable on-chain collateral in the Lending Protocol (XLS-66) so a bank can secure short-term stablecoin financing against its portfolio without liquidating it. **Secondary hypothecation is outside the scope of this phase**: as of September 11, 2026 both amendments are enabled on XRPL Devnet and not on Testnet or Mainnet, and nothing in this implementation depends on or exercises them. Whether and when to fund 30-year notes with short-term liabilities is an asset-liability decision for the bank and its regulator.

**Automated servicing and the immutable audit rail.** Settlement is handled entirely through native TokenEscrow (XLS-85). The monthly fixed P&I stream is a sequence of programmatic, time-locked escrow contracts that execute deterministically over the term; every successful finish transaction generates a unique on-chain cryptographic proof of payment. The audit sweep re-reads those proofs from the ledger and records their ledger index, giving bank regulators and external auditors a transparent, unalterable ledger of account that proves loan performance and reduces reporting cost.

**Residential benchmark, commercial-ready architecture.** While the reference implementation is benchmarked against Fannie Mae 30-year residential standards, the MortgageOS™ architecture applies equally to commercial promissory notes and private debt instruments, enabling immediate deployment in commercial private-credit corridors without CFPB consumer-loan friction. U.S. residential origination and servicing carry TRID, Qualified Mortgage and CFPB compliance obligations that do not extend to commercial paper; the Philippine provincial-bank acquisition and private secondary-market institutional notes fall outside that consumer-protection perimeter and can move under commercial terms.

## 8. Why this fits XRPL Grants

- **Multi-Purpose Tokens used as an institutional asset.** A transferable, escrowable, lockable note twin with XLS-89d metadata, plus a second MPT as the escrowable settlement asset: two of the newest Mainnet primitives exercised end to end with tests, and designed for the credit primitives that follow them.
- **Institutional settlement.** Date-locked TokenEscrow legs with an exact-cent split in the memo, DepositAuth-guarded accounts, and payment proofs re-verified from the ledger, the pattern any regulated servicer needs before touching a ledger.
- **Open infrastructure.** MIT-licensed schema, metadata shape, memo format, builders, the audit-log contract and the tests that any team can reuse for a regulated asset on XRPL.
- **On-chain activity that means something.** Four validated transactions per loan per month, every one traceable to a servicing obligation and provable to an auditor.

## 9. Twelve-month milestones

| ID | Months | Milestone | Evidence delivered |
|---|---|---|---|
| M1 | 1–2 | Counsel memos on the note asset (UCC Articles 3 and 9, ESIGN / UETA transferable records and MERS, securities characterization), California residential carve-outs, Idaho servicing posture and the custodial settlement asset; first bank servicing contract or LOI; production key-management runbook | memos in `docs/`, signed LOI, runbook |
| M2 | 2–4 | Aggregate escrow analysis under 12 CFR 1024.17 (cushion, surplus, shortage, deficiency) and periodic statements under 12 CFR 1026.41 on the core; property-tax bill source behind an operator verification gate; IPFS pinning of the terms manifest with the CID verified in the asset metadata | control tests, verified-bill audit trail, CID checks |
| M3 | 4–7 | Live custodial statements and daily three-way reconciliation against the payment proofs; 12 CFR 1024.35 through 1024.41 case workflows with SLA evidence; dual-control task queue for the Manila team | reconciliation reports, case fixtures, queue audit log |
| M4 | 6–9 | Production key management (HSM regular keys, 2-of-3 signer lists, rotation drills); settlement-asset decision with the RLUSD and institutional teams; authorized-holder policy for the note asset; Mainnet dry-run criteria | drill logs, decision records |
| M5 | 8–10 | Controlled pilot on real, redacted loan files with the contracting bank; Form 1098 season dry run; evidence packs delivered to the bank's examiner | pilot report, examiner feedback |
| M6 | 9–11 | XLS-65 / XLS-66 readiness study on Devnet (vault deposit and collateral flows with the note asset), with the asset-liability policy questions written for the bank | Devnet run record, policy memo |
| M7 | 11–12 | Independent security review of the threat model; public technical paper; refreshed demo; Mainnet go/no-go | review notes, paper, video |

## 10. Targets and funding logic

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

### Budget: $200,000

| Workstream | Amount | Purpose |
|---|---|---|
| XRPL asset and settlement engineering | $60,000 | Production key management, settlement-asset integration, authorized-holder policy, XLS-65/66 readiness on Devnet, Mainnet dry-run tooling |
| Servicing and data engineering | $50,000 | Escrow analysis, periodic statements, case workflows and Form 1098 on the core; bank receipt integration; tax-bill source and verification gate; operator queue |
| Security and independent technical review | $25,000 | Threat-model review, key handling, access control, penetration test of the operator surface |
| Legal and regulatory | $25,000 | Note-asset characterization (UCC, ESIGN / UETA, securities), California residential carve-outs, Idaho posture, custodial asset, servicing contract |
| Document and AI ingestion | $15,000 | Closing-package scanner pipeline, field extraction validation, IPFS manifest pinning |
| Pilot infrastructure and testing | $15,000 | Hosted rippled or API, controlled datasets, pilot execution |
| Developer documentation and open-source components | $7,000 | Reference implementation upkeep, technical paper, demo materials |
| Contingency | $3,000 | Unplanned integration and testing costs |

## 11. What is not yet true, stated plainly

- No bank has signed a servicing contract yet; the operating assumptions are ours.
- Counsel has not yet characterized the note asset: whether a transferable token that mirrors the note is a negotiable instrument under UCC Article 3, how a security interest in it is perfected under Article 9, whether it is a transferable record under ESIGN / UETA with MERS implications, and whether a transferable cash-flow right is a security. Until answered, the asset stays `RequireAuth` with only the originating lender authorized to hold it.
- No production stablecoin can be escrowed today; the settlement asset is an open decision with the RLUSD and institutional teams.
- XLS-65 / XLS-66 are not on Testnet or Mainnet; the vault and collateral paths are a readiness study (M6), not a feature.
- California residential consumer-protection carve-outs and the Idaho servicing posture go to counsel before a live loan.
- Property-tax and hazard bills in the published runs are fixture values; production needs a live bill source behind an operator verification gate (M2).
- The terms manifest is hashed into the asset metadata but not yet pinned to IPFS; the CID slot is an operator step until a pinning service is on file (M2).
- The core settles and proves payments today; the aggregate escrow analysis, periodic statements, case workflows and Form 1098 modules are built on it during M2–M3 and M5.
- There is no borrower portal or operator web UI; the product surface today is the command line and the database.

## 12. Sustainability and ecosystem contribution

Post-grant revenue comes from servicing fees in the servicer-of-record model and from servicing-operations contracts with banks, with the tokenization and evidence layer priced as an add-on at $0.50 to $1.50 per loan per month. Everything in this repository stays open: the `mortgageos` schema, the note-asset MPT pattern and metadata shape, the memo format, the transaction builders, the payment-proof and audit-log contract, and the Testnet lessons any regulated team building on MPT and TokenEscrow will meet.

## 13. Submission positioning

MortgageOS is mortgage tokenization and servicing infrastructure with an XRPL asset layer and settlement rail. We do not state or imply that an XRPL object replaces a deed, note, lien, title registry, escrow account or regulated servicing function; we do not offer the asset to the public and we do not promise liquidity, fractional trading or investor returns. Standard language: "MortgageOS keeps a digital twin of each mortgage note on the XRP Ledger for the lending institution that owns it, settles the fixed monthly payments through date-locked escrows, and records each payment as an on-chain proof. The legally enforceable mortgage, lien, title and property records remain governed by applicable law and authoritative registries, and the borrower's obligation is unchanged by anything done with the asset."

We look forward to a long and prosperous relationship working with Ripple and the XRPL community.

Sincerely,

<p class="signspace">&nbsp;</p>

<p class="sig"><b>Rich Young</b><br>Founder, President and Lead Broker<br>High Tech Mortgage, Inc.<br>hightechmortgage.com</p>

<p class="sig"><b>Dr Van Wilson</b><br>Project contact for the HTM–GRC joint venture<br>Global Realtor 4A Cause<br><a href="mailto:vanw@globalrealtor4acause.com">vanw@globalrealtor4acause.com</a></p>

<div class="pagebreak"></div>

## Appendix: Sources and evidence

- Repository, README (tokenomics section) and architecture: <https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm> (branch `v3`, `docs/v3-architecture.md`)
- Testnet evidence report: <https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/evidence/v3/> (loan, note issuance and flags, transaction hashes with explorer links, payment proofs, audit result); raw JSON in `docs/evidence/v3/`
- Fannie Mae/Freddie Mac Uniform Instruments: Multistate Fixed Rate Note, Form 3200 <https://singlefamily.fanniemae.com/media/27086/display>; California Deed of Trust, Form 3005 <https://www.fhfa.gov/mortgage-translations/document/form-3005-california-deed-of-trust>
- Fannie Mae Servicing Guide (published March 11, 2026): <https://servicing-guide.fanniemae.com/>; B-1-01 Administering an Escrow Account and Paying Expenses; C-1.1-01 Servicer Responsibilities for Processing Mortgage Loan Payments
- RESPA, Regulation X, 12 CFR part 1024: <https://www.ecfr.gov/current/title-12/chapter-X/part-1024> (§ 1024.17 escrow accounts; §§ 1024.33, 1024.35–1024.41 mortgage servicing)
- TILA, Regulation Z, 12 CFR part 1026: <https://www.ecfr.gov/current/title-12/chapter-X/part-1026> (§ 1026.36(c) prompt crediting; § 1026.39 mortgage transfer disclosures; § 1026.41 periodic statements)
- IRS Form 1098, Mortgage Interest Statement, 26 U.S.C. § 6050H: <https://www.irs.gov/forms-pubs/about-form-1098>
- XRPL Grants: <https://xrplgrants.org>; XRPL feature state verified 2026-09-11 on the Amendments ledger object (Testnet: MPTokensV1, TokenEscrow, Credentials, PermissionedDomains, DepositAuth / DepositPreauth enabled; SingleAssetVault and LendingProtocol on Devnet only)
