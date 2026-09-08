# XRPL Mortgage Servicing Research Audit and Design

**Prepared for:** High Tech Mortgage Inc

**Repository baseline:** `3368b4860679a6d307d311c82da908e1fc22bc1c`

**Research and verification date:** 2026-09-08

**Source access date:** 2026-09-08 unless a row states otherwise

This report consolidates the independent technical research, repository audit, servicing-law control map, recommended servicing architecture, XRPL Grants assessment and compliance explanations for an already-funded bank-owned FHA residential loan. The principal decision is to use XRPL native Payment and TokenEscrow as a reconciled settlement and date-lock layer, while the licensed bank subservicer retains the legally operative custodial accounts, servicing books, borrower duties and regulatory responsibility. An XLS-20 NFToken serves only as a non-economic digital-twin handle. The report identifies unsupported matters as **UNVERIFIED** and does not treat a ledger transaction as proof of legal compliance, payee receipt, document validity or servicing authority.

## Contents

1. Phase 0 XRPL decision memo
2. Phase 1 independent repository audit
3. Phase 2 servicing-law requirements matrix
4. Phase 3 servicing mechanism design
5. Phase 4 XRPL Grants mapping and explainers

## Phase 0 — XRPL servicing decision memo

**As of / accessed:** 2026-09-08. **Repository baseline:** `3368b4860679a6d307d311c82da908e1fc22bc1c`.

### Decision

Use **XRPL native Payment + TokenEscrow, controlled by an off-ledger servicing engine**, with the bank-owned licensed subservicer retaining the legally operative custodial accounts, borrower accounting, payment application, advances and notices. Use **Testnet** for the grant demonstration and a controlled test USD issuer with `asfAllowTrustLineLocking`; do not represent RLUSD as escrowable. Use one **XLS-20 NFToken** per loan solely as a non-economic digital-twin handle containing an immutable canonical-bundle hash/URI. Do not tokenize the note or servicing cash flows.

This changes the proposal in `servicing-research-2026-09-08.md` in four material ways: (1) chooses NFToken, not “MPT or NFToken”; (2) treats bank custody as authoritative and the ledger as settlement evidence/enforcement, not the legal escrow account; (3) separates FHA MIP from annual hazard insurance; and (4) uses Testnet, not Devnet, to prove Mainnet-available behavior.

What would change the decision: a production USD issuer enabling trust-line locking (or an escrow-capable MPT) **and** written approval from the bank subservicer, HUD/compliance counsel and its auditors that the tokenized deposit claim can participate in the required custodial-account structure. Smart Escrows would also need Mainnet activation, stable production tooling/audit results, and a demonstrable advantage over native date locks.

### R1 — amendment and network status

Status was independently read from each network's `feature` RPC. “Vote” is not a promise of activation: an amendment must remain above 80% support for two weeks [XRPL amendment process](https://xrpl.org/docs/concepts/networks-and-servers/amendments).

| Feature | Mainnet | Testnet | Devnet | Activation / current evidence |
|---|---:|---:|---:|---|
| Payment; XRP Escrow | live | live | live | Core protocol; [Escrow](https://xrpl.org/docs/concepts/payment-types/escrow) |
| MPTokensV1 (XLS-33) | live | live | live | Mainnet 2025-10-01; [Known Amendments](https://xrpl.org/resources/known-amendments) |
| Credentials (XLS-70) | live | live | live | Mainnet **2025-09-04**, not 2026-02-04; [Known Amendments](https://xrpl.org/resources/known-amendments) |
| PermissionedDomains (XLS-80) | live | live | live | Mainnet 2026-02-04; [Known Amendments](https://xrpl.org/resources/known-amendments) |
| TokenEscrow (XLS-85) | live | live | live | Mainnet 2026-02-12; `fixTokenEscrowV1` 2026-01-27; [Known Amendments](https://xrpl.org/resources/known-amendments) |
| SingleAssetVault (XLS-65) | no | no | enabled | Live RPC; secondary vote snapshot 13/35 (37.14%): [XRPSCAN amendments API](https://api.xrpscan.com/api/v1/amendments) |
| LendingProtocol (XLS-66) | no | no | enabled | Live RPC; secondary vote snapshot 11/35 (31.43%): [XRPSCAN amendments API](https://api.xrpscan.com/api/v1/amendments) |
| DynamicMPT (XLS-94) | no | no | enabled | Live RPC; secondary vote snapshot 9/35 (25.71%): [XRPSCAN amendments API](https://api.xrpscan.com/api/v1/amendments) |
| BatchV1_1 (XLS-56) | no | no | enabled | Live RPC; 25/35 (71.43%); the original Batch format was replaced after a critical bug and never activated: [XRPL disclosure](https://xrpl.org/blog/2026/vulnerabilitydisclosurereport-bug-feb2026) |
| Smart Escrows / XLS-100–102 WASM | no | no on standard Testnet | no on standard Devnet | **In Development**; special WASM Devnet only: [XLS-100](https://xls.xrpl.org/xls/XLS-0100-smart-escrows.html), [faucets/networks](https://xrpl.org/resources/dev-tools/xrp-faucets) |
| Hooks | no | no | no | Hooks are a Xahau feature, a separate ledger; xrpl-py removed its Hooks faucet: [xrpl-py changelog](https://github.com/XRPLF/xrpl-py/blob/main/CHANGELOG.md) |

The activation dates above are official. Vote counts are current secondary telemetry and therefore **UNVERIFIED BY A PRIMARY PUBLISHED VOTE TABLE**; the live `feature` RPC is the primary evidence for enabled/disabled state.

### R2 — route comparison

| Route | ≤12-month availability | “No early release” | USD asset | Audit / regulatory fit | Verdict |
|---|---|---|---|---|---|
| Native Payment + TokenEscrow + off-ledger engine | live Mainnet/Testnet | deterministic for the ledger token after `FinishAfter`; does not prove county/carrier receipt | issued currency only if issuer enabled locking; escrow-capable MPT if flags allow | smallest surface; bank system remains authoritative | **SELECT** |
| Smart Escrow WASM | special development network only | programmable in theory | design-dependent | draft, unaudited production path | reject now |
| Solidity on XRPL EVM + Axelar | live separate EVM network | contract lock, but bridge path is non-atomic | bridged asset | more keys, relayers and reconciliation; cross-chain flow can exceed one minute | reject for impounds; [EVM FAQ](https://docs.xrplevm.org/pages/developers/interacting-with-evm/advanced-guides/cross-chain-transactions/faqs) |
| Hooks/Xahau | not XRPL Mainnet | programmable on another ledger | ecosystem-dependent | not an XRPL Mainnet grant proof | reject |

The route aligns with Grants technical criteria—early XRPL integration, meaningful on-chain use, security and a credible roadmap—but a grant does not validate regulatory compliance. Grants currently emphasizes product/integration first and later growth, and includes RWA/payments plus some EVM programs: [XRPL Grants FAQ](https://xrplgrants.org/faq), [programs](https://xrplgrants.org/).

### R3 — loan-record object

Choose **NFToken**. It is unique, transferable by a zero-price sell offer during a servicing transfer, and does not imply principal units or participation rights. Store only `schema`, opaque `loan_id`, canonical bundle SHA-256, version and content-addressed URI; the operative note and mutable servicing state remain off-ledger. NFToken URI is limited to 256 bytes: [NFToken fields](https://xrpl.org/docs/references/protocol/data-types/nftoken).

An MPT issuance costs one owner reserve and supports up to 1,024 bytes of metadata, but its metadata is immutable without DynamicMPT and “supply 1” retains fungible/investment-token semantics unnecessary here: [MPT issuance](https://xrpl.org/docs/tutorials/tokens/mpts/issue-a-multi-purpose-token). “No token, memo hash only” is technically sufficient, but makes controlled servicing-handle transfer and discovery harder. Token transfer is **not** a legal note-owner transfer; the system records those events independently.

### R4 — stablecoin impounds

TokenEscrow can hold issued currency only when the issuer has enabled `lsfAllowTrustLineLocking`; an MPT must permit escrow and transfer: [Token escrow rules](https://xrpl.org/docs/concepts/payment-types/escrow). Ripple publishes RLUSD issuer addresses for Mainnet (`rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`) and Testnet (`rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`): [RLUSD developer resources](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl).

Live `account_info` on 2026-09-08 returned `allowTrustLineLocking: false` for both. Therefore **RLUSD cannot be placed in native TokenEscrow on Mainnet or Testnet today**. The demo asset should be a controlled `USD` issued on Testnet after enabling trust-line locking before trustlines exist. It is test value only—not “test RLUSD,” a deposit, or borrower money.

### R5 — libraries and sandbox

| Item | Decision / compatibility | Source |
|---|---|---|
| xrpl.js | Keep pinned `5.1.0`; it supports selected Payment/NFToken/TokenEscrow transactions. Requires Node ≥20.19.0. v5.0 changed seed-algorithm inference and connection behavior; v5.1 added draft amendment types without a selected-route breaking change. | [v5.1 release](https://github.com/XRPLF/xrpl.js/releases/tag/xrpl@5.1.0), [history](https://github.com/XRPLF/xrpl.js/blob/main/packages/xrpl/HISTORY.md) |
| xrpl-py | Use `5.1.0`, Python ≥3.10. v5.0 dropped 3.8/3.9 and changed seed algorithm inference; v5.1 adds newer amendment support. | [v5.1 release](https://github.com/XRPLF/xrpl-py/releases/tag/v5.1.0), [changelog](https://github.com/XRPLF/xrpl-py/blob/main/CHANGELOG.md) |
| Testnet | `wss://s.altnet.rippletest.net:51233`; explorer `https://testnet.xrpl.org`; use for the production-shape demo | [Public servers](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/server-info-methods/server_info), [faucets](https://xrpl.org/resources/dev-tools/xrp-faucets) |
| Devnet | `wss://s.devnet.rippletest.net:51233`; explorer `https://devnet.xrpl.org`; use only for amendment previews/compressed CI | [Faucets](https://xrpl.org/resources/dev-tools/xrp-faucets) |

### R6 — long horizon and economics

`FinishAfter` is an unsigned 32-bit Ripple-epoch timestamp. Its absolute ceiling is 2136-02-07 06:28:15 UTC; a 30-year loan originated now is representable. The value cannot be amended: [EscrowCreate](https://xrpl.org/docs/references/protocol/transactions/types/escrowcreate).

Mainnet reserve is 1 XRP base plus 0.2 XRP per owner object; minimum transaction cost normally starts at 10 drops: [Reserves](https://xrpl.org/docs/concepts/accounts/reserves). Creating 360 installment escrows would immobilize about **72 XRP** of owner reserve at peak and create 360 immutable scheduling liabilities. It is economically and operationally wrong. Maintain a rolling **12–18 month forecast**, but create only a fully funded, invoice-validated escrow for each near-term disbursement (normally two tax installments and one hazard renewal). Three simultaneous objects use about 0.6 XRP owner reserve per loan. FHA MIP is tracked/remitted separately on its applicable monthly cadence.

### Claim/source register

All sources above were accessed 2026-09-08. Network states, RLUSD flags, reserve values and repository transactions were independently queried that day through public JSON-RPC. Conclusions about custodial qualification, licensing and whether any bank stablecoin constitutes a permissible deposit are **LEGAL/ACCOUNTING UNVERIFIED** pending the bank subservicer and counsel.

---

## Phase 1 — Independent audit

**Commit:** `3368b4860679a6d307d311c82da908e1fc22bc1c` · **Accessed:** 2026-09-08 · **Method:** source inspection, hand recomputation, `npm test`, and independent public Devnet JSON-RPC reads. Values below were decoded from the ledger, not copied from `devnet-run.md`.

### Test verdict

| Test | Result | Evidence / defect |
|---|---|---|
| T1 field/flag conformance | PASS | Domain, MPT, LoanBroker and Loan objects/transactions decode; fields are in protocol ranges. [XLS-66 spec](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0066-lending-protocol) |
| T2 amortization to cent | PASS, two incompatible models | Consumer note: $2,770.73; ledger 60-second XLS-66 payment: 125,002.682965 drops plus 2,500 fee. Both math paths reconcile, but they are not the same loan economics. |
| T3 unit conversions | FAIL | `CoverRateLiquidation=5000` is **5% of minimum cover**, not 50%; maximum per-default coverage is 0.5% of debt. |
| T4 FinishAfter/statutory dates | PARTIAL | Date lock is real; tax escrow held only $570 against a $1,710 installment, ignores scheduler deficit, has no advance and no `CancelAfter`. [Idaho Tax Commission](https://tax.idaho.gov/search-category/property-tax/page/82/) |
| T5 credential gating | PASS for private vault | Credential→acceptance→domain→private vault chain exists. It does not gate the MPT, prove investor status, expire, or exercise revocation. |
| T6 regulatory map | FAIL | Aggregate analysis, advances, insured custody, transfer/error/loss-mitigation workflows, FHA numbers and reporting are absent. |
| T7 documentation claims | FAIL | Core descriptions of P&I, participation cash flow, first-loss protection and regulatory posture exceed code. |
| T8 1,024-byte metadata guard | PASS | Encoder rejects over-limit JSON before hex encoding; test covers boundary. [MPT metadata](https://xrpl.org/docs/tutorials/tokens/mpts/issue-a-multi-purpose-token) |

`npm test` passed **36/36 tests in 9 files**. This proves internal behavior, not regulatory correctness.

### Independent ledger decode and arithmetic

| Item | Independent result | Live object/transaction |
|---|---|---|
| Domain | accepted credential type hex decodes `HTM_ACCREDITED_KYC_2026` | Domain `45B12560…68597`; tx `9B3936C5…50B79F` |
| MPT | maximum amount 45,000,000; metadata decodes “Mortgage Participation Note” / `private_credit` | issuance `004CF687…0D207`; tx `C522E022…EADD4` |
| Vault | XRP asset; private flag 65,536; unlimited `AssetsMaximum=0`; withdrawal policy 1; DomainID matches; creation fee 200,000 drops | vault `8F5D11A8…D3F85`; tx `8AEEA4FB…0CC4E` |
| Broker | fee 100; cover minimum 10,000; liquidation 5,000 | tx `AA4402DE…FB4652`; object `C35D…` |
| Loan | principal 45,000,000 drops; rates 6,250 and 5,000; late fee 13,854; interval 60; 360 payments; origination fee 450,000; service fee 2,500 | tx `78926DD6…48535`; object `D5E8…` |
| XLS-66 period rate | `(6250/100000) × (60/31536000) = 1.1891172×10⁻⁷` | protocol formula |
| Ledger periodic payment | 125,002.682965 drops; first-period interest ≈5.351 drops | live `Loan.PeriodicPayment` |
| `LoanPay` | `ceil(125002.682965)+2500 = 127503` drops | tx `58E8B37C…` |
| After two payments | principal outstanding 44,750,006; broker debt 44,750,960 | live objects |
| Consumer payment | `450000×(.0625/12)/(1-(1+.0625/12)^-360) = 2770.727402` → **$2,770.73**; first interest **$2,343.75** | `src/domain/loan-math.ts` |
| Cover | debt 45,000,966×10%=4,500,096.60 minimum; 5% liquidation=225,004.83 drops ≈0.5% debt | field-unit formula |
| FHA corrections | base $442,125; UFMIP 1.75%=$7,737.19; financed total=$449,862.19; base LTV=78.9509%; 4% late=$110.83 | [HUD ML 2023-05](https://www.hud.gov/sites/dfiles/OCHCO/documents/2023-05hsgml.pdf), [24 CFR 203.25](https://www.govinfo.gov/link/cfr/24/203?link-type=pdf&sectionnum=25&year=mostrecent) |

The demo conversion is `1 XRP = $10,000`, hence 100 drops per fictional USD: principal $450,000→45,000,000 drops; origination fee $4,500→450,000; service fee $25→2,500; late charge $138.54→13,854; borrower sweep $3,368.23→336,823; tax $285→28,500; insurance $312.50→31,250; each 30-XRP investor deposit→$300,000; 10-XRP cover→$100,000; two-period escrows $570→57,000 and $625→62,500. These conversions are arithmetically consistent and economically fictional; production must remove `usdPerXrp` and use exact issued-USD decimal amounts.

The `MPTokenIssuanceID` is not itself a ledger-entry index; the creation transaction and account objects are the correct verification path. All hashes above were validated on Devnet on 2026-09-08 through `https://s.devnet.rippletest.net:51234`.

### Audit of claims in `servicing-research-2026-09-08.md`

| Lines | Claim | Verdict | Correction / source |
|---:|---|---|---|
| 9–14 | HTM business facts | UNVERIFIABLE | User-supplied facts; obtain licenses, contracts and MSR chain. |
| 20 | token only records the note | ACCURATE | A ledger token cannot itself establish negotiability/ownership; choose NFToken and describe it as a handle. [SEC crypto taxonomy](https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/crypto-assets-federal-securities-laws) |
| 24 | XLS-66 always funds from a vault | ACCURATE | This is an origination/funding protocol, not post-close servicing. [XLS-66](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0066-lending-protocol) |
| 25 | Vault/Lending not Mainnet; ~37/~34% | OUTDATED/PARTIAL | Still not Mainnet; live secondary telemetry is 37.14% / 31.43%, not 34%. [XRPSCAN API](https://api.xrpscan.com/api/v1/amendments) |
| 26 | MPT/Credentials/Domains/TokenEscrow dates | OUTDATED | Credentials activated 2025-09-04, not 2026-02-04; Domains 2026-02-04; TokenEscrow 2026-02-12. [Known Amendments](https://xrpl.org/resources/known-amendments) |
| 27 | DynamicMPT unavailable Mainnet | ACCURATE | Live RPC confirms; vote percentage in text is stale. |
| 33 | native escrow supports 30-year `FinishAfter` | ACCURATE but incomplete | Timestamp fits, but 360 simultaneous escrows cost 72 XRP owner reserve and immutable dates make that unsafe. [EscrowCreate](https://xrpl.org/docs/references/protocol/transactions/types/escrowcreate), [Reserves](https://xrpl.org/docs/concepts/accounts/reserves) |
| 45–51 | aggregate method, cushion, annual/surplus/shortage | ACCURATE except initial statement wording | Initial statement is at settlement **or within 45 days**. [12 CFR 1024.17](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/) |
| 52 | deficiency recovered over 12 months | **INACCURATE** | §17(f)(4) options differ: a deficiency under one monthly payment may be recovered in 30 days or at least two equal payments; one month or more may be recovered in at least two equal payments. |
| 53 | timely disbursement even when short if ≤30 days overdue | ACCURATE | [12 CFR 1024.17(k)](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/) |
| 55 | related Reg X duties apply | ACCURATE | [§33](https://www.consumerfinance.gov/rules-policy/regulations/1024/33/), [§35](https://www.consumerfinance.gov/rules-policy/regulations/1024/35/), [§36](https://www.consumerfinance.gov/rules-policy/regulations/1024/36/), [§37](https://www.consumerfinance.gov/rules-policy/regulations/1024/37/), [§38](https://www.consumerfinance.gov/rules-policy/regulations/1024/38/), [§39](https://www.consumerfinance.gov/rules-policy/regulations/1024/39/), [§41](https://www.consumerfinance.gov/rules-policy/regulations/1024/41/) |
| 59–62 | Reg Z receipt-date/statements/ownership and consumer applicability | ACCURATE, with nuance | Record token transfer alone does not prove ownership transfer. [§36](https://www.consumerfinance.gov/rules-policy/regulations/1026/interp-36/), [§39](https://www.consumerfinance.gov/rules-policy/regulations/1026/39/), [§41](https://www.consumerfinance.gov/rules-policy/regulations/1026/41/) |
| 66 | FHA 4% / $110.83 and form correction | ACCURATE | [24 CFR 203.25](https://www.govinfo.gov/link/cfr/24/203?link-type=pdf&sectionnum=25&year=mostrecent) |
| 67 | UFMIP/MIP use base loan | ACCURATE; displayed monthly MIP depends on term/LTV table | Correct fixture UFMIP is $7,737.19. [HUD ML 2023-05](https://www.hud.gov/sites/dfiles/OCHCO/documents/2023-05hsgml.pdf) |
| 68 | FHA custody; subservicer HUD-approved | ACCURATE in direction; contract status UNVERIFIED | [HUD Handbook 4000.1](https://www.hud.gov/hud-partners/single-family-handbook-4000-1) |
| 72 | CA 2%; AB 493 “extends it” | PARTIAL | 2% ordinary impound rule is §2954.8. AB 493 created a distinct loss-draft account rule (§2954.85), not a general premium-impound amendment. [§2954.8](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=2954.8), [AB 493](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260AB493) |
| 73 | Idaho dates; no interest law found | ACCURATE / limited | Dates confirmed; absence remains **UNVERIFIED**, not a legal opinion. [Idaho Tax Commission](https://tax.idaho.gov/search-category/property-tax/page/82/) |
| 77–91 | Form 1098 responsibility, boxes, dates | PARTIAL | First recipient rule and filing dates correct. Box 5 needs statutory deductibility/reportability, not merely $600; Box 11 only when acquired during year; Box 10 is optional. [2026 Form 1098 instructions](https://www.irs.gov/instructions/i1098), [General Instructions](https://www.irs.gov/publications/p1099) |
| 97–99 | bank subservicer moves licensing/liability | UNVERIFIABLE and overconfident | Vendor activity/MSR ownership may remain regulated. CA and Idaho facts require counsel and contract review. [CA DFPI](https://dfpi.ca.gov/regulated-industries/california-residential-mortgage-lending-act/who-is-required-to-obtain-a-license-or-branch-license-under-the-california-residential-mortgage-lending-act/), [Idaho Finance](https://www.finance.idaho.gov/consumer-finance-bureau/mortgage/mortgage-forms/) |
| 103 | securities/ASC 860 all “fall away” | PARTIAL | No participation means those participation issues are not part of this design; whole-loan facts and any token marketing still require counsel/accounting analysis. [SEC Reg D](https://www.sec.gov/resources-small-businesses/exempt-offerings), [FASB ASU 2014-11](https://storage.fasb.org/ASU%202014-11.pdf) |
| 109–122 | rebuild design | PARTIAL | Right pivot, but choose NFToken; bank custody remains authoritative; RLUSD cannot be escrowed; FHA MIP is separate; Testnet intervals must be compressed/mapped rather than literal calendar months. |

### Severity-ranked findings

| Sev | File:line | Finding | Proposed fix |
|---|---|---|---|
| Blocking | `data/documents/02-promissory-note-3200.json:14`, `src/steps/04-lending.ts:59`, `src/ingest/canonical.ts:105` | FHA fixture uses Fannie form and 5% late charge; validator enforces the wrong number. | Replace with FHA model documents; 4%/$110.83; regenerate tie-outs. |
| Blocking | `src/steps/05-servicing.ts:62` | Partial impounds are unconditionally escrowed; no initial deposit, advance, aggregate analysis or legal custody. | Replace with servicing engine and funded-bill gate; retain bank custody. |
| Major | `src/steps/05-servicing.ts:40` | “P&I” ledger payment is $1,275.03-equivalent demo scale, not $2,770.73. | Remove XLS-66; use exact-cent issued-currency Payment. |
| Major | `src/steps/04-lending.ts:30` | 5% mislabeled 50%. | Remove lending layer; otherwise use 50,000 and correct prose. |
| Major | `src/steps/02-mpt.ts:57` | MPT is called a participation but receives no cash flow and never amortizes. | Remove it; mint non-economic NFToken handle. |
| Major | `README.md`, `docs/grant-narrative.md`, `WALKTHROUGH.md` | Investor/vault story contradicts actual servicing business and grant PDF architecture. | Rewrite around servicing-only decision and explicit non-guarantees. |
| Minor | `data/documents/01-closing-disclosure.json`, `src/domain/loan-math.ts:51` | UFMIP/MIP/LTV use total instead of base amount. | Correct fixture and math inputs. |
| Minor | `src/steps/05-servicing.ts:47` | APN in public memo. | Use opaque loan ID and no property/borrower identifiers. |
| Minor | `docs/architecture.md` | reserve figures stale. | Set 1 XRP base / 0.2 XRP owner; query dynamically. |

### Disagreements with `audit-2026-09-08-fable.md`

1. T6 “prompt crediting SATISFIED” is rejected: same-ledger demo submission does not prove receipt-date rules, suspense handling, cutoffs, reversals or bank posting.
2. T4 is **PARTIAL**, not “PASS on timing”: the locked amount is insufficient and there is no cancellation/advance path; date correctness alone does not satisfy the mechanism.
3. The Fable audit treats the live loan arithmetic as sufficient validation. It is mathematically correct but economically unrelated to the consumer note because 60-second interest produces a different P&I.
4. Credentials/Permissioned Domain are irrelevant to the servicing-only route and should be removed, not hardened as investor controls.
5. Its Regulation Z conclusion attaches only to the artificial HTM-to-HTM transaction. Under the requested design the serviced consumer credit is the relevant transaction, so the servicing duties apply.
6. The “technically strong/submission-ready after four fixes” verdict is too soft. The current code implements the wrong business model; it requires a servicing rebuild, not four patches.
7. The prior audit did not test RLUSD issuer locking, compare Smart Escrows/EVM/Hooks, choose a loan object, or address the bank-custody limitation.

### Overall verdict

**XRPL Grants readiness: NOT READY at this commit.** The transaction proof is real and reproducible, but it demonstrates warehouse lending/participation rather than HTM's proposed servicing product. **US servicing-law defensibility: NOT DEFENSIBLE.** The current repository lacks the legally operative accounting, custody, advance, notice, complaint, insurance and loss-mitigation controls. These are architecture gaps, not disclosure footnotes.

---

## Phase 2 — Servicing-law requirements matrix

**Accessed:** 2026-09-08. This is an engineering control map, not a legal opinion. `SATISFIED` means the proposed control covers the cited requirement; at commit `3368b48`, every row is a **GAP** unless explicitly noted.

| Requirement and controlling text (short excerpt/paraphrase) | Source | Required function / data | Proof test |
|---|---|---|---|
| Servicing escrow is an account controlled for borrower taxes/insurance—not title-company closing escrow. | [12 CFR 1024.17(b)](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/) | `EscrowAccount{loan_id,purpose,custodial_bank_account_id}`; terminology gate | Reject “closing escrow” and non-servicing purposes. |
| Use aggregate accounting and month-by-month trial balances. | [§1024.17(c)(1)(i),(d)](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/) | `analyzeEscrowYear(schedule,balances)` | CFPB-style fixture reproduces every projected balance. |
| Cushion ≤1/6 annual disbursements, or lower document/state limit. | [§1024.17(c)(1)(ii)](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/) | `cushionLimit`; versioned rule source | Property test never exceeds min(contract,state,1/6). |
| Initial statement at settlement or within 45 days of establishing after settlement. Prior research omitted the 45-day alternative. | [§1024.17(g)](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/) | `InitialEscrowStatement`, delivery evidence | Deadline boundary tests. |
| Annual statement within 30 days after computation year. | [§1024.17(i)](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/) | statement renderer + immutable delivery event | Day 30 pass/day 31 alert. |
| Current borrower: surplus ≥$50 refunded within 30 days; smaller surplus refund or credit. | [§1024.17(f)(2)](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/) | `resolveSurplus`, ACH/refund ledger | $49.99/$50.00 and current/delinquent cases. |
| Shortage options depend on whether shortage is less than one monthly escrow payment. | [§1024.17(f)(3)](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/) | `buildShortageRecovery` | 30-day option only below threshold; ≥12 equal months where required. |
| Deficiency options are **not always 12 months**: under one payment may be 30 days or ≥2 payments; larger deficiency may be ≥2 payments. | [§1024.17(f)(4)](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/) | `buildDeficiencyRecovery`; policy approval | Boundary and option-set tests; fixes prior research. |
| Pay before penalty/date when borrower ≤30 days overdue even when escrow is short. | [§1024.17(k)(1)](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/) | `ensureDisbursement`; `ServicerAdvance` | Insufficient-balance fixture funds full bill from advance. |
| Transferor/transferee notices and 60-day grace for misdirected payments. | [§1024.33](https://www.consumerfinance.gov/rules-policy/regulations/1024/33/) | `ServicingTransferCase`, notice/delivery/grace routing | 15-day timing, combined notice, day-60 routing. |
| Investigate notices of error and send acknowledgments/responses. | [§1024.35](https://www.consumerfinance.gov/rules-policy/regulations/1024/35/) | `NoticeOfErrorCase`, SLA clock, evidence | Valid/error/duplicate/untimely cases and deadlines. |
| Respond to borrower information requests. | [§1024.36](https://www.consumerfinance.gov/rules-policy/regulations/1024/36/) | `InformationRequestCase` | SLA and permissible-exception suite. |
| Force-placed insurance notices, reasonable basis and cancellation/refund controls. | [§1024.37](https://www.consumerfinance.gov/rules-policy/regulations/1024/37/) | coverage evidence, notice sequence, refund engine | Overlap and proof-of-coverage scenarios. |
| Maintain policies, records, continuity, transfer data and oversight. | [§1024.38](https://www.consumerfinance.gov/rules-policy/regulations/1024/38/) | control catalog, audit log, reconciliations, BCP | control-evidence and transfer-data completeness tests. |
| Early intervention and loss-mitigation workflow. | [§1024.39](https://www.consumerfinance.gov/rules-policy/regulations/1024/39/), [§1024.41](https://www.consumerfinance.gov/rules-policy/regulations/1024/41/) | delinquency state machine, continuity/contact, application workflow | delinquency-day and complete-application timelines. |
| Credit periodic payments as of date received, subject to conforming-payment rules. | [12 CFR 1026.36(c)(1), commentary](https://www.consumerfinance.gov/rules-policy/regulations/1026/interp-36/) | immutable `received_at`, suspense/partial-payment policy | weekend, cutoff, suspense and reversal fixtures. |
| Periodic statement each billing cycle with required content. | [§1026.41](https://www.consumerfinance.gov/rules-policy/regulations/1026/41/) | `PeriodicStatement`, payoff/delinquency fields | golden PDFs for current/delinquent loans. |
| New owner/acquirer notice within 30 days; partial-interest exception is narrow. | [§1026.39](https://www.consumerfinance.gov/rules-policy/regulations/1026/39/) | `OwnershipTransfer`, independent from NFT transfer | whole/partial/servicer-change matrix. |
| Consumer-purpose loan is not the business-credit exemption. | [§1026.3(a)](https://www.consumerfinance.gov/rules-policy/regulations/1026/3/) | `credit_purpose=consumer`; ruleset selection | Fixture cannot select business exemption. |
| FHA late charge ≤4% of overdue installment after 15 days. | [24 CFR 203.25](https://www.govinfo.gov/link/cfr/24/203?link-type=pdf&sectionnum=25&year=mostrecent) | FHA product rule; HUD note/security-instrument fixture | $2,770.73→$110.83 max; day 15/16. |
| FHA UFMIP 1.75% of **base** amount; annual MIP uses base amount/LTV/term table. | [HUD ML 2023-05](https://www.hud.gov/sites/dfiles/OCHCO/documents/2023-05hsgml.pdf) | `calculateFhaPremiums(base,ltv,term)` | $442,125→$7,737.19; table boundary tests. |
| FHA servicing funds use special custodial accounts; clearing funds transferred promptly; no impermissible commingling/delayed-access instrument. | [HUD Handbook 4000.1, Section III](https://www.hud.gov/hud-partners/single-family-handbook-4000-1) | bank account registry, daily reconciliation, sweep controls | prove bank-held balances; stablecoin is never sole legal custody. |
| CA ordinary impounds earn 2% simple interest, credited at least annually, subject to statutory scope/exceptions. | [Cal. Civ. Code §2954.8](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=2954.8) | daily balance/accrual engine; annual credit | leap-year and payoff/transfer proration. |
| AB 493 separately covers qualifying hazard-insurance loss-draft accounts; it is not a blanket amendment to premium impounds. | [AB 493 / §2954.85](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260AB493) | separate `LossDraftAccount`; disaster/work-progress events | never combine loss proceeds with premium impound. |
| Idaho property taxes due Dec. 20; second half may be paid by June 20. | [Idaho Tax Commission](https://tax.idaho.gov/search-category/property-tax/page/82/) | jurisdiction calendar + verified bill | deadline/time-zone/holiday tests. |
| Idaho escrow-balance interest requirement | **UNVERIFIED** | configurable state overlay; counsel sign-off | block production profile until approved. No affirmative rule was located. |
| CA person making/servicing residential loans generally needs CRMLA authority; bank exemptions do not automatically cover vendors/MSR holders. | [CA DFPI licensing](https://dfpi.ca.gov/regulated-industries/california-residential-mortgage-lending-act/who-is-required-to-obtain-a-license-or-branch-license-under-the-california-residential-mortgage-lending-act/) | counterparty/license registry; responsibility matrix | expired/missing authority blocks boarding. |
| Idaho companies servicing first- or third-party residential mortgages are licensed; a strictly passive MSR holder may differ. | [Idaho Finance licensing](https://www.finance.idaho.gov/consumer-finance-bureau/mortgage/mortgage-forms/), [agency guidance](https://www.finance.idaho.gov/wp-content/uploads/industry/compliance-connection-newsletter/documents/The-Department-of-Finance-Compliance-Connection-Spring-2020.pdf) | license and activity classification | vendor/subservicer/passive-owner scenarios. |
| Supervised institution must manage service-provider risk throughout relationship. | [CFPB Bulletin 2016-02](https://www.consumerfinance.gov/compliance/supervisory-guidance/compliance-bulletin-and-policy-guidance-2016-02-service-providers/) | due diligence, contract controls, monitoring, issue management | annual evidence pack; Manila access review. |
| GLBA Safeguards Rule covers mortgage/account servicers: written program, access, encryption, MFA, monitoring, testing, training and service-provider oversight. No per-se foreign-processing ban found. | [FTC Safeguards Rule guide](https://www.ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know) | security program, RBAC, encryption, DLP, audit/SIEM, vendor controls | access/egress/key-rotation/incident exercises. |
| First recipient of reportable mortgage interest for another files Form 1098; $600 threshold rules apply. | [2026 Form 1098 instructions](https://www.irs.gov/instructions/i1098) | `build1098(calendarYear)` and filer-of-record field | multiple servicers/transfers/threshold tests. |
| 1098 Box 2 is Jan. 1 principal (or acquisition/origination rule); Box 5 subject to current reporting law; Box 10 optional; Box 11 only if acquired in year. | [2026 instructions](https://www.irs.gov/instructions/i1098) | versioned tax schema, schedule/ledger reconciliation | golden boxes 1–11 and transfer-year cases. |
| Recipient copy by Jan. 31; paper IRS by Feb. 28; e-file by Mar. 31, adjusted for nonbusiness days. | [General Instructions](https://www.irs.gov/publications/p1099) | compliance calendar, delivery/acceptance evidence | date engine by filing year. |
| CA impound interest generally triggers 1099-INT at $10; foreclosure/cancellation can trigger 1099-A/C. | [Form 1099-INT instructions](https://www.irs.gov/instructions/i1099int), [1099-A/C](https://www.irs.gov/instructions/i1099ac) | `TaxFormEvent`; scope flag | $9.99/$10; foreclosure/cancellation handoff. |
| Without an offer/sale of participation securities, Reg D/accredited-verification is not part of this product. | [SEC exempt offerings](https://www.sec.gov/resources-small-businesses/exempt-offerings) | prohibit economic-right token/marketing claims | schema and copy scan; counsel review. |
| Without a transfer of a portion, ASC 860 participating-interest analysis is not the relevant design test. Whole-loan accounting remains with the bank. | [FASB ASU 2014-11](https://storage.fasb.org/ASU%202014-11.pdf) | `legal_owner_id`; no investor ledger | reconciliation shows no participation allocation. |

### Compliance-officer explanation

The bank subservicer remains the servicer of record and controls the insured custodial accounts. HTM's system calculates what is due, records when borrower money was received, reconciles bank cash, schedules taxes/insurance, advances shortages, generates statements/tax data, and routes exceptions to authorized staff. XRPL adds an independently timestamped, non-PII event trail and can prevent a **tokenized settlement amount** from being released before a date. It does not decide what the borrower owes, make an incorrect bill correct, ensure the county accepts funds, substitute for bank custody, cure a shortage, send statutory notices, or confer a servicing license.

The on-ledger NFToken is a document-version handle, not the note, a security, an ownership certificate or a borrower account. Every legal and accounting conclusion concerning HTM's MSR ownership, Manila activity, stablecoin custody and bank responsibility remains **UNVERIFIED pending written counsel/subservicer approval**.

---

## Phase 3 — Servicing mechanism design

**Design date:** 2026-09-08. **Route:** off-ledger regulatory/accounting authority + bank custodial cash + XRPL Payment/TokenEscrow evidence and date locks. Legal sources are mapped in [Phase 2](astra-phase-2-servicing-law-2026-09-08.md).

### Trust boundary

The bank-owned licensed subservicer is servicer of record, tax-information filer and custodian. HTM supplies software and controlled task execution under the bank's policies. The authoritative balance is the bank/deposit and servicing subledger; XRPL is a reconciled settlement/evidence rail. Until the bank and counsel approve a production deposit token, TokenEscrow locks a mirrored/prefunded settlement asset—not borrower funds and not the HUD custodial account.

### Objects and ownership

| Object | Owner/controller | Holds | Purpose |
|---|---|---|---|
| `Loan` | bank subservicer tenant | opaque ID, product/state, terms, legal owner, servicing owner | tenant boundary and authority |
| `LoanDocumentVersion` | bank eVault/document system | canonical bundle hash, URI, effective dates | operative-document chain |
| XLS-20 `NFToken` | bank servicing account | schema/version/hash/opaque ID only | public digital-twin handle; no economic rights |
| Collection account | bank subservicer | borrower receipts/suspense | receipt-date credit and application |
| Note-holder payable | bank/subservicer | P&I due to funding bank | remittance and reconciliation |
| Tax impound | bank custodial account + purpose subledger | tax reserve | aggregate analysis/disbursement |
| Hazard impound | bank custodial account + purpose subledger | hazard premium reserve | carrier disbursement |
| FHA MIP payable | bank custodial/clearing account | periodic MIP | separate HUD remittance; not annual hazard premium |
| Advance account | bank subservicer | advances and recoverable deficiency | mandatory timely disbursement |
| Refund payable | bank subservicer | surplus/interest refunds | borrower payment workflow |
| `EscrowAnalysis` | servicing database | projections, cushion, shortage/deficiency/surplus | Reg X decision record |
| XRPL issued-USD accounts | bank-authorized ledger signers | approved settlement token only | exact-cent Payment and near-term TokenEscrow |
| `ReconciliationEvent` | append-only database + hash anchor | bank/servicing/XRPL references and differences | three-system proof |

No account, memo or token contains name, address, SSN, APN, county account number or insurer policy number.

### Monthly cycle

```mermaid
sequenceDiagram
    participant B as Borrower bank
    participant C as Subservicer collection account
    participant S as Servicing engine
    participant N as Note-holder account
    participant T as Tax impound
    participant H as Hazard impound
    participant M as FHA MIP payable
    participant X as XRPL evidence/settlement
    B->>C: ACH/mortgage payment
    C->>S: received_at + bank transaction
    S->>S: apply note rules; post P&I/escrow/suspense to cent
    S->>N: remit principal + interest
    S->>T: allocate tax
    S->>H: allocate hazard
    S->>M: allocate periodic FHA MIP
    S->>X: approved exact-cent Payment events
    X-->>S: validated hashes
    S->>S: reconcile input = all postings; bank = servicing = XRPL where used
```

`planMonthlyApplication()` produces integer cents and refuses approval unless:

`received = principal + interest + tax + hazard + fha_mip + fees + suspense ± adjustments`.

P&I is the note's fixed $2,770.73 schedule for the fixture; only analyzed escrow changes. Batch is not Mainnet-live, so XRPL legs are independently submitted with a shared idempotency key and compensating/reconciliation workflow, never described as atomic.

Memo JSON is versioned and ≤256 bytes: `{"v":1,"loan":"opaque","period":"2026-09","leg":"tax","cents":28500,"run":"uuid"}`. The database stores `received_at`, effective date, sequence, bank reference, XRPL hash, status and reversal relationship.

### Impound release and immutable-date handling

1. Load the final, independently verified bill, payee and statutory/contract due date. Forecasts alone cannot create a production escrow.
2. If the purpose balance plus approved advance is less than the bill, create/post a `ServicerAdvance` first when §1024.17(k) requires payment. Record deficiency recovery separately.
3. Validate destination allowlist, asset issuer/locking flags, full amount, time zone and `FinishAfter`; require dual approval.
4. Create one TokenEscrow for the full near-term amount. Store object ID and expected owner reserve. It cannot finish early; an authorized automation finishes after the date and initiates/reconciles the actual ACH/wire payment.
5. If a corrected bill arrives **before** creation, replace the draft. If it arrives **after** creation, the escrow cannot be amended. Do not pretend otherwise: create a second adjustment escrow/advance for an increase; for a decrease, finish only the lawful amount if the destination mechanism permits or complete the original controlled settlement then record/refund the excess. A bounded `CancelAfter` and verified recovery destination are mandatory. Manual exception approval and payee confirmation are recorded.
6. County/carrier nonreceipt remains an operational exception; a validated `EscrowFinish` is not proof the payee credited the mortgage account.

Maintain a 12–18 month forecast but create only verified near-term objects. Maximum timestamp and reserve economics are documented in Phase 0.

### Annual aggregate analysis

Inputs: computation-year dates; actual purpose balances; scheduled tax/hazard/MIP dates and estimates; note/state cushion cap; borrower delinquency; outstanding advances; prior shortage/deficiency; CA interest accrual; verified jurisdiction rules.

`analyzeEscrowYear()` projects each month with the aggregate method, finds the lowest balance, applies the permitted cushion, calculates the next monthly deposit, classifies surplus/shortage/deficiency, and returns only regulation-permitted options. An approved result creates:

- new immutable `EscrowAnalysis` version and effective monthly escrow amount;
- surplus refund/credit or shortage/deficiency schedule with deadline;
- CA 2% credit and possible 1099-INT event where applicable;
- annual statement JSON/PDF and delivery evidence within 30 days;
- forecast changes, without altering P&I.

### Form 1098 pipeline

The filer-of-record configuration determines which servicer reports each period. `build1098(year)` joins receipt-date payment applications, amortization balance, validated transfer dates, MIP/tax/insurance disbursements and corrections. It computes boxes under the tax-year instructions, reconciles Box 1 to posted interest and Box 2 to the Jan. 1 balance, treats Box 10 as optional and emits Box 11 only for an in-year acquisition. Outputs are versioned JSON, rendered form data, borrower copy/delivery evidence and IRS acceptance/rejection record. Tax rules are effective-dated; no hard-coded “MIP always reportable” assumption.

### Transfer and 30-year operations

Quarterly rolling forecast; annual analysis; daily bank-to-subledger reconciliation; each near-term bill creates/finishes/cancels one object. A servicing transfer freezes new discretionary work, reconciles cash/items, exports complete records, sends §1024.33 notices, preserves the 60-day payment grace, changes signer/tenant access at cutover and transfers the NFToken by a zero-price offer. A legal owner change is a separate event and triggers §1026.39 when applicable.

Production ledger accounts use HSM-held regular keys, 2-of-3 signer lists across bank-controlled roles, least privilege, transaction allowlists/limits, monitored sequence/tickets, emergency rotation and `lsfDisableMaster` only after recovery is proven. Manila users never receive signing secrets; they submit tasks to dual-control queues. All records retain `company_id` and `loan_id` isolation.

### Full-year demonstration

| Track | What it proves | Clock treatment |
|---|---|---|
| Deterministic loan-year replay | Jan–Dec 12 receipts, Jun 20/Dec 20 Idaho tax, Sep 1 hazard, monthly FHA MIP, annual analysis, CA alternate profile and 1098 | injected clock; complete accounting/regulatory test |
| Testnet integration | Mainnet-live NFToken, issued USD Payments, TokenEscrow create/finish/cancel, reconciliation | statutory dates mapped to near-future timestamps; mapping manifest is part of evidence |
| Devnet smoke | CI speed and preview-only comparison | compressed seconds; never cited as Mainnet proof |

Public networks cannot advance time. A literal year-long Testnet run is optional endurance testing; the auditable demo uses an injected business clock plus near-term ledger timestamps and explicitly proves the equivalence mapping.

### Definition of Done and traceability

| Capability | Required proof |
|---|---|
| Correct FHA fixture | HUD form labels; $442,125 base; $7,737.19 UFMIP; 4% late cap; regenerated 23-page tie-outs |
| Monthly application | 360-row fixed P&I schedule; integer-cent property tests; receipt/suspense/reversal cases |
| Escrow analysis | CFPB aggregate fixtures; cushion/surplus/shortage/deficiency boundaries; full statement |
| Timely disbursement | full funded escrow or advance before deadline; nonreceipt/corrected-bill cases |
| Custody/reconciliation | bank, servicing and ledger balances reconcile; unresolved differences page humans |
| Reporting | periodic/annual statements; 1098 golden cases and filing calendar; CA interest/1099-INT |
| Servicing operations | transfer, NOE/RFI, force-placed insurance, early intervention/loss mitigation workflow tests |
| Security/privacy | no-PII schema scan; tenant isolation; HSM/multisig rotation and incident exercises |
| XRPL | Testnet hashes for every selected primitive; issuer-lock preflight; reserve/fee capture; no Devnet-only dependency |

### Changes from the prior §6 draft

Removed Vault/Lending/investors/credentials/domains; selected NFToken; made legal bank custody authoritative; blocked RLUSD escrow; separated hazard and FHA MIP; corrected deficiency options; added actual receipt-date, exception, reconciliation, corrected-bill, transfer, security and reporting workflows; replaced impossible “30-day Testnet intervals” with deterministic full-year replay plus timestamp-mapped Testnet proof.

---

## Phase 4 — XRPL Grants mapping and explainers

**Accessed:** 2026-09-08. Rubric source: [XRPL Grants FAQ](https://xrplgrants.org/faq); program context: [XRPL Grants](https://xrplgrants.org/). Proposal source: repository `docs/grant-proposal-2026-08-24.pdf` (7 pages).

### Rubric comparison

| Published criterion | Current investor/vault code | Servicing-only design | Evidence needed before submission |
|---|---|---|---|
| Team / relevant ability | Manila operations and mortgage background stated, not independently evidenced | better domain fit | named roles, licenses/experience, bank-subservicer LOI where disclosable |
| Clear problem / market | mixes capital formation, warehouse lending, token participation and servicing | focused 30-year bank servicing pain | bank discovery, workflow baselines and buyer evidence |
| Technical design and XRPL alignment | impressive Devnet breadth, but relies on non-Mainnet Vault/Lending and a cash-flow token that receives none | Mainnet-shape Payment, NFToken and TokenEscrow with honest off-ledger authority | architecture/threat model, Testnet transaction bundle, issuer-lock preflight |
| Code quality, security, authentication | 36 tests and reproducible transactions; no production servicing controls | explicit HSM/multisig, privacy, idempotency, custody/reconciliation design | implementation, security tests, independent review |
| Roadmap / early XRPL integration | transactions exist, but for the wrong business | full-year servicing slice yields early on-chain proof | milestones tied to borrower receipt→disbursement→analysis→reporting |
| Meaningful XRPL utility / on-chain activity | high object count but artificial vault/loan/participation | lower transaction count, stronger necessity: immutable record, exact-cent settlement evidence, date lock | quantify per-loan/year transactions and reserves; do not inflate vanity activity |
| Traction and customer validation | repository demo only | no proven bank adoption yet | subservicer design-partner evidence and compliance sign-off |
| Sustainability / business model | unclear who buys participation platform | bank/subservicer SaaS/vendor model is clearer | pricing, implementation cost, unit economics, support model |
| Commitment to XRPL ecosystem | broad use but Devnet-dependent | durable Mainnet primitives; reusable open schemas/tests | open-source boundary, developer docs and reproducible Testnet run |
| Growth metrics (later-stage emphasis) | none | none yet | pilot loans, reconciliation accuracy, exception rate, timely-disbursement SLA |

The FAQ describes roughly 30% product/integration and 70% growth-metric emphasis for later funding. The servicing concept is stronger on problem/design fit but still early on customer validation and traction. It should seek a build/pilot-appropriate program, not claim production readiness.

### Fit with the August 2026 grant proposal

The PDF's core architecture is a legal asset and private data off-ledger, MortgageOS as the servicing system, and XRPL for document hashes and settlement events. That is materially closer to this servicing-only design than to the current code. The current implementation's MPT participation, private vault and XLS-66 origination layer contradict the proposal's digital-twin/settlement emphasis. Milestone M4 mentions participation, but it is not the architectural center and should be removed or deferred. This conclusion is based on direct inspection of the repository PDF on 2026-09-08.

**Grant verdict:** the pivot improves alignment, credibility and Mainnet relevance, but the repo at `3368b48` is **not submission-ready**. Submit after the servicing slice exists, Testnet proofs reproduce, compliance non-guarantees are explicit, and a bank design partner validates operating assumptions.

### Bank compliance-officer explainer

| Mechanism | What it does | Guarantee | Does not guarantee | Control served |
|---|---|---|---|---|
| Canonical document hash + NFToken | fingerprints the approved loan package and provides a transferable servicing handle | later bytes can be compared to the approved hash | document legality, accuracy, possession or note ownership | document integrity/transfer audit |
| Receipt/application engine | records bank receipt time and allocates integer cents under note/product rules | postings balance and are reproducible | ACH finality or that rules were configured correctly | Reg Z receipt credit; statements |
| Bank custodial subledger | tracks collection, tax, hazard, MIP, advances and refunds against real bank cash | reconciled legal cash/accounting when controls operate | blockchain custody; FDIC status of a token | HUD custody; Reg X accounting |
| TokenEscrow | prevents the selected ledger token from release before `FinishAfter` | protocol rejects early finish | sufficient bill funding, correct payee, county/carrier credit, legal custodial qualification | supplemental disbursement control |
| Servicer advance | fills a short impound so required item can be paid | full disbursement is fundable despite shortage | borrower collectability | §1024.17(k) |
| Annual analysis | projects aggregate balance and applies cushion/surplus/shortage/deficiency rules | approved calculation is repeatable/versioned | correctness of tax/insurance estimates | §1024.17(c),(d),(f),(i) |
| Reconciliation | matches bank, servicing and XRPL references and pages differences | no silent imbalance after cutoff | truth of external source data | §1024.38; auditability |
| Statements/tax pipeline | derives borrower and IRS outputs from controlled postings | traceability from box/line to source entry | IRS acceptance or legal interpretation after rule changes | Reg X/Z; Forms 1098/1099 |
| Transfer workflow | moves records/access/NFToken and sends notices | controlled cutover and traceable record chain | token transfer equals note ownership | §§1024.33/1026.39 |
| HSM/multisig/RBAC | prevents a single Manila user from moving ledger assets | threshold authorization and attributable action | prevention of collusion or bank compromise | GLBA/vendor oversight |

The decisive control statement is: **XRPL enforces a date lock on a ledger asset; the bank subservicer remains responsible for correct accounting, custody, timely real-world payment, borrower treatment and reporting.**

### Grant-reviewer explainer

This is not mortgage tokenization, a lending pool or an investment product. It is an open, verifiable servicing rail for an already-funded bank-owned FHA loan. The private system performs the regulation-heavy work; XRPL adds three bounded capabilities that are difficult to fake after the fact:

1. an immutable fingerprint and chain of the approved loan record;
2. exact-cent settlement events that can be independently reconciled without borrower PII; and
3. a native date lock for approved near-term impound disbursements.

The project deliberately avoids Devnet-only Lending/Vault amendments, custom WASM, bridges and investor tokens. Testnet demonstrates only Mainnet-live transaction types. A controlled test USD is used because RLUSD's issuers do not currently permit trust-line locking. The project will not claim that a ledger transaction itself satisfies RESPA, TILA, HUD custody, licensing, tax filing or payee receipt; the implementation maps each obligation to code, bank evidence and a test.

### Roast-council verdict incorporated

The five-role ai-consult council returned **RESHAPE**, with role scores from 6/10 to 8/10. Its valid objections—regulation cannot be delegated to blockchain, custody/stablecoin qualification is unresolved, integration and reconciliation dominate delivery risk, and buyer ROI/controls need evidence—are incorporated above. Its suggestion to broaden into an origination pilot was rejected as outside scope; the proof is one synthetic loan-year servicing cycle. Council output was advisory and contained no adequate primary citations, so no factual proposition relies on it.

### Claims requiring explicit UNVERIFIED labels in grant copy

- HTM license scope, MSR ownership treatment and the bank-subservicer contract: **UNVERIFIED**.
- Production stablecoin issuer, redemption/custody treatment and permission to use it for borrower impounds: **UNVERIFIED**.
- Idaho absence of an impound-interest rule: **UNVERIFIED pending Idaho counsel**.
- Bank willingness to accept XRPL evidence in its books/controls and county/carrier payment workflow: **UNVERIFIED**.
- Customer traction, savings, error-rate reduction and willingness to pay: **UNVERIFIED until measured**.
