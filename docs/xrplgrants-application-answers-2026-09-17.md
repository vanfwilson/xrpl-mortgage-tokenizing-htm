# XRPL Grants — Ready-to-Paste Application Answers

Source: `docs/grant-proposal-2026-09-11.md` / `.pdf` (commit `e178fbf`, branch `v3`).
Checked live against xrplgrants.org on 2026-09-17: no general application form is open. Only
two unrelated regional accelerator cohorts (Brinc Hong Kong, Tenity Singapore) have live "Apply
now" links, and the only general contact channel is `info@xrplgrants.org` (mailto) or
`grants@xrplgrants.org` (per the transmittal letter draft). When the standard intake form
reopens on xrplgrants.org, its sections mirror the structure below — copy each answer into the
matching field.

## Project Overview & Executive Summary

**Project name:** MortgageOS™ Tokenization and Servicing Layer

**Project type:** Real World Asset Tokenization (RWA) / Onchain Finance

**Problem solved:** U.S. mortgage notes and their monthly servicing cash flows are illiquid,
siloed bank assets with no independently verifiable settlement record. MortgageOS puts a
strictly separated asset layer (an unalterable MPT digital twin of the note) and servicing rail
(date-locked TokenEscrow settlement of monthly P&I and impounds) on the XRP Ledger, while
keeping the borrower's legal obligation, identity, and outstanding balance off-chain under
existing law (RESPA/TILA) and in the servicer's books.

**Abstract:** MortgageOS™ is being built through a joint venture between High Tech Mortgage,
Inc. (HTM), a licensed California mortgage broker/servicer owned by Rich Young, and Global
Realtor 4A Cause (GRC), a Philippine real-estate and technology company owned by Maria Theresa
Wilson (aka Trish Wilson).
HTM operates MortgageOS in California under its existing licenses; GRC's technical and
international-logistics team (Dr Van Wilson, Bill Thompson) builds and supports the platform,
and Trish's executive-level relationships with three of the Philippines' largest developers
(Megaworld, Ayala Land, ArthaLand) and their lender-bank groups give the venture a path to a
Philippine institutional pilot. The reference implementation (v3.1, published September 11,
2026) is a working Python/PostgreSQL engine on `xrpl-py` that has proven the full cycle on
Testnet: note-asset issuance, monthly escrow settlement, error/timeout handling, and an audit
sweep that re-reads payment proofs from the ledger.

## Technical Architecture & Primitives

- **Multi-Purpose Tokens (MPT / XLS-89d):** one MPT issuance per loan as the unalterable digital
  twin of the note (face value in cents, fixed terms + terms-manifest hash + IPFS CID slot in
  metadata), minted `CanTransfer`, `CanEscrow`, `RequireAuth`. A second MPT is the escrowable
  settlement asset.
- **TokenEscrow (XLS-85):** every month's fixed P&I and impound legs settle through date-locked
  escrow contracts that cannot finish before the due date; each validated finish is an on-chain
  cryptographic proof of payment.
- **DepositAuth:** guards the issuer, lender, and custodial accounts against unauthorized
  payments; supports placing an asset holding on hold during a dispute.
- **Forward compatibility (not exercised this phase):** the MPT note asset is designed to be
  natively compatible with Single Asset Vault (XLS-65) and the Lending Protocol (XLS-66) for
  future collateralized short-term financing; both are enabled on Devnet only as of September
  11, 2026, and nothing in the current implementation depends on them.
- **Five-layer architecture:** legal asset (untouched) → bank custodial accounts/servicing books
  → MortgageOS engine (PostgreSQL system of record + Python event loop + audit sweep) → XRP
  Ledger (MPT note asset, DepositAuth accounts, TokenEscrow legs) → institutional interfaces
  (CLI/DB today, bank system integration during the grant).

## Milestone Roadmap & Evidence (M1–M7, 12 months)

| ID | Months | Milestone | Evidence delivered |
|---|---|---|---|
| M1 | 1–2 | Counsel memos on the note asset (UCC 3/9, ESIGN/UETA, MERS, securities characterization), California residential carve-outs, Idaho servicing posture, custodial settlement asset; first bank servicing contract or LOI; production key-management runbook | memos in `docs/`, signed LOI, runbook |
| M2 | 2–4 | Aggregate escrow analysis (12 CFR 1024.17) and periodic statements (12 CFR 1026.41) on the core; property-tax bill source behind an operator verification gate; IPFS pinning of the terms manifest with CID verified in asset metadata | control tests, verified-bill audit trail, CID checks |
| M3 | 4–7 | Live custodial statements and daily three-way reconciliation against payment proofs; 12 CFR 1024.35–1024.41 case workflows with SLA evidence; dual-control task queue for the Manila team | reconciliation reports, case fixtures, queue audit log |
| M4 | 6–9 | Production key management (HSM regular keys, 2-of-3 signer lists, rotation drills); settlement-asset decision with RLUSD/institutional teams; authorized-holder policy; Mainnet dry-run criteria | drill logs, decision records |
| M5 | 8–10 | Controlled pilot on real, redacted loan files with the contracting bank; Form 1098 season dry run; evidence packs delivered to the bank's examiner | pilot report, examiner feedback |
| M6 | 9–11 | XLS-65/XLS-66 readiness study on Devnet (vault deposit and collateral flows), asset-liability policy questions written for the bank | Devnet run record, policy memo |
| M7 | 11–12 | Independent security review of the threat model; public technical paper; refreshed demo; Mainnet go/no-go | review notes, paper, demo |

Funding gates: build/integration (M1–M3) 30% = $60,000; usage/pilot (M4–M7) 70% = $140,000.

## Budget Allocation ($200,000 total)

| Workstream | Amount | Purpose |
|---|---|---|
| XRPL asset and settlement engineering | $60,000 | Production key management, settlement-asset integration, authorized-holder policy, XLS-65/66 readiness on Devnet, Mainnet dry-run tooling |
| Servicing and data engineering | $50,000 | Escrow analysis, periodic statements, case workflows and Form 1098 on the core; bank receipt integration; tax-bill source and verification gate; operator queue |
| Security and independent technical review | $25,000 | Threat-model review, key handling, access control, penetration test of the operator surface |
| Legal and regulatory | $25,000 | Note-asset characterization (UCC, ESIGN/UETA, securities), California residential carve-outs, Idaho posture, custodial asset, servicing contract |
| Document and AI ingestion | $15,000 | Closing-package scanner pipeline, field extraction validation, IPFS manifest pinning |
| Pilot infrastructure and testing | $15,000 | Hosted rippled or API, controlled datasets, pilot execution |
| Developer documentation and open-source components | $7,000 | Reference implementation upkeep, technical paper, demo materials |
| Contingency | $3,000 | Unplanned integration and testing costs |

## Open-Source Repository & Verification

- **Repository (MIT):** https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm
- **Testnet evidence report:** https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/evidence/v3/

## Team Credentials & Entity Background

- **Rich Young** — Owner, President & Lead Broker, HTM. California DRE Broker's License
  #01106294, NMLS #291547. 30+ years Bay Area real estate and mortgage lending. Directs
  California deployment, origination, servicing and compliance.
- **Dr Van Wilson** — GRC, Data Science, AI & Blockchain. Post-graduate degree in data science
  and AI, MIT (2022). Built Fannie Mae's post-COVID mortgage-forbearance forecasting model and
  an AI legal-document model for the U.S. Securities and Exchange Commission. Designed and wrote
  MortgageOS™; project contact for the HTM–GRC joint venture.
- **Maria Theresa Wilson (aka Trish Wilson)** — Owner, GRC, Philippine Real Estate & Finance. Licensed Philippine real
  estate broker (PRC 0024025), former CPA and banker, licensed U.S. Realtor and International
  Certified Financial Consultant. Executive-level relationships with Megaworld, Ayala Land and
  ArthaLand and their lender-bank groups.
- **Bill Thompson** — GRC, Operations, IT & Logistics. ITIL v4, Six Sigma, CompTIA A+, TOPCIT,
  URAC certified; Ateneo Graduate School of Business.
- **Entity structure:** joint venture between HTM (licensed California mortgage broker/servicer)
  and GRC (Philippine real-estate/technology company). HTM's mortgage-broker and servicing
  licenses are not extended to or held by GRC; the operating models described in the proposal
  are HTM's licensed activities only.

## Contact

Dr Van Wilson, submitting and project contact — vanw@globalrealtor4acause.com
