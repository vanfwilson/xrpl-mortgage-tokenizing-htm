# Servicing rebuild: status against the build prompt (branch `claude/servicing-rebuild`)

Executor: Claude Fable 5.1, 2026-09-08. Build prompt: [build-prompt-servicing-architecture-2026-09-08.md](build-prompt-servicing-architecture-2026-09-08.md). Offline suite: 82 tests; Testnet proof suite: 6 tests (`npm run test:testnet`). Testnet proof: [testnet-run.md](testnet-run.md).

## Tests T1–T12

| Test | Result | Evidence |
|---|---|---|
| T1 four legs equal the receipt, 360 periods | PASS | `tests/engine/apply.test.ts` `T1_four_legs_equal_receipt` (final period is the payoff amount; periods 1–359 equal $3,365.01) |
| T2 no escrow after two receipts; advance when short; escrow when funded | PASS | `tests/engine/disburse.test.ts`; Testnet run: December bill advanced $284.65 then escrowed in full |
| T3 cushion ≤ min(1/6 annual, state cap, contract cap) | PASS | `R03_cushion_cap` property test (500 cases) |
| T4 surplus $49.99 vs $50.00, current vs delinquent | PASS | `R07_surplus_options` |
| T5 shortage / deficiency option sets at the one-month boundary | PASS | `R08_shortage_options`, `R09_deficiency_options` |
| T6 initial statement day 45/46; annual day 30/31 | PASS | `R05_initial_statement_deadline`, `R06_annual_statement_deadline` |
| T7 California 2 % accrual with leap year; 1099-INT at $10.00 not $9.99 | PASS | `R23_ca_interest`, `R30_1099int_threshold` |
| T8 Form 1098 boxes 1, 2, 5, 11 | PASS | `R29_form_1098`; worked output in [form-1098-example.json](form-1098-example.json) |
| T9 issuer-lock preflight | PASS (live) | run `run-mtta2pac`: `allowTrustLineLocking=true on rNq2cj4hvRKdRQG9nXCdNk2YXAoKi8iMhN`; `createImpoundEscrow` refuses when the flag is false (`src/xrpl/escrow.ts`) |
| T10 EscrowFinish before FinishAfter fails; succeeds after; cancel path returns funds | PASS (live) | early EscrowFinish -> `tecNO_PERMISSION`; three EscrowFinish tesSUCCESS; EscrowCancel `293F0EB14A16…`; key drill master refused `tefMASTER_DISABLED`; NFToken hand-off `CD16C9310245…` |
| T11 no PII in ledger payloads; NFToken URI ≤ 256 bytes with the bundle sha256 | PASS | `tests/xrpl/payloads.test.ts`, `tests/engine/security.test.ts` |
| T12 late charge $110.83, UFMIP $7,739.56, grace 15 | PASS | `tests/loan-math.test.ts`, `tests/canonical.test.ts` |

## R01–R31 coverage

| Row | Module | Test |
|---|---|---|
| R01 | `analysis.ts` `assertEscrowPurpose` | `R01_escrow_purpose` |
| R02 | `analysis.ts` `analyzeEscrowYear` | `R02_aggregate_trial_balances` |
| R03 | `analysis.ts` `cushionLimit` | `R03_cushion_cap` |
| R04 | `boarding.ts` opening postings | `R04_initial_deposit` |
| R05 | `statements.ts` `initialEscrowStatement` | `R05_initial_statement_deadline` |
| R06 | `statements.ts` `annualEscrowStatement` | `R06_annual_statement_deadline` |
| R07 | `analysis.ts` `resolveSurplus` | `R07_surplus_options` |
| R08 | `analysis.ts` `shortageOptions` | `R08_shortage_options` |
| R09 | `analysis.ts` `deficiencyOptions` | `R09_deficiency_options` |
| R10 | `disburse.ts` `ensureDisbursement` | `R10_advance_when_short`, `T2_no_escrow_after_two_receipts` |
| R11 | `transfer.ts` `servicingTransferCase` | `R11_transfer_notices` |
| R12 | `cases.ts` `noticeOfErrorCase`, `informationRequestCase` | `R12_noe_rfi_clocks` |
| R13 | `cases.ts` `forcePlacedClock` | `R13_force_placed` |
| R14 | `reconcile.ts` `threeWayMatch` | `R14_three_way_match` |
| R15 | `cases.ts` `delinquencyCase`, `lossMitigationClock` | `R15_delinquency_state_machine` |
| R16 | `apply.ts` `planMonthlyApplication` | `R16_receipt_date_credit` |
| R17 | `statements.ts` `periodicStatement` | `R17_periodic_statement` |
| R18 | `transfer.ts` `ownershipTransferNotice` | `R18_ownership_notice` |
| R19 | `canonical.ts` `credit_purpose`; `boarding.ts` | `R19_consumer_purpose` (canonical + apply suites) |
| R20 | `loan-math.ts` `fhaLateCharge`; `canonical.ts` | `R20_fha_late_charge`, `R20: FHA note terms` |
| R21 | `loan-math.ts` `fhaPremiums`; `canonical.ts` | `R21 FHA premiums on the BASE loan` |
| R22 | `reconcile.ts` `authoritative_balance_cents` | `R22_bank_balance_authoritative` |
| R23 | `analysis.ts` `californiaInterest` | `R23_ca_interest` |
| R24 | `boarding.ts` `loss_draft_account` | `R24_loss_draft_separate` |
| R25 | `calendar.ts` `TAX_CALENDAR`, `ESCROW_INTEREST`; `boarding.ts` `idahoInterestGate` | `R25_idaho_calendar_gate` |
| R26 | `boarding.ts` `authorityCheck` | `R26_license_gate` |
| R27 | `xrpl/keys.ts` `disableMasterDrill` | `R27_no_operator_keys`; live drill in the Testnet run |
| R28 | `xrpl/settle.ts` `assertNoPii`; security scan | `R28_no_pii_payloads`, `T6_no_pii_in_payload_builders` |
| R29 | `tax.ts` `build1098`, `filingCalendar` | `R29_form_1098` |
| R30 | `tax.ts` `build1099INT`, `taxHandoffs` | `R30_1099int_threshold` |
| R31 | `boarding.ts` `assertNoParticipation`; `LoanTerms.legal_owner_id` | `R31_no_participation_fields` |

## Findings from `audit-2026-09-08-fable.md`

| # | Finding | Status |
|---|---|---|
| 1 | FHA loan documented on a conventional note with a 5 % late charge | FIXED — `data/documents/02-fha-model-note.json`, `src/ingest/canonical.ts` (R20 check), 4 % / $110.83 |
| 2 | On-ledger "P&I" leg was the ledger's 60-second-schedule due, not $2,770.73 | FIXED — `src/loan-year.ts` pays the exact P&I to the note holder; `src/xrpl/settle.ts` exact cents |
| 3 | CoverRateLiquidation 5000 mislabelled 50 % | OBSOLETE — XLS-66 removed (S3) |
| 4 | Token distributed for no consideration; no cash flow; supply never amortizes | OBSOLETE — MPT removed; NFToken record carries no economic rights (S2) |
| 5 | Escrow locked partial balances; sufficiency ignored; initial deposit missing | FIXED — `src/servicing/disburse.ts` gate, `boarding.ts` initial deposit (R04), `analysis.ts` |
| 6 | ASC 860 participation accounting, origination-fee deferral, CECL | OBSOLETE — no participations, no vault loan; single legal owner (R31) |
| 7 | UFMIP, MIP and LTV computed on the total | FIXED — `src/domain/loan-math.ts` `fhaPremiums`, fixture re-based |
| 8 | Credentials without Expiration or revocation; self-issued "accredited" | OBSOLETE — no third-party depositor; credentials removed |
| 9 | APN in a public memo | FIXED — six-key memo with PII guard (`assertNoPii`), security scan |
| 10 | Reserve figures stale | FIXED — 1 XRP base / 0.2 XRP per object in `docs/architecture.md`, `escrow.ts` |
| 11 | "native escrow for closing funds" claim | FIXED — grant narrative rewritten |
| 12 | Grace = 100 % of interval | OBSOLETE — no ledger loan; grace is the note's 15 days in `LoanTerms` |
| 13 | Escrows without CancelAfter | FIXED — bounded `CancelAfter` (due + 45 days; mapped on Testnet) |
| 14 | "32 offline tests" | FIXED — README states 86 |
| 15 | xrpl.js 5.1.0 vs LendingProtocolV1_1 | OBSOLETE — lending protocol not used; 5.1.0 kept (S6) |

## Findings from the Codex Phase 1 table (`xrpl-servicing-research-audit-design-2026-09-08.md`)

| Finding | Status |
|---|---|
| Blocking: FHA fixture on Fannie form, 5 % late charge | FIXED (see #1) |
| Blocking: partial impounds unconditionally escrowed; no deposit, advance, analysis or custody | FIXED — engine gate, advances, 1024.17 analysis; bank custody authoritative in `docs/architecture.md` |
| Major: "P&I" ledger payment was demo-scale | FIXED — exact-cent issued-USD legs; `usdPerXrp` removed |
| Major: 5 % mislabelled 50 % | OBSOLETE — lending layer removed |
| Major: MPT called a participation | OBSOLETE — replaced by the NFToken handle |
| Major: investor/vault story in README, grant narrative, walkthrough | FIXED — all rewritten |
| Minor: UFMIP/MIP/LTV on the total | FIXED |
| Minor: APN in memo | FIXED |
| Minor: reserve figures | FIXED |
| Disagreement 1: "prompt crediting SATISFIED" too strong | ACCEPTED — R16 is now an immutable `received_at` with suspense/partial rules and a bank-file source stated as the production requirement |
| Disagreement 2: T4 partial not pass | ACCEPTED — funded-bill gate and advance path |
| Disagreement 4: credentials irrelevant to servicing | ACCEPTED — removed |
| Disagreement 5: Reg Z attaches to the serviced consumer loan | ACCEPTED — R19 enforced |
| Disagreement 6: "four patches" verdict too soft | ACCEPTED — full rebuild done |
| Disagreement 7: RLUSD locking, route comparison, loan object, bank custody | ACCEPTED — all in `docs/architecture.md`, `standards-mapping.md`, `appendix-deferred-amendments.md` |

## Won't-fix / intentional exceptions

- The Phase G grep still matches `SingleAssetVault` / `LendingProtocol` in the two lines that report Mainnet feature state (factual), `eVault` (the MERS product name), and the R31 guard list in `src/servicing/boarding.ts` (it must contain the forbidden words to reject them). Historical documents (`servicing-research-*.md`, `build-prompt-*.md`, `docs/source/*`) are kept as written.
- The Idaho escrow-interest question remains UNVERIFIED; the production profile is blocked in code until counsel signs (R25).
- Statement PDFs are minimal renderings; the JSON is the system record. Golden PDFs are a milestone item.
- Bank receipt files are simulated by a mirror of the subledger in `npm run loan-year`; the reconciliation code path is real, the bank feed is not (grant milestone 2–4).
