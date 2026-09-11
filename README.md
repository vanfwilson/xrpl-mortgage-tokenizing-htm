<p align="center">
  <a href="https://hightechmortgage.com"><img src="assets/brand/htm-logo.png" alt="HighTechMortgage — Bridging Institutional Real Estate & The Digital Economy" width="760"></a>
</p>
<p align="center">
  <a href="https://hightechmortgage.com/mortgageos.html"><img src="assets/brand/mortgageos-lockup-tight.png" alt="MortgageOS™ — Financial coordination layer. Secure Digital Mortgage Operating System." width="640"></a>
</p>

# Tokenize the note. Service it for thirty years. Prove every payment on the XRP Ledger.

**Version 3.1.0** — see [CHANGELOG.md](CHANGELOG.md). v3 is a Python engine on XRPL Multi-Purpose Tokens and TokenEscrow;
the v2 TypeScript engine it replaces is archived on `main` and described in [docs/architecture.md](docs/architecture.md).

## What this software does

This is the tokenization and servicing layer of **MortgageOS™**, High Tech Mortgage's digital mortgage operating system.
It keeps two strictly separated things on the XRP Ledger for every 30-year fixed-rate residential loan:

- **The asset layer.** One Multi-Purpose Token issuance per loan is the unalterable digital twin of the mortgage note:
  the lending institution's right to receive the fixed principal-and-interest cash flow. It is held by the lender at face
  value for the life of the loan, transferable only between authorized institutions, escrowable and lockable, and never
  clawback-able.
- **The servicing rail.** Every month's fixed P&I payment and the tax and insurance impounds settle through native
  TokenEscrow contracts that cannot be finished before the due date. Each validated `EscrowFinish` is an on-chain,
  cryptographic proof of payment, and an audit sweep re-reads every proof from the ledger. Outstanding principal,
  escrow analysis and everything about the borrower live in the servicer's PostgreSQL books, never on the ledger.

**Who we are.** HTM is a licensed California mortgage broker with an operations centre in Manila. The loans are standard
Fannie Mae uniform-instrument, fixed-rate, 30-year residential loans funded and owned by banks we work with under contract.
HTM operates in one of two ways, and the software is the same in both: as the servicer of record for its own clients under
its California DFPI and DRE licences, through a servicing entity kept separate from the brokerage; or as the
servicing-operations and technology contractor to a bank that is itself the official servicer and keeps banking compliance
and liability. We do not raise capital and we do not sell interests in loans to the public; the note asset moves only
between authorized financial institutions.

**What it is not.** The token does not replace the Note, the Deed of Trust, the lien, the county record, the bank's
custodial accounts or the servicer's books; those stay governed by law and authoritative registries. The borrower's
obligation is a personal, non-negotiable consumer debt under RESPA and TILA and is untouched by anything the lender does
with the asset. A validated ledger transaction is evidence of a settlement event, not proof of legal compliance, payee
receipt, document validity, servicing authority or custody. No borrower personal data goes on the ledger. Everything here
runs on the ledger's public **test network** with a self-issued test USD and a fictitious loan.

**See it:** [v3 architecture](docs/v3-architecture.md) · [tokenomics and institutional liquidity](#tokenomics-and-institutional-liquidity-architecture) · [v3 Testnet evidence](docs/evidence/v3/) · [Hooks sidecar, proven on Xahau](hooks/) · [glossary for finance people](GLOSSARY.md) · [threat model](docs/threat-model.md) · [team](TEAM.md) · [grant proposal (PDF, 2026-09-11)](docs/grant-proposal-2026-09-11.pdf) · [reviewer deck (PPTX)](docs/grant-deck-2026-09-11.pptx) · [v2 Testnet demo and evidence pack (archived)](docs/testnet-run.md)

[![ci](https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm/actions/workflows/ci.yml/badge.svg)](https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm/actions)

---

## How it works, in plain words

1. **Board and tokenize.** The loan (principal, rate, term, last actual tax and insurance bills) is written to the
   `mortgageos.loans` table and the fixed P&I is computed once. The issuer mints one MPT issuance whose supply is the
   note's face value in cents and whose XLS-89d metadata carries the fixed terms, a hash of the terms manifest and a slot
   for its IPFS CID. The lending institution is authorized and receives the whole issuance: it now holds the note asset.
2. **Guard the money.** The issuer, the lender and the impound custodial account run `DepositAuth`; only pre-authorized
   counterparties can pay them.
3. **Every month, the same payment.** The engine reads the next period from the schedule and the borrower creates two
   escrows of the settlement USD: the fixed P&I leg to the lender and the impound leg to the impound account, each with
   `FinishAfter` set to the due date and a memo carrying the principal / interest / tax / insurance split and the
   regulatory markers. On the due date the destination finishes the escrow. The validated finish transaction is the
   proof of payment; the servicer's books reduce outstanding principal by the period's principal portion. The token's
   face value never changes.
4. **Impounds.** Property tax and hazard insurance are collected as one-twelfth of the last actual annual bill (12 CFR
   1024.17); a new bill above what was collected is advanced by the servicer and recovered at the next analysis.
5. **Audit.** A sweep checks that the lender still holds the note at face value and re-reads every settled leg's finish
   transaction from the ledger (validated, `tesSUCCESS`), stamping the proof's ledger index on the row. Any miss, any
   failed broadcast, any ledger error code or timeout is written to the audit log with the full transaction envelope.

## Which XRPL feature does what

| Primitive | Live on Mainnet | What we create with it |
|---|---|---|
| `MPTokenIssuanceCreate` (`CanEscrow`, `CanTransfer`, `CanLock`, `RequireAuth`; no `CanClawback`) | yes | the note asset: one issuance per loan, supply = face value in cents, XLS-89d metadata with the fixed terms, manifest hash and CID slot |
| `MPTokenAuthorize`, `Payment` of MPT units | yes | authorize the lending institution and deliver the note to it |
| `MPTokenIssuanceSet` lock / unlock | yes | asset hold on a holding (title dispute, foreclosure) and release |
| `AccountSet asfDepositAuth` + `DepositPreauth` | yes | only pre-authorized counterparties can pay the issuer, the lender and the custodial accounts |
| `AccountSet asfAllowTrustLineLocking` (flag 17) | yes | set on the settlement-USD issuer before any trust line, verified and mirrored to `issuer_accounts.escrow_enabled` |
| `EscrowCreate` / `EscrowFinish` of an MPT (TokenEscrow, XLS-85) | yes | the fixed P&I and impound legs, date-locked to the due date, split in the memo; the validated finish is the proof of payment |

Not used, and why: `Clawback` (the note is an asset at face value; amortization is a servicing figure in the books),
Hooks (not enabled on XRPL Mainnet or Testnet; the same policy is kept as working C in [hooks/](hooks/) and proven on
Xahau), Smart Escrows (WASM devnet only), XLS-65 / XLS-66 (Devnet only today; see forward compatibility below),
NFTokens. The settlement asset is a self-issued test USD MPT because RLUSD's issuers do not permit trust-line locking, so
RLUSD cannot be escrowed.

## Tokenomics and institutional liquidity architecture

The platform turns a mortgage note from an illiquid, siloed bank record into an on-ledger financial instrument while
keeping the borrower's servicing rail completely separate from it.

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

**The MPT as the note's digital twin.** The token represents the lending institution's legal right to the 30-year
fixed P&I cash flow: face value in cents, fixed terms in the metadata, held at face value for the life of the loan. It is
minted with `CanTransfer` and `CanEscrow`, so it can move between authorized financial entities and be locked into
ledger-native escrows, and with `RequireAuth`, so the issuer decides which institutions may hold it. It is never
clawback-able: nothing burns the asset as the loan amortizes, so a holder's position is exactly what the ledger says it is.

**Borrower protection by separation.** The borrower never touches the asset layer. Their obligation is a personal
consumer debt governed by RESPA Regulation X and TILA; their identity, escrow analysis and outstanding balance live in
the servicer's PostgreSQL books; what reaches the ledger is a date-locked escrow with a split and no personal data.
Whatever a bank does with the note asset cannot change what the borrower owes or when.

**Forward compatibility with XLS-65 / XLS-66.** Because the asset is a standardized, fixed-term, fungible-unit MPT, it
is structurally the kind of instrument the XRP Ledger's native credit primitives are built for: it could be deposited into
a Single Asset Vault (XLS-65) or pledged as collateral in the Lending Protocol (XLS-66) so a bank can obtain short-term
stablecoin financing against its portfolio without selling it. **This phase tokenizes and services only.** On
2026-09-11 both amendments are enabled on XRPL Devnet and not on Testnet or Mainnet; nothing here depends on them and
nothing here exercises them. Pledging 30-year notes for short-term funding is an asset-liability decision for the bank
and its regulator, not for the software.

**The immutable payment rail.** Each month's fixed P&I is a TokenEscrow that cannot be finished before the due date;
each validated `EscrowFinish` is a unique on-chain proof of payment. The audit sweep re-reads those proofs from the
ledger and records their ledger index, giving bank auditors and regulators an unalterable ledger of account they can
verify without seeing borrower data.

---

## For engineers

```bash
uv venv --python 3.12 /Volumes/BackupPlus/venvs/mortgageos
uv pip install --python /Volumes/BackupPlus/venvs/mortgageos/bin/python -r requirements-py.txt
cp .env.example .env                                   # set COUNCILFORGE_DSN (writer role); XRPL_WSS stays Testnet
/Volumes/BackupPlus/venvs/mortgageos/bin/python -m mortgageos.init_issuer                # flag 17 on the settlement issuer
/Volumes/BackupPlus/venvs/mortgageos/bin/python -m mortgageos.verify                     # tokenize, settle one period, audit
/Volumes/BackupPlus/venvs/mortgageos/bin/python -m pytest tests/py/test_mpt_core.py -q  # same, as the exit-contract test suite
```

Both print `ALL COUNCILFORGE MPT VERIFICATION PASSES` only after the live phases and the audit sweep pass.
Requires Python 3.10+, `xrpl-py` 4.5+, and a PostgreSQL database reachable through `COUNCILFORGE_DSN`. Test-network
wallets are faucet-funded once into `out/wallets.py.testnet.json` (gitignored) and reused. The code refuses Mainnet hosts.

### Repository map

```
mortgageos/config.py             environment, Mainnet refusal, wallet roles (issuer, lender, impound, borrower, usdm_issuer, tax_authority)
mortgageos/ledger/client.py      the one submit path: sign once, record Pending, submit, record Confirmed / Failed; error triage
mortgageos/ledger/tx.py          transaction builders: DepositAuth, Preauth, MPT issue / authorize / send / lock, escrow create / finish
mortgageos/ledger/mpt.py         note-asset metadata (XLS-89d), issuance-id extraction, on-chain holding and lock reads
mortgageos/ledger/issuer.py      asfAllowTrustLineLocking on the settlement issuer, mirrored to issuer_accounts
mortgageos/ledger/memo.py        structural memo (split + regulatory markers), PII guard
mortgageos/servicing/            fixed-rate amortization in exact cents with a strict fixed-P&I assertion; RESPA 1024.17 impounds
mortgageos/db/schema.sql         schema `mortgageos`: loans, issuer_accounts, mpt_issuances, ledger_transactions, audit_log, payment_schedule, escrow_legs (+ proof columns)
mortgageos/phases.py             Phase 1 guard + tokenize, Phase 2 fixed P&I through escrow + asset-hold drill, Phase 3 error triage, audit()
mortgageos/verify.py             standalone smoke runner
tests/py/                        pytest suite (offline math + live Testnet phases)
hooks/                           the payment-firewall Hook in C, proven on Xahau Testnet; rebuilt and re-proved on every push by portainer/hooks-builder
docs/                            v3 architecture, evidence, threat model, grant proposal and deck, archived v2 material
```

### Numbers that must tie (v3 fixture)

| Figure | Value | Where it is proven |
|---|---|---|
| Note face value = token supply | $450,000.00 = 45,000,000 units (`AssetScale` 2), constant for 30 years | MPT `MaximumAmount`; lender's `MPTAmount` after every period |
| Rate / term | 6.500 % / 360 months, fixed | metadata `ai.rate_bps`, `ai.term_months` |
| P&I, identical every month | $2,844.31 | metadata `ai.pi_cents`; `payment_schedule.pi_cents` × 360 (final payment absorbs cent rounding); escrow leg `pi` |
| Month-1 interest / principal | $2,437.50 / $406.81 | memo on the P&I escrow |
| Outstanding after month 1 (servicer's books) | $449,593.19 | `loans.outstanding_cents`; not on the ledger |
| Tax impound | $505.21 / month (1/12 of $6,062.50) | escrow leg `impound` |
| Hazard impound | $150.00 / month (1/12 of $1,800.00) | escrow leg `impound` |

The offline test checks the payment against the closed-form annuity formula to the cent, that every period's P&I is
identical, and that the 360 principal portions sum exactly to the principal; the live suite checks the lender's holding
against face value and re-reads both payment proofs from the ledger.

### Compliance posture

Technical feasibility only; no legal claims. v3 implements the impound rule of **RESPA Regulation X** 12 CFR 1024.17
(one-twelfth of the last actual bill, servicer advance on shortfall, recovery at the next analysis) and carries the
RESPA / TILA markers in every settlement memo. The wider control map that v2 implemented (aggregate analysis with cushion,
statements, servicing transfers, notices of error, loss mitigation, Form 1098; R01–R31 with a named test each) is the
roadmap for v3 and is preserved on `main` and in [docs/architecture.md](docs/architecture.md).

Explicit non-guarantees: a ledger transaction does not prove legal compliance, payee receipt, document validity, servicing
authority or custody. The token is a digital twin of the note's cash-flow right; whether it is itself a negotiable
instrument, an eNote or a security is a question for counsel, listed below.

### What v3.1 is and is not

v3.1 is the asset and settlement core: the note asset, guarded custodial accounts, the fixed P&I stream through
date-locked escrows, on-chain payment proofs, a PostgreSQL system of record with an audit log, and the Xahau-proven Hook
sidecar. Its product surface is the command line and the database. There is no OCR ingest, statement generation, case
workflow, borrower portal or operator UI in v3.1; the v2 versions of the first three are archived on `main` and will be
ported onto the v3 core.

### Open business items

These are not engineering gaps and the software does not claim them closed:

- **Counsel on the note asset** before any live loan: UCC Article 3 negotiability and Article 9 perfection of a transferable
  token that mirrors the note; whether the twin is an eNote under ESIGN / UETA and what that means for MERS registration;
  whether a transferable cash-flow right is a security under federal or California law. Until answered, the asset stays
  `RequireAuth` with only the originating lender authorized.
- **Asset-liability policy.** Pledging 30-year notes for short-term stablecoin funding (the XLS-65 / XLS-66 path) is a
  bank treasury and regulatory decision; this software does not do it and takes no position on when it is prudent.
- A bank's written acceptance of the ledger-side proofs of payment as part of its books and records, in either operating model.
- Licensing: HTM's California DFPI and DRE licences permit originating and servicing for its own clients and contracting
  to banks; the residential carve-outs and the Idaho posture still go to counsel before a live loan.
- A production settlement instrument. The runs use a self-issued test USD MPT because RLUSD issuers do not allow trust-line
  locking on Mainnet or Testnet.
- A live tax-bill source, and IPFS pinning of the terms manifest (the CID slot is an operator step until a pinning service is on file).

### About HTM

High Tech Mortgage, Inc. is a licensed US mortgage broker (Sacramento, CA) with an operations office in Manila. MortgageOS™
is our digital-twin platform for the mortgage lifecycle; this repository is its tokenization, servicing and settlement layer.
<https://hightechmortgage.com/tokenized-mortgages/>

Licence: MIT License (the software licence, unrelated to the MIT university credential on the team page). Feature state
verified 2026-09-11 on the Amendments ledger object: XRPL Testnet has MPTokensV1, TokenEscrow, Credentials,
PermissionedDomains, Clawback, DepositAuth and DepositPreauth enabled; SingleAssetVault and LendingProtocol are enabled on
Devnet only; Hooks, SmartEscrow and DynamicMPT are not enabled on Testnet.
