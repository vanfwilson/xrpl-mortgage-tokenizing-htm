# Codex servicing build: validation and remaining gaps

Date: 2026-09-09. Branch: `codex-servicing-rebuild`. Base: `3bac61c`, which contains Phase A on top of build-prompt commit `76ead3b`. Scope: Phase A–E servicing prototype; the user subsequently authorized commit and push to the Codex branch only.

## Verdict

The corrected fixture, core calculations and native XRPL sandbox rail work in the exercised scenarios. **This is a validated prototype, not a completed production servicer. The original Phase C/D Definition of Done is only partially met.** Production integrations, exception-specific statement templates and some servicing case workflows remain incomplete. The standard current-loan statement and durable PostgreSQL settlement journal are implemented and tested. A passing test for one control does not establish satisfaction of the entire cited regulation.

There are **12 monthly borrower receipts**, each $3,365.01, and **48 outgoing settlement transfers**. The borrower pays once a month. Testnet starts with issuer-funded servicing tokens; the bank receipt is modeled in the deterministic replay. No ACH payment or actual county/carrier delivery is claimed.

## Evidence and reproducibility

- `npm run typecheck`: passed.
- Embedded PostgreSQL (PGlite 0.5.8): all three migrations execute; the new migration reapplies; append-only triggers and cross-tenant account references are enforced; the PostgreSQL journal preserves the winning signed blob. No shared database was modified.
- `npm test`: 95 tests, 13 files, passed, including R01–R31, T1–T12 and substantive regression cases.
- `npm run ingest`: corrected four-document fixture ties out; bundle hash `b042d9188e3a94cfbf4c19e88d451da764c9ca08a10ce9196e97601598df6dd3` matches the minted NFToken URI.
- `npm run print`: regenerated 23-page synthetic package and FHA blank template. Saved OCR reconstruction tests pass.
- `npm run demo`: twelve receipts, separate MIP payable, tax/hazard dates, surplus/shortage elections, advance request, correction, CA interest, transfer and tax data; append-only event hash chain.
- `npm run test:devnet`: two live tests passed. [Seven transaction records](evidence/devnet-smoke.json) cover test USD issuance and compressed TokenEscrow creation/finish. Devnet results are not cited as Mainnet proof.
- [Testnet run](testnet-run.md): 81 hashes independently decoded using `tx`, with validated status, result, monthly totals, bundle hash and escrow timing checked. The original run includes 80 successes and the expected early-finish `tecNO_PERMISSION`.
- [Key recovery](evidence/key-recovery.json): two additional successful Testnet transactions; one-signature attempt rejected `tefBAD_QUORUM`; regular key and two-of-three signatures work after master disabling. This demonstrates software-wallet recovery, not HSM custody or institutional signer independence.
- [Hazard correction](evidence/hazard-adjustment.json): two additional successful transactions add $250 to the initial $1,250 hazard demonstration, reaching the fixture's $1,500 annual bill. The immutable original escrow is not edited.

The original 81-hash run, four recovery/correction successes and one [persistent-journal transfer](evidence/journal-proof.json) give 86 recorded Testnet transactions. The journal proof closes and reopens its PostgreSQL store, then verifies that a repeated invocation neither signs nor submits again. Wallet seeds and signed-wallet files remain under ignored `out/`; they are excluded from the commit. Supplemental proofs are linked below and in the run report.

## T1–T12

| Test | Result | Evidence and exact scope |
|---|---|---|
| T1 | PASS | `tests/acceptance.test.ts`, `tests/servicing-regressions.test.ts`: 12 receipt cycles and 360 actual amortization periods conserve integer cents; scheduled principal retires exactly $450,000. Final payoff absorbs accumulated rounding. |
| T2 | PASS | Forecast-only outside the five-day execution window; a short due bill returns `advance_required` with no escrow request; fully funded input returns a full-bill request. Bank confirmation must supply the available balance. |
| T3 | PASS | Deterministic property cases cap cushion at the lowest limit; hand-calculated twelve-balance fixture; tiny annual totals cannot produce negative rounding deposits. |
| T4 | PASS | $49.99/$50.00 boundaries; delinquent accounts return loan-document review instead of automatically granting the current-borrower options. |
| T5 | PASS | Current-borrower shortage and deficiency options at one-month boundaries; recovery election separate from annual base deposit, with cent-conserving installments. |
| T6 | PASS | Day 45/46 and 30/31 boundaries. These tests prove scheduling, not actual delivery or complete statement content. |
| T7 | PASS | 365/366 denominators, payoff proration, $9.99/$10 reporting boundary. Holiday calendars and daily balances are bank inputs. |
| T8 | PASS (data controls) | Posted-receipt calendar filtering, January 1/origination/acquisition principal bases, Box 5 rule/threshold, Box 11 only in acquisition year, correct property boxes. Published 2027 example is explicitly year-to-date through October, not a filed annual return. |
| T9 | PASS | False issuer-lock flag refuses builds; live controlled issuer preflight succeeded. DefaultRipple and repair of legacy issuer-side NoRipple flags are included. |
| T10 | PASS | Early finish refused; all three primary escrows finished between FinishAfter and CancelAfter; cancellation returned tokens to the escrow owner. Native cancellation cannot select a different recovery account. |
| T11 | PASS (bounded schema) | URI/memo limits and bundle hash; runtime extra JSON keys are projected out. Opaque identifiers and content pointers still require a controlled provisioning policy; a regex alone cannot recognize every form of PII. |
| T12 | PASS (authorized rebase) | Base $442,260.44 + rounded 1.75% UFMIP $7,739.56 = $450,000.00; monthly MIP $184.28; late charge $110.83; grace 15 days. The prompt expressly permits this rebase, so its alternative $442,125/$7,737.19 fixture is not used. |

## R01–R31 traceability

Each named test is in `tests/regulatory-controls.test.ts`; additional meaningful boundary tests are in `tests/acceptance.test.ts` and `tests/servicing-regressions.test.ts`. “Partial” means the cited row is broader than the implemented/tested mechanism.

| Row | Module | Named test | Coverage |
|---|---|---|---|
| R01 | `servicing/analysis.ts` | `R01_escrow_purpose` | Purpose guard |
| R02 | `servicing/analysis.ts` | `R02_aggregate_trial_balances` | Aggregate target accounting; hand-recomputed balances |
| R03 | `servicing/analysis.ts` | `R03_cushion_cap` | Federal/state/contract cap inputs |
| R04 | `servicing/boarding.ts` | `R04_initial_deposit` | Scoped initial allocations; bank posting integration pending |
| R05 | `servicing/statements.ts` | `R05_initial_statement_deadline` | Partial: date gate and PDF, delivery/content review pending |
| R06 | `servicing/statements.ts` | `R06_annual_statement_deadline` | Partial: date gate and analysis output |
| R07 | `servicing/analysis.ts` | `R07_surplus_options` | Classification and elected refund plan |
| R08 | `servicing/analysis.ts` | `R08_shortage_options` | Separate recovery election and term boundary |
| R09 | `servicing/analysis.ts` | `R09_deficiency_options` | Distinct deficiency options; no automatic netting |
| R10 | `servicing/disburse.ts` | `R10_advance_when_short` | Advance prerequisite and funded-bill gate |
| R11 | `servicing/transfer.ts` | `R11_transfer_notices` | Partial: notice timing/grace; operational transfer package pending |
| R12 | `servicing/cases.ts` | `R12_noe_rfi_clocks` | Partial: business-day acknowledgment/response clocks; exceptions need policy routing |
| R13 | `servicing/cases.ts` | `R13_force_placed` | Partial: dated notices/refund checks; full coverage determination workflow pending |
| R14 | `servicing/reconcile.ts`, `event-log.ts` | `R14_three_way_match` | Difference rejection and hash chain; full policies/retention are external |
| R15 | `servicing/cases.ts` | `R15_delinquency_state_machine` | Partial: contact/evaluation gates, not complete loss mitigation |
| R16 | `servicing/apply.ts` | `R16_receipt_date_credit` | Receipt time, suspense accumulation, fee exclusion, reversals, cent conservation |
| R17 | `servicing/statements.ts` | `R17_periodic_statement` | Standard current fixed-rate JSON/PDF disclosure data; exception templates and delivery remain operational work |
| R18 | `servicing/transfer.ts` | `R18_ownership_notice` | Partial: distinct ownership notice and deadline; counsel determines exception applicability |
| R19 | `ingest/canonical.ts` | `R19_consumer_purpose` | Consumer fixture |
| R20 | `domain/loan-math.ts` | `R20_fha_late_charge` | Correct fixture cap/grace |
| R21 | `domain/loan-math.ts` | `R21_fha_premiums` | Fixture base/LTV tier; full HUD premium schedule integration remains external |
| R22 | `servicing/reconcile.ts` | `R22_bank_balance_authoritative` | Partial: cash reconciliation, not establishment of a HUD custodial account |
| R23 | `servicing/analysis.ts` | `R23_ca_interest` | Daily interest arithmetic and proration |
| R24 | `servicing/boarding.ts` | `R24_loss_draft_separate` | Separate schema purpose; full proceeds administration pending |
| R25 | `servicing/calendar.ts` | `R25_idaho_calendar_gate` | Dates and explicit unresolved-interest gate; use verified bills for holiday shifts |
| R26 | `servicing/boarding.ts` | `R26_license_gate` | Configuration gate; no registry verification or legal opinion |
| R27 | `xrpl/keys.ts` | `R27_no_operator_keys` | Partial: signer configuration; no vendor oversight evidence is implied |
| R28 | `xrpl/record.ts`, `settle.ts` | `R28_no_pii_payloads` | Partial: ledger projection; complete GLBA controls are Phase F/operations |
| R29 | `servicing/tax.ts` | `R29_form_1098` | Tax data transformation; no IRS submission |
| R30 | `servicing/tax.ts` | `R30_1099int_threshold` | Threshold and foreclosure/cancellation review flags |
| R31 | `db/003_servicing_architecture.sql` | `R31_no_participation_fields` | New servicing schema; legacy historical tables are retained |

## Prior audit dispositions

FIXED refers to the new prototype path. OBSOLETE means the mechanism was removed. WON'T-FIX identifies a deliberate scope boundary, not a claim that the finding was wrong.

| Fable finding | Status | Disposition |
|---|---|---|
| 1 FHA note/late charge | FIXED | Numeric fixture, labels, ties and generated synthetic templates corrected. Full legally operative HUD instruments require legal document production. |
| 2 P&I ledger mismatch | FIXED | Twelve $2,770.73 issued-USD transfers independently decoded. |
| 3 liquidation rate 5% vs 50% | OBSOLETE | Lending-layer transactions removed. Historical rate-unit helpers do not execute lending. |
| 4 participation MPT without cash flows | OBSOLETE | Non-economic NFToken document handle replaces issuance/distribution. |
| 5 partial impounds/analysis/advance | FIXED (prototype) | Full-bill gate, initial allocation, aggregate analysis and advance prerequisite. Real bank custody/integration still required. |
| 6 participating-interest GAAP | OBSOLETE | No pooled lending or investor participation in new workflow. Ordinary bank accounting is not adjudicated by this prototype. |
| 7 base UFMIP/MIP/LTV | FIXED | Authorized $450,000 rebase, base-driven calculations and OCR ties. |
| 8 credential expiry/revocation | OBSOLETE | Credential gating removed. |
| 9 public APN | FIXED | Explicit bounded memo/URI projection excludes property fields. |
| 10 reserve table | FIXED | 1 XRP base/0.2 XRP object reference; live server_info captured. |
| 11 grant closing-funds claim | WON'T-FIX in A–E | Grant narrative rewrite explicitly assigned to Phase G. Current README warns that older grant material is superseded. |
| 12 compressed grace mismatch | OBSOLETE | XLS-66 grace scheduling removed; fixture retains 15 calendar days. |
| 13 absent CancelAfter | FIXED | Bounded creation and successful cancel proof. |
| 14 stale test count | FIXED | Current README/report use current test evidence. |
| 15 lending amendment/version pin | OBSOLETE | Lending not used; retained SDK passed native-rail Testnet and Devnet tests. |

| Codex Phase 1 finding (table order) | Status | Disposition |
|---|---|---|
| 1 FHA form/charge | FIXED | Same scope and limitation as Fable 1. |
| 2 unconditional partial escrow | FIXED (prototype) | Advance required before funded escrow request; custody remains bank-authoritative. |
| 3 scaled P&I | FIXED | Exact issued USD transfers replace scale conversion. |
| 4 5%/50% liquidation | OBSOLETE | Lending path removed. |
| 5 participation MPT | OBSOLETE | NFToken carries no economic rights. |
| 6 investor/vault grant story | WON'T-FIX in A–E | README corrected; grant/walkthrough rewrite remains Phase G. |
| 7 FHA base amounts | FIXED | Rebased fixture and consistency checks. |
| 8 APN memo | FIXED | Old servicing step removed; new bounded projection. |
| 9 stale reserves | FIXED | Current reserve evidence and explicit per-object accounting. |

## Reserve accounting

The original successful run had four concurrent escrows, consuming 0.8 XRP of incremental owner reserve at 0.2 XRP each. The ordinary three-bill window needs 0.6 XRP. A loan-record NFT can require a new page (another 0.2 XRP); pages are shared across NFTs and must not be charged as one object per token automatically. Accounts, trust lines and signer lists add separate reserves. The seven test accounts are role demonstrations, not a recommendation to create seven funded ledger accounts per production loan. Reserve figures are reference observations, not immutable protocol constants; [decoded server_info](evidence/testnet-run.json) records the live snapshot. Fees in the demonstrated escrows were 12 drops, not the nominal 10-drop minimum.

## Review and remaining blockers

Two ai-consult code-review passes were obtained before commit (routed `cf:cf-qwen-coder`). The first suggested restoring XRP scaling; this was rejected because it contradicts the approved USD rail and live amounts. The second identified the zero-monthly-payment comparison and rounding distribution as review points; both were corrected. Claims that void validators need return values, that escrow logic implies a lending pool, or that existing tests were absent were rejected after inspection. Host review additionally fixed the annual/12 calculation, premature ready status, tax box mapping/year selection, PDF truncation, extra-field leakage, fee treatment, and shell expansion that could silently narrow the test suite.

Open implementation gaps: the migration and durable journal have been tested in isolated embedded PostgreSQL, but no bank deployment or service scheduler is installed; the standard current-loan statement data is generated, while delinquency/bankruptcy and other exception templates require additional implementation; NOE/RFI/FPI/loss-mitigation controls cover selected paths rather than complete policies. The replay is an injected-clock artifact, not a running 30-year scheduler. The correction and recovery proofs use software test wallets. These are reasons the full Phase C/D completion gate remains partial despite passing focused tests.

Open external gates: HTM licensing/MSR treatment, bank-subservicer agreement, accepted production deposit token/custody, Idaho impound-interest rule, HSM/dual-control deployment, Manila vendor oversight and GLBA safeguards, bank acceptance of ledger evidence, and tax/delivery operating procedures. None is represented as verified by a transaction hash.

## Sources and verification dates

All sources accessed 2026-09-09 unless the linked prior research explicitly records 2026-09-08. Source-specific limitations and the effective tax-year configuration are retained.

| Subject | Primary URL / evidence |
|---|---|
| Aggregate accounting, statement timing, resolution options, timely disbursement | [12 CFR 1024.17](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/) |
| NOE acknowledgment and response clocks | [12 CFR 1024.35](https://www.consumerfinance.gov/rules-policy/regulations/1024/35/) |
| Force-placed notices/cancellation | [12 CFR 1024.37](https://www.consumerfinance.gov/rules-policy/regulations/1024/37/) |
| Loss mitigation | [12 CFR 1024.41](https://www.consumerfinance.gov/rules-policy/regulations/1024/41/) |
| Form 1098 field meanings | [IRS instructions](https://www.irs.gov/instructions/i1098) — returned page labels itself 12/2026; no assumption that its reportability rule applies to every year |
| Issuer rippling | [XRPL rippling documentation](https://xrpl.org/docs/concepts/tokens/fungible-tokens/rippling) and live account_lines showing legacy issuer-side NoRipple |
| FHA/state/licensing/IRS prior primary citations | [Verified research source register](xrpl-servicing-research-audit-design-2026-09-08.md) |
| Embedded PostgreSQL testing | [PGlite documentation](https://pglite.dev/docs/), `tests/database.test.ts`; accessed 2026-09-09 |
| Transaction behavior and reserves | [81 decoded Testnet records and server_info](evidence/testnet-run.json), [recovery](evidence/key-recovery.json), [adjustment](evidence/hazard-adjustment.json) |

## Re-run policy

Use `npm exec tsx src/cli/publish-servicing-evidence.ts` to verify published hashes without sending new payments. The completed year runner refuses a second execution while `out/testnet-run.json` exists. Never delete that guard to replay borrower transfers against an existing run. Sandbox credentials are separate from production, and the configured endpoint allowlist permits only the named public Testnet/Devnet servers.
