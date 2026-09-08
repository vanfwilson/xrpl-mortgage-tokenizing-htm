# Grant narrative: XRPL Grants / Brinc × XRPL HFIP

Working answers, kept next to the code so the claims and the repository never drift.

## One paragraph

High Tech Mortgage, Inc. (HTM) is a licensed California mortgage broker with an operations centre in Manila. The loans we
originate are standard Fannie Mae uniform-instrument, fixed-rate, 30-year residential loans (FHA in the fixture) funded and
owned by banks we work with under contract. We do not raise capital or sell interests in loans. We are building the servicing layer of MortgageOS™: the software that services
one of those loans for thirty years after close of escrow, operated for a bank-owned licensed subservicer that is servicer
of record. The XRP Ledger gives that layer three things a private database cannot: an immutable fingerprint of the loan
file, exact-cent settlement events that anyone can reconcile without seeing borrower data, and a native date lock that makes
early release of impound money impossible. This repository boards a synthetic loan from its scanned closing package, services
a full loan year on Testnet with only Mainnet-live transaction types, and implements the RESPA, Regulation Z, FHA, state and
IRS controls as code with a named test per requirement.

## Problem

Mortgages are thirty-year credit assets. The hard problem is not issuing a token; it is keeping the legal asset, its
servicing data, its cash flows and its evidence trail consistent for decades across servicing transfers, tax changes and
audits. Escrow mistakes, misapplied payments and late tax disbursements are the most common servicing failures and the most
expensive to remediate.

## What the ledger does, and does not do

Does: fingerprint the loan file (NFToken URI); record every settlement leg to the cent with a six-key memo; lock each
verified impound bill until its statutory date; prove servicing hand-offs. Does not: decide what the borrower owes, replace
the bank's custodial accounts, cure a shortage, send statutory notices, satisfy any regulation by itself, or confer a
licence. The bank subservicer's books are legally authoritative; the ledger is evidence and enforcement of one narrow
guarantee.

## Track fit

- **Payments / institutional DeFi.** Exact-cent issued-currency settlement with idempotent legs and three-way
  reconciliation.
- **Real-world assets.** A per-loan record handle with an operative-document hash chain, designed so a bank can adopt it
  without changing what is legally authoritative.
- **Developer tooling.** Open schemas: the canonical loan record, the 1024.17 analysis, the subledger, the memo format,
  and R01–R31 as reusable tests.

## What is already true

- Paper → OCR → canonical record → tie-outs (P&I, base + UFMIP, cash to close, four legs, FHA cap, LTV/MIP on base).
- Servicing engine: receipt-date application, aggregate escrow analysis with the exact (f)(2)–(f)(4) options, advance-first
  disbursement, statements with deadline clocks, 1024.33/1026.39 transfer clocks, NOE/RFI/force-placed/early-intervention
  clocks, Form 1098 and 1099-INT, hash-chained reconciliation. 86 offline tests.
- Testnet loan year: NFToken record, 75+ exact-cent legs, three impound escrows created and finished, one adjustment escrow
  cancelled, an early-finish attempt refused by the ledger, an NFToken hand-off, a key-disable drill. Published with a
  clock-mapping manifest.

## What is not yet true (and we say so)

- No bank subservicer has signed; the operating assumptions are ours. **UNVERIFIED.**
- No production stablecoin can be escrowed today (RLUSD's issuers do not allow trust-line locking). **UNVERIFIED** whether any
  bank stablecoin can serve as a custodial asset.
- HTM's licence scope and mortgage-servicing-rights treatment in California and Idaho are for counsel. **UNVERIFIED.**
- The Idaho escrow-interest rule could not be located; the Idaho production profile is blocked in code until counsel signs.
- Documents are synthetic; production ingest hashes an eVault eNote, not a scan.

## 12-month milestones

| Months | Milestone | Evidence |
|---|---|---|
| 1–2 | Counsel memos (licensing, MSR treatment, custodial asset); subservicer design partner LOI | memos in `docs/`, LOI |
| 2–4 | Bank receipt files replace the simulated bank mirror; daily three-way reconciliation against real custodial statements | reconciliation reports |
| 4–7 | Full 1024.35–.41 case workflows with SLA evidence; periodic statement PDFs; delivery evidence | case fixtures, golden PDFs |
| 6–9 | Production key management (HSM regular keys, 2-of-3 signer lists) and dual-control task queue for Manila | runbooks, drill logs |
| 8–10 | Controlled pilot on real, redacted loan files with the subservicer; 1098 season dry run | pilot report |
| 10–12 | Security review of the threat model; public technical paper; Mainnet go/no-go criteria | audit notes, paper |

## Ask

Non-dilutive milestone funding for the plan above, plus introductions to a bank subservicer design partner and to the
RLUSD / institutional team on the custodial-asset question.
