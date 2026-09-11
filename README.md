<p align="center">
  <a href="https://hightechmortgage.com"><img src="assets/brand/htm-logo.png" alt="HighTechMortgage — Bridging Institutional Real Estate & The Digital Economy" width="760"></a>
</p>
<p align="center">
  <a href="https://hightechmortgage.com/mortgageos.html"><img src="assets/brand/mortgageos-lockup-tight.png" alt="MortgageOS™ — Financial coordination layer. Secure Digital Mortgage Operating System." width="640"></a>
</p>

# Service a residential mortgage for thirty years. Prove every dollar on the XRP Ledger.

**Version 3.0.0** — see [CHANGELOG.md](CHANGELOG.md). v3 is a Python engine on XRPL Multi-Purpose Tokens and TokenEscrow;
the v2 TypeScript engine it replaces is archived on `main` (tag history) and described in [docs/architecture.md](docs/architecture.md).

## What this software does

This is the servicing layer of **MortgageOS™**, High Tech Mortgage's digital mortgage operating system. For each 30-year
fixed-rate residential loan it keeps one non-transferable **record of account** on the XRP Ledger, collects the monthly
payment and the property-tax and hazard-insurance impounds through **date-locked escrows**, amortizes the record every month
so the on-ledger balance equals the outstanding principal in the servicer's books, and mirrors every ledger event into a
PostgreSQL schema that is the authoritative system of record. The ledger is used for what it does better than a database:
an immutable, non-transferable record anyone can verify without seeing borrower data; exact-cent settlement events; and a
native date lock that makes it impossible to release impound money before the day it is due.

**Who we are.** HTM is a licensed California mortgage broker with an operations centre in Manila. The loans are standard
Fannie Mae uniform-instrument, fixed-rate, 30-year residential loans funded and owned by banks we work with under contract.
HTM operates in one of two ways, and the software is the same in both: as the servicer of record for its own clients under
its California DFPI and DRE licences, through a servicing entity kept separate from the brokerage; or as the
servicing-operations and technology contractor to a bank that is itself the official servicer and keeps banking compliance
and liability. We do not raise capital, sell interests in loans, or run a lending pool.

**What it is not.** The record of account is not the Note. It cannot be transferred, traded or sold: the token has no
`CanTransfer` flag, so its units can only move between the issuer and the servicer's custodial account. It does not replace
the Note, the Deed of Trust, the lien, the county record, the bank's custodial accounts or the servicer's books. A validated
ledger transaction is evidence of a settlement event, not proof of legal compliance, payee receipt, document validity,
servicing authority or custody. No borrower personal data goes on the ledger. Everything here runs on the ledger's public
**test network** with a self-issued test USD and a fictitious loan.

**See it:** [v3 architecture](docs/v3-architecture.md) · [v3 Testnet evidence](docs/evidence/v3/) · [glossary for finance people](GLOSSARY.md) · [threat model](docs/threat-model.md) · [team](TEAM.md) · [grant proposal (PDF, 2026-09-11)](docs/grant-proposal-2026-09-11.pdf) · [reviewer deck (PPTX)](docs/grant-deck-2026-09-11.pptx) · [v2 Testnet demo and evidence pack (archived)](docs/testnet-run.md)

[![ci](https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm/actions/workflows/ci.yml/badge.svg)](https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm/actions)

---

## How it works, in plain words

1. **Board.** The loan (principal, rate, term, last actual tax and insurance bills) is written to the `mortgageos.loans`
   table. The issuer account mints one Multi-Purpose Token issuance for it: supply equals the principal in cents, the
   metadata carries a hash of the loan manifest and a slot for its IPFS CID, and the flags allow lock, clawback and escrow
   but **not transfer**. The servicer's custodial account is authorized and receives the full principal in units.
2. **Guard the money.** The issuer and both custodial accounts (P&I and impound) run `DepositAuth`; only pre-authorized
   counterparties can pay them. The borrower never pays the issuer.
3. **Every month.** The engine reads the next scheduled period from the database and the borrower creates two escrows of the
   settlement USD: the P&I leg to the servicer and the impound leg to the impound account, each with `FinishAfter` set to
   the due date and a memo carrying the principal / interest / tax / insurance split and the regulatory markers. While a
   period is unsettled the record is locked. On the due date the destination finishes the escrow; the issuer then claws
   back that month's principal from the record so the on-ledger balance equals the new outstanding principal, and unlocks.
4. **Impounds.** Property tax and hazard insurance are collected as one-twelfth of the last actual annual bill (12 CFR
   1024.17). If a new bill exceeds what has been collected, the servicer advances the shortfall and recovers it at the next
   analysis.
5. **Reconcile.** A sweep compares `loans.outstanding_cents` to the servicer's on-chain balance; any mismatch is written to
   the audit log as an incident. Every failed broadcast, ledger error code and network timeout is also written there with
   the full transaction envelope, and the engine keeps running.

## Which XRPL feature does what

| Primitive | Live on Mainnet | What we create with it |
|---|---|---|
| `MPTokenIssuanceCreate` (`CanLock`, `RequireAuth`, `CanEscrow`, `CanClawback`; no `CanTransfer`) | yes | one non-transferable record of account per loan, XLS-89d metadata with manifest hash and CID slot |
| `MPTokenAuthorize`, `Payment` of MPT units | yes | authorize the servicer's custodial account and deliver the principal |
| `Clawback` of MPT units | yes | monthly amortization: on-ledger balance == outstanding principal |
| `MPTokenIssuanceSet` lock / unlock | yes | freeze the record while a period is unsettled |
| `AccountSet asfDepositAuth` + `DepositPreauth` | yes | only pre-authorized counterparties can pay the issuer and the custodial accounts |
| `AccountSet asfAllowTrustLineLocking` (flag 17) | yes | set on the USDm issuer before any trust line, verified and mirrored to `issuer_accounts.escrow_enabled`; makes an issued-currency USDm escrowable (the MPT form uses `tfMPTCanEscrow`) |
| `EscrowCreate` / `EscrowFinish` of an MPT (TokenEscrow) | yes | the P&I and impound legs, date-locked to the due date, split in the memo |

Not used, and why: Hooks (not enabled on XRPL Mainnet or Testnet; verified on the Amendments object 2026-09-11 — they run
only on the Xahau sidechain, which has neither MPT nor TokenEscrow), Smart Escrows (WASM devnet only), XLS-65 / XLS-66
(institutional vault lending, not loan servicing), NFTokens (replaced by the MPT record in v3). The settlement asset is a
self-issued test USD MPT because RLUSD's issuers do not permit trust-line locking, so RLUSD cannot be escrowed.

---

## For engineers

```bash
uv venv --python 3.12 /Volumes/BackupPlus/venvs/mortgageos
uv pip install --python /Volumes/BackupPlus/venvs/mortgageos/bin/python -r requirements-py.txt
cp .env.example .env                                   # set COUNCILFORGE_DSN (writer role); XRPL_WSS stays Testnet
/Volumes/BackupPlus/venvs/mortgageos/bin/python -m mortgageos.verify                     # board a loan, settle one period, prove error triage
/Volumes/BackupPlus/venvs/mortgageos/bin/python -m pytest tests/py/test_mpt_core.py -q  # same, as the exit-contract test suite
```

Both print `ALL COUNCILFORGE MPT VERIFICATION PASSES` only after the live phases and the reconciliation sweep pass.
Requires Python 3.10+, `xrpl-py` 4.5+, and a PostgreSQL database reachable through `COUNCILFORGE_DSN`. Test-network
wallets are faucet-funded once into `out/wallets.py.testnet.json` (gitignored) and reused. The code refuses Mainnet hosts.

### Repository map

```
mortgageos/config.py             environment, Mainnet refusal, wallet roles
mortgageos/ledger/client.py      the one submit path: sign once, record Pending, submit, record Confirmed / Failed; error triage
mortgageos/ledger/tx.py          transaction builders: DepositAuth, Preauth, MPT issue / authorize / send / clawback / lock, escrow create / finish
mortgageos/ledger/mpt.py         metadata (XLS-89d), issuance-id extraction, on-chain balance and lock reads
mortgageos/ledger/memo.py        structural memo (split + regulatory markers), PII guard
mortgageos/servicing/            fixed-rate amortization in exact cents; RESPA 1024.17 rolling 1/12 impounds and shortfall advance
mortgageos/db/schema.sql         schema `mortgageos`: loans, mpt_issuances, ledger_transactions, audit_log, payment_schedule, escrow_legs
mortgageos/phases.py             Phase 1 board + guard, Phase 2 settle + amortize + lock cycle, Phase 3 error triage, reconcile()
mortgageos/verify.py             standalone smoke runner
tests/py/                        pytest suite (offline math + live Testnet phases)
docs/                            v3 architecture, evidence, threat model, grant proposal and deck, archived v2 material
```

### Numbers that must tie (v3 fixture)

| Figure | Value | Where it is proven |
|---|---|---|
| Principal | $450,000.00 = 45,000,000 record units (`AssetScale` 2) | MPT `MaximumAmount`; `loans.principal_cents` |
| Rate / term | 6.500 % / 360 months | `loans` |
| P&I | $2,844.31 | `payment_schedule.pi_cents`; escrow leg `pi` |
| Month-1 interest / principal | $2,437.50 / $406.81 | memo on the P&I escrow; `Clawback` amount |
| Outstanding after month 1 | $449,593.19 = 44,959,319 units | `loans.outstanding_cents` == servicer `MPTAmount` on-ledger |
| Tax impound | $505.21 / month (1/12 of $6,062.50) | escrow leg `impound` |
| Hazard impound | $150.00 / month (1/12 of $1,800.00) | escrow leg `impound` |

The offline test checks the payment against the closed-form annuity formula to the cent and that the 360 principal
portions sum exactly to the principal; the live suite checks the on-ledger balance against the database after the clawback.

### Compliance posture

Technical feasibility only; no legal claims. v3 implements the impound rule of **RESPA Regulation X** 12 CFR 1024.17
(one-twelfth of the last actual bill, servicer advance on shortfall, recovery at the next analysis) and carries the
RESPA / TILA markers in every settlement memo. The wider control map that v2 implemented (aggregate analysis with cushion,
statements, servicing transfers, notices of error, loss mitigation, Form 1098; R01–R31 with a named test each) is the
roadmap for v3 and is preserved on `main` and in [docs/architecture.md](docs/architecture.md).

Explicit non-guarantees: a ledger transaction does not prove legal compliance, payee receipt, document validity, servicing
authority or custody.

### What v3.0 is and is not

v3.0 is the ledger and settlement core: record of account, guarded custodial accounts, date-locked settlement legs,
amortization by clawback, and a PostgreSQL mirror with an audit log. Its product surface is the command line and the
database. There is no OCR ingest, statement generation, case workflow, borrower portal or operator UI in v3.0; the v2
versions of the first three are archived on `main` and will be ported onto the v3 core.

### Open business items

These are not engineering gaps and the software does not claim them closed:

- A bank's written acceptance of the ledger-side evidence trail as part of its books and records, in either operating model.
- Licensing: HTM's California DFPI and DRE licences permit originating and servicing for its own clients and contracting
  to banks; the residential carve-outs and the Idaho posture still go to counsel before a live loan.
- A production settlement instrument. The runs use a self-issued test USD MPT because RLUSD issuers do not allow trust-line
  locking on Mainnet or Testnet.
- A live tax-bill source. Bills in the runs are fixture values; production needs a tax-service feed or county connectors
  behind an operator verification gate.
- IPFS pinning of the loan manifest. The record's metadata carries the manifest hash and a CID slot; pinning is an operator
  step until a pinning service is on file.

### About HTM

High Tech Mortgage, Inc. is a licensed US mortgage broker (Sacramento, CA) with an operations office in Manila. MortgageOS™
is our digital-twin platform for the mortgage lifecycle; this repository is its servicing and settlement layer.
<https://hightechmortgage.com/tokenized-mortgages/>

Licence: MIT License (the software licence, unrelated to the MIT university credential on the team page). Feature state
verified 2026-09-11 on the Amendments ledger object: XRPL Testnet has MPTokensV1, TokenEscrow, Credentials,
PermissionedDomains, Clawback, DepositAuth and DepositPreauth enabled; Hooks, SmartEscrow and DynamicMPT are not enabled.
