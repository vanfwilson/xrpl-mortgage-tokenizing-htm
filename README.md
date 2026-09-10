<p align="center">
  <a href="https://hightechmortgage.com"><img src="assets/brand/htm-logo.png" alt="HighTechMortgage — Bridging Institutional Real Estate & The Digital Economy" width="760"></a>
</p>
<p align="center">
  <a href="https://hightechmortgage.com/mortgageos.html"><img src="assets/brand/mortgageos-lockup-tight.png" alt="MortgageOS™ — Financial coordination layer. Secure Digital Mortgage Operating System." width="640"></a>
</p>

# Service a residential mortgage for thirty years. Prove every dollar on the XRP Ledger.

**Version 2.0.0** — see [CHANGELOG.md](CHANGELOG.md). Two independent builds were compared and merged ([docs/branch-comparison-2026-09-10.md](docs/branch-comparison-2026-09-10.md)).

## What this software does

This is the servicing layer of **MortgageOS™**, High Tech Mortgage's digital mortgage operating system. It takes the
paper a title company produces when a home purchase closes, reads it, checks every figure to the cent, boards the loan,
and then does what a mortgage servicer does every month for thirty years: apply the borrower's payment, remit principal
and interest to the bank that owns the note, reserve property tax and hazard insurance, remit the FHA mortgage-insurance
premium, pay the county and the carrier on their statutory dates, run the annual escrow analysis, send the borrower's
statements, and produce the IRS Form 1098. The XRP Ledger is used for three things it does better than a database:
an immutable fingerprint of the loan file, exact-cent settlement events anyone can reconcile without seeing borrower data,
and a native date lock that makes it impossible to release impound money before the day it is due.

**Who we are.** HTM is a licensed California mortgage broker with an operations centre in Manila. The loans are standard
Fannie Mae uniform-instrument, fixed-rate, 30-year residential loans (the fixture is FHA-insured, Idaho property) funded and
owned by banks we work with under contract. HTM operates in one of two ways, and the software is the same in both: as the
servicer of record for its own clients under its California DFPI and DRE licences, through a servicing entity kept separate
from the brokerage; or as the servicing-operations and technology contractor to a bank that is itself the official servicer
and keeps banking compliance and liability. The Manila team executes servicing tasks under dual control in both models. We
do not raise capital, sell interests in loans, or run a lending pool.

**What it is not.** The ledger record does not replace the Note, the Deed of Trust, the lien, the county record, the
bank's custodial accounts or the servicer's books. A validated ledger transaction is evidence of a settlement event; it is
not proof of legal compliance, of payee receipt, of document validity, of servicing authority, or of custody. No borrower
personal data goes on the ledger. Everything here runs on the ledger's public **test network** with a controlled test USD
and a fictitious homeowner.

**See it:** [Testnet loan-year run](docs/testnet-run.md) · [escrow analysis worked example](docs/escrow-analysis-example.md) · [Form 1098 example](docs/form-1098-example.json) · [the filled, signed closing package we scan (PDF)](forms/closing-package-stack.pdf) · [step-by-step walkthrough](WALKTHROUGH.md) · [glossary for finance people](GLOSSARY.md) · [architecture](docs/architecture.md) · [threat model](docs/threat-model.md) · [team](TEAM.md) · [grant proposal (PDF, 2026-09-10)](docs/grant-proposal-2026-09-10.pdf) · [reviewer deck (PPTX)](docs/grant-deck-2026-09-10.pptx) · [evidence pack](docs/evidence/run-mtvzvtnk/)

[![ci](https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm/actions/workflows/ci.yml/badge.svg)](https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm/actions)

---

## How it works, in plain words

1. **Paper in.** The closing package (Closing Disclosure, FHA model Note, FHA Idaho Deed of Trust, recorded Warranty Deed
   and the supporting forms) is printed, scanned and read by OCR. Every figure is cross-checked: P&I must match rate and
   term, base loan plus financed UFMIP must equal the note, cash to close must balance, the late charge may not exceed the
   FHA cap, the four payment legs must sum to the monthly payment. If anything disagrees, the run stops.
2. **Board.** The loan becomes a canonical record with one legal owner (the funding bank) and one servicer of record.
   Boarding refuses a loan without a current servicing licence and, for FHA, HUD-approved mortgagee status. The initial
   escrow deposit from the Closing Disclosure enters the tax and hazard subledgers on day one.
3. **Every month.** The borrower's payment is credited as of the day it is received and split into four legs to the cent:
   principal and interest to the bank, tax to the tax impound, hazard insurance to the hazard impound, FHA MIP to its own
   payable and on to HUD. Each leg is an exact-cent issued-USD payment on the ledger with a six-key memo and no personal
   data, signed once and journaled before submission so a crash or timeout can never double-pay. Partial payments go to
   suspense; a full payment is never diverted to late charges.
4. **When a bill is due.** A verified county or carrier bill, never a forecast, is escrowed on the ledger only when the
   impound can fund it in full. If it cannot and the borrower is not more than 30 days overdue, the servicer advances the
   shortfall first, as RESPA requires. The escrow cannot be released before its statutory date; an early release attempt
   fails on the ledger itself.
5. **Once a year.** The escrow account is analysed with the aggregate method: a one-sixth cushion cap, and surplus,
   shortage or deficiency handled exactly as 12 CFR 1024.17(f) allows. The borrower gets the annual statement within
   30 days. Form 1098 is built from receipt-dated interest and the January 1 balance.
6. **Servicing transfer.** Records are exported, the 1024.33 notices go out, misdirected payments are honoured for 60 days,
   and the loan-record token moves to the successor by a zero-price offer. Ownership of the note never changes on the
   ledger; that is a separate legal event with its own notice.

## Which XRPL feature does what

| Primitive | Live on Mainnet | What we create with it |
|---|---|---|
| `Payment` in an issued USD | yes | every settlement leg, exact cents, versioned memo |
| `NFTokenMint` / `NFTokenCreateOffer` / `NFTokenAcceptOffer` | yes | one loan-record handle per loan (hash + opaque id + pointer); hand-off on servicing transfer |
| `EscrowCreate` / `EscrowFinish` / `EscrowCancel` for issued currency (TokenEscrow) | yes | the date lock on each verified near-term impound bill |
| `AccountSet` `asfAllowTrustLineLocking`, `asfDefaultRipple` | yes | the controlled test-USD issuer; the locking flag must be set before any trust line exists |
| `SetRegularKey`, `SignerListSet`, `lsfDisableMaster` | yes | bank key management; the recovery drill is proven on Testnet |

Not used, and why: XLS-65 and XLS-66 (funding protocols for new loans, not on Mainnet), DynamicMPT, Batch,
Smart Escrows, the EVM sidechain and Hooks. See [docs/appendix-deferred-amendments.md](docs/appendix-deferred-amendments.md).
The settlement asset is a controlled test USD because RLUSD's issuers do not permit trust-line locking on Mainnet or Testnet
(checked 2026-09-08); the code refuses to build an escrow when the issuer flag is off.

---

## For engineers

```bash
npm ci
npm run print                                   # print the 23-page synthetic closing package (forms/)
npm run tokenize -- ~/scans/my-scan.pdf         # OCR -> canonical loan record -> tie-outs -> bundle hash
npm run loan-year:replay                        # Track 1: full loan year on the business clock, no network
npm run loan-year -- --key-drill                # Track 2: Testnet proof (Mainnet-live transaction types only; ~20 min, funds 11 faucet wallets)
npm test                                        # 127 offline tests; every R01-R31, S and T1-T14 control has a named test
npm run test:testnet                            # assert the proofs in the latest Testnet run
npm run evidence                                # examiner-ready evidence pack for the latest run (out/evidence/<run>/; the latest Testnet pack is committed under docs/evidence/)
```

Requires Node 20.19+, plus `tesseract` and `poppler` for OCR. No accounts or API keys: the test network hands out play money.

### Repository map

```
data/documents/          the 4 servicing documents as structured JSON (single source for DB, PDFs, ledger)
data/supporting/         URLA 1003, settlement statement, FHA clause fixtures (printed and scanned, not needed to board)
data/servicing-parties.json  county treasurer / carrier / HUD payees and their calendars
forms/                   the printed, filled, signed closing package; forms/blank/ holds the blanks; blank/reference/ the GSE masters
src/ingest/              OCR repair + field extraction; canonical loan schema with tie-outs (R19, R20, R21)
src/domain/              amortization, FHA premiums and late charge, document hashing
src/servicing/           the engine: calendar, boarding, apply, analysis, disburse, statements, transfer, cases, tax, reconcile
src/xrpl/                the adapter: issuer preflight, NFToken record, exact-cent settlement, TokenEscrow, keys
src/loan-year.ts         the loan-year orchestrator (replay, Testnet, Devnet smoke)
src/pdf/                 CD overlay on the CFPB blank; FHA note / deed of trust / deed / statement typesetting
src/scan/                tesseract pipeline, compare-to-record, servicing statement -> application gates
src/db/, db/             Postgres schema: closing package, subledger, escrow decisions, statements, tax forms, reconciliation
docs/                    architecture, threat model, worked examples, Testnet run, research and audits
```

### Numbers that must tie

| Figure | Value | Source |
|---|---|---|
| Note amount | $450,000.00 = $442,260.44 base + $7,739.56 financed UFMIP (1.75 % of base, HUD ML 2023-05) | CD Loan Terms |
| Rate / term | 6.250 % / 360 months | FHA model note s.2, s.3 |
| P&I | $2,770.73, fixed for the life of the loan | computed; must equal CD and Note |
| Tax impound | $285.00 / month ($3,420 / yr, Ada County halves of $1,710 on Dec 20 and Jun 20, Idaho Code 63-903) | CD Estimated Taxes |
| Hazard impound | $125.00 / month ($1,500 renewal Sep 1) | CD Estimated Taxes |
| FHA MIP | $184.28 / month (0.50 % of base at 78.98 % LTV), remitted monthly to HUD | CD Mortgage Insurance |
| Monthly payment | $3,365.01 | CD Estimated Total Monthly Payment |
| Late charge | 4 % of P&I = $110.83 after 15 days (24 CFR 203.25) | FHA model note s.6 |
| Cash to close | $91,400.00 | CD Calculating Cash to Close |

`npm run ingest` fails if any of these disagree across documents.

### Compliance posture

Technical feasibility only; no legal claims. The regulatory control map is implemented row by row (module and named test per
row, see [docs/architecture.md](docs/architecture.md#11-regulatory-control-map--modules-and-tests)):

- **RESPA Regulation X** 12 CFR 1024.17 (escrow accounts: aggregate analysis, one-sixth cushion, surplus, shortage,
  deficiency, timely disbursement, initial and annual statements), 1024.33 (servicing transfers), 1024.35–.36 (errors and
  information requests), 1024.37 (force-placed insurance), 1024.38 (records), 1024.39–.41 (early intervention, loss mitigation).
- **Regulation Z** 12 CFR 1026.36(c) (crediting as of receipt), 1026.41 (periodic statements), 1026.39 (ownership-transfer
  notice), 1026.3(a) (consumer purpose; the business-credit exemption is never available here).
- **FHA** 24 CFR 203.25 (late charge ≤ 4 %), HUD Mortgagee Letter 2023-05 (UFMIP and MIP on the base loan), HUD Handbook
  4000.1 (servicing and custodial accounts).
- **State** Idaho Code 63-903 (tax dates); Cal. Civ. Code 2954.8 (2 % impound interest) and 2954.85 (loss-draft accounts).
- **IRS** Form 1098, Form 1099-INT; 1099-A/C handoffs.
- **GLBA** safeguards and CFPB Bulletin 2016-02 vendor oversight for the Manila team.

Explicit non-guarantees: a ledger transaction does not prove legal compliance, payee receipt, document validity, servicing
authority or custody. Items that remain **open** are listed under "Open business items" below: residential carve-outs and
the Idaho posture to counsel; the first bank servicing contract; whether any production stablecoin can serve as a custodial
asset; the Idaho escrow-interest rule; the bank's acceptance of ledger evidence in its books; a live tax-bill source; traction.

### What v2.0 is and is not

v2.0 is a servicing engine, a settlement adapter and an evidence surface for the servicer's operations and
compliance teams. Its product surface is the command line and the evidence pack: `npm run loan-year:replay` for a full
loan year on the business clock, `npm run loan-year` for the Testnet proof, `npm run evidence` for the examiner folder,
and the bank receipt-file contract in [docs/architecture.md](docs/architecture.md#7c-bank-receipt-file-the-input-to-the-three-way-match-v20-roast-rs1)
for the bank's treasury export. There is no borrower portal and no operator web UI in v2.0; those are
integration work for the bank's existing systems, not part of this release. Ledger cost per loan-year, and how
the footprint scales, is stated in [docs/cost-model.md](docs/cost-model.md). Behaviour when the ledger is unreachable
is a written contract, not an assumption ([architecture §7b](docs/architecture.md#7b-degraded-mode-the-ledger-is-unreachable-v20-roast-rs4)).

The v2.0 roast verdict and the engineering items it produced are recorded in
[docs/roast-v2-2026-09-10.md](docs/roast-v2-2026-09-10.md).

### Open business items

These are not engineering gaps and the software does not claim them closed:

- A bank's written acceptance of the ledger-side evidence trail as part of its books and records, in either operating model.
- Licensing: HTM has confirmed that its California DFPI and DRE licences permit originating and servicing for its own
  clients and contracting to banks, for commercial loans and for residential loans within California's consumer-protection
  limits. The residential carve-outs and the Idaho posture still go to counsel before a live loan.
- A production settlement instrument. The runs use a controlled test USD because RLUSD issuers do not allow trust-line
  locking on Mainnet or Testnet; nothing here depends on RLUSD changing.
- The Idaho escrow-interest rule (gated as UNVERIFIED in the engine) and the first bank servicing contract itself.
- A live tax-bill source. Bills in the runs come from a fixture; production needs a tax-service feed or county connectors
  behind an operator verification gate before a bill can be escrowed.

### About HTM

High Tech Mortgage, Inc. is a licensed US mortgage broker (Sacramento, CA) with an operations office in Manila. MortgageOS™
is our digital-twin platform for the mortgage lifecycle; this repository is its servicing and settlement layer.
<https://hightechmortgage.com/tokenized-mortgages/>

Licence: MIT License (the software licence, unrelated to the MIT university credential on the team page). Mainnet feature
state verified 2026-09-08: MPTokensV1, Credentials, PermissionedDomains, TokenEscrow, NonFungibleTokensV1_1 enabled;
the XLS-65 and XLS-66 amendments, DynamicMPT and BatchV1_1 disabled.
