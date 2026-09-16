# Grant narrative: XRPL Grants / Brinc × XRPL HFIP

Working answers for the application forms, kept next to the code so the claims, the letter (`grant-proposal-2026-09-11.md`) and the repository never drift. Updated September 17, 2026.

## One paragraph

High Tech Mortgage, Inc. (HTM) is a licensed California mortgage broker with offices in California, Idaho and Manila, a Swiss office opening soon, and Manila as its operations centre. The loans we work with are standard conventional, fixed-rate, 30-year residential loans on the Fannie Mae/Freddie Mac Uniform Instruments (Form 3200 note, Form 3005 California deed of trust), funded and owned by banks we work with under contract and serviced to the Fannie Mae Servicing Guide and the CFPB rules under Regulation X and Regulation Z. We do not raise capital or sell interests in loans. MortgageOS™ puts two strictly separated things on the XRP Ledger for every loan: one Multi-Purpose Token issuance is the digital twin of the note, held by the lending bank at face value for the life of the loan; and every month's fixed principal-and-interest and impound legs settle through native TokenEscrow contracts that cannot be finished before the due date, each validated finish an on-chain proof of payment. Everything about the borrower, and the outstanding balance, stays in the servicer's books. Version 3.1 runs today on Testnet using only amendments live on Mainnet: <https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm>.

## Problem

Mortgages are thirty-year credit assets. The hard problem is not issuing a token; it is keeping the legal asset, its servicing data, its cash flows and its evidence trail consistent for decades across tax changes, servicing transfers and audits, while the note itself stays an illiquid, siloed bank record. Escrow mistakes, misapplied payments and late tax disbursements are the most common servicing failures and the most expensive to remediate. In the Philippines mortgage lending is still uncommon; after the Bangko Sentral ng Pilipinas cut the reserve requirement for universal and commercial banks to 5% (effective March 8, 2025), banks want to lend but lack a way to originate, fund and service residential loans without risk they cannot measure.

## What the ledger does, and does not do

Does: hold one note asset per loan with the lending institution (an MPT whose supply is the face value in cents, with XLS-89d metadata carrying the fixed terms, the terms-manifest hash and an IPFS CID slot; escrowable, transferable, holdable; `RequireAuth`, and the issuer cannot take units back); lock each month's P&I and impound legs under a TokenEscrow with the split in the memo; refuse payments from anyone not pre-authorized (`DepositAuth`); place a holding on hold for a dispute. Does not: decide what the borrower owes, replace the Note, Deed of Trust, lien, county record, custodial accounts or the servicer's books, cure a shortage, send statutory notices, satisfy any regulation by itself, confer a licence, or carry borrower PII. The servicer's books, held against the bank's custodial accounts, are legally authoritative; the ledger is evidence and enforcement of one narrow guarantee.

## Track fit

- **Multi-Purpose Tokens as an institutional asset.** A transferable, escrowable, lockable note twin with XLS-89d metadata, plus a second MPT as the escrowable settlement asset, designed for the credit primitives that follow (XLS-65 / XLS-66, forward compatibility only).
- **Institutional settlement.** Date-locked TokenEscrow legs with an exact-cent split in the memo, DepositAuth-guarded accounts, and payment proofs re-verified from the ledger.
- **Developer tooling.** MIT-licensed `mortgageos` schema, metadata shape, memo format, transaction builders, audit-log contract and the tests any team can reuse for a regulated asset on XRPL.

## What is already true (v3.1, September 11, 2026)

- Phase 1 boards a loan ($450,000 at 6.5 % over 360 months, P&I $2,844.31): DepositAuth and DepositPreauth on the issuer, the lender and the impound account; the note asset minted with flags `CanEscrow | CanTransfer | CanLock | RequireAuth`; the lender authorized and delivered the full face value; the issuance id proven equal between the ledger and the database.
- Phase 2 settles a period: a strict fixed-rate schedule (identical P&I for 360 periods) in PostgreSQL; the P&I leg to the lender and the impound leg to the custodial account escrowed with the split in the memo; both finish on the due date with `tesSUCCESS`; the books reduce principal by $406.81 while the on-ledger face value stays 45,000,000 units; asset hold placed and released. The audit sweep re-reads both finish transactions from the ledger.
- Phase 3 proves error triage: a forced `tecPATH_PARTIAL` and a forced timeout are caught, written to the audit log with the raw code and envelope, and the engine exits cleanly.
- Impounds are computed under 12 CFR 1024.17 as a rolling one-twelfth of the last actual annual bill, with the servicer advancing any shortfall. Evidence: <https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/evidence/v3/>.

## What is not yet true (and we say so)

- No bank has signed a servicing contract yet; the operating assumptions are ours.
- Counsel has not yet characterized the note asset (UCC Articles 3 and 9, ESIGN / UETA transferable records and MERS, securities); until then it stays `RequireAuth` with only the originating lender authorized.
- No production stablecoin can be escrowed today (RLUSD's Testnet issuer does not allow trust-line locking); the settlement asset is an open decision.
- XLS-65 / XLS-66 are on Devnet only; the vault and collateral paths are a readiness study, not a feature.
- California residential carve-outs and the Idaho servicing posture go to counsel before a live loan.
- Tax and hazard bills in the runs are fixture values; production needs a live bill source behind an operator verification gate.
- The core settles and proves payments today; aggregate escrow analysis, periodic statements, case workflows and Form 1098 are built on it during the grant.

## How we operate

Three models, one codebase: servicer of record for HTM's own clients under its California licences; servicing-operations and technology contractor to a bank that is the official servicer; and shareholder in a licensed Philippine bank (HTM intends a 40 % position in a small provincial bank near Clark International Airport, with a partner invited for up to 20 %). The Manila team executes servicing tasks under dual control in all three and never holds signing keys.

## 12-month milestones

| Months | Milestone | Evidence |
|---|---|---|
| 1–2 | Counsel memos on the note asset, California carve-outs, Idaho posture and the custodial settlement asset; first bank servicing contract or LOI; key-management runbook | memos in `docs/`, LOI, runbook |
| 2–4 | Aggregate escrow analysis under 12 CFR 1024.17 and periodic statements under 12 CFR 1026.41 on the core; live tax-bill source behind an operator verification gate; IPFS pinning with the CID verified in the asset metadata | control tests, verified-bill trail, CID checks |
| 4–7 | Live custodial statements and daily three-way reconciliation against the payment proofs; 12 CFR 1024.35–.41 case workflows with SLA evidence; dual-control task queue for Manila | reconciliation reports, case fixtures, queue log |
| 6–9 | Production key management (HSM regular keys, 2-of-3 signer lists, rotation drills); settlement-asset decision with the RLUSD / institutional teams; authorized-holder policy; Mainnet dry-run criteria | drill logs, decision records |
| 8–10 | Controlled pilot on real, redacted loan files with the contracting bank; Form 1098 season dry run; evidence packs to the bank's examiner | pilot report, examiner feedback |
| 9–11 | XLS-65 / XLS-66 readiness study on Devnet with the asset-liability policy questions written for the bank | Devnet run record, policy memo |
| 11–12 | Independent security review; public technical paper; refreshed demo; Mainnet go/no-go | review notes, paper, video |

## Ask

$200,000 of milestone-gated funding over 12 months; a partner for up to a 20 % share of the provincial bank acquisition so the acquisition and the XRPL rollout move faster; introductions to banks that outsource servicing operations and to the RLUSD / institutional team on the custodial-asset question.
