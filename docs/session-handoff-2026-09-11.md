# Session handoff, 2026-09-11

Written by Claude Fable 5.1 from the record of the 2026-09-08 to 2026-09-11 sessions. Read this first in a fresh session; it replaces re-deriving anything below.

## /goal for the next session

**Goal.** Continue to iterate until there is a grant-ready **v3.0** XRPL mortgage-servicing repo. `main` is already published with the Testnet demo, the proposal PDF, the reviewer deck and full team bios. **Next action: record the two-minute demo video, then submit to XRPL Grants.** Use the v3 architecture notes and code in `/Users/elliew/Downloads/mortgageos_v3_architecture notes.txt` and `/Users/elliew/Downloads/mortgageos_v3_architecture.pdf` (archived on BackupPlus, see "Inputs for v3.0") as inputs, evaluated against the Mainnet-only rule.

**Definition of done for v3.0 (frozen once work starts, per `/goal`):**

1. `npm run typecheck` clean; `npm test` green; every R01–R31, S and T control still has a named test (the evidence pack's control map reports none uncovered).
2. A fresh Testnet loan-year run passes `npm run test:testnet` with every settlement leg `journal: validated`; `docs/testnet-run.md`, `docs/demo/run.json`, `docs/clock-mapping-manifest.json` and `docs/evidence/<run>/` regenerated from that run and committed.
3. Every v3 input in the table below is either adopted (code + tests + docs), adapted (with the change stated), or rejected with the reason written in `docs/appendix-deferred-amendments.md` or `docs/standards-mapping.md`.
4. The loan-record pointer is a content-addressed CID (IPFS pin) instead of the `cas://` placeholder, with the pinning step documented and the CID verified against the bundle hash in a test.
5. The property-tax bill source is no longer a fixture: a `TaxBillSource` interface with at least one real connector or tax-service feed adapter behind the operator verification gate, and the escrow analysis consuming a verified bill with a `source_ref` that points at evidence.
6. `docs/roast-v3-<date>.md` records a council verdict of GO, or every RESHAPE item closed with a file reference.
7. README, CHANGELOG (3.0.0), `package.json` version 3.0.0, proposal and deck all describe v3 accurately; no stale MPT/Hooks/vault claims in reader-facing docs.
8. Two-minute demo video recorded, linked from the README and the checklist (`docs/grant-application-checklist.md`), and the application submitted.
9. `main` pushed, `git status` clean, CI green, Pages serving the v3 run.

## Where things stand (verified 2026-09-11)

- Repo: `/Volumes/BackupPlus/VideoLab/repos/xrpl-mortgage-tokenizing-htm` → github.com/vanfwilson/xrpl-mortgage-tokenizing-htm (public, MIT). `main` = `7ef9904`, fast-forwarded from `v2/servicing` and kept in sync (`git push origin main:v2/servicing`). CI green on `main`. Working tree clean.
- Published: <https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/demo/> serves Testnet run `run-mtvzvtnk` (2026-09-10): 108 transactions, 75 of 75 legs journaled validated, three impound escrows finished on date, early finish refused, 2-of-3 multisig drill (one refused `tefBAD_QUORUM`, two `tesSUCCESS`), master disabled (`tefMASTER_DISABLED`). The page reads Testnet live over WebSocket (JSON-RPC has no CORS in browsers). Loan-record NFToken `00080000927B9361D59A7ACEA52A98802BC1A6FFF98DE54B3E6A72F6013B1E5B` held by `rPxzegVg3CswUxkXZDm6kNeWFXZsaq5TcB`.
- Grant package on `main`: `docs/grant-proposal-2026-09-10.md` and `.pdf` (7 pages, built by `scripts/build-grant-pdf.sh` with headless Chrome), `docs/grant-deck-2026-09-10.pptx` (15 slides, built by `scripts/build-grant-deck.py` with python-pptx; rebuild after any number changes), `assets/deck/demo-live-2026-09-10.png`. README "See it" line links all three plus the evidence pack.
- Team: all four people from hightechmortgage.com/about have full profiles in the proposal §10, the deck team slide and `TEAM.md`. Rich Young: CA DRE Broker #01106294, NMLS #291547. Trish Wilson: US Realtor, PH Broker PRC 0024025, CPA, Int'l Certified Financial Consultant, ex-internal auditor Philippine Airlines. Dr Van Wilson: 20+ years data science mostly in finance, secret clearance while at the U.S. SEC (AI model decoding unreadable legal submissions) and Fannie Mae (post-COVID mortgage-payment forecasting model, cloud conversion plan), MIT post-graduate degree in data science and AI received 2022, CSU Fullerton, AWS/Databricks/Blockchain Training Alliance/Microsoft Certified Trainer, DBA certs, real-estate investor since 1998 with 120+ transactions and a $10M+ portfolio, linkedin.com/in/drvanwilson. Bill Thompson: ITIL v4, Six Sigma, CompTIA A+, TOPCIT, URAC, FranklinCovey, Ateneo GSB, CSU Dominguez Hills.
- Business posture (user-stated, authoritative): HTM is either the servicer of record for its own clients under its California DFPI and DRE licences through a separate servicing entity, or the servicing-operations and technology contractor to a bank that is the official servicer. No third-party subservicer, no capital raising, no investors, the note is not tokenized. Philippine provincial-bank M&A/JV talks exist and stay out of public docs.
- QA state: 127 offline tests in 25 files, 9 Testnet assertions, evaluator verdict DONE on the v2 goal (round 1). Roast verdict RESHAPE with RS1–RS6 closed and RS7 (business items) open, in `docs/roast-v2-2026-09-10.md`.
- Open business items (README "Open business items"): a bank's written acceptance of the ledger evidence trail; residential consumer-protection carve-outs and Idaho posture to counsel; production settlement asset (RLUSD issuers do not allow trust-line locking); Idaho escrow-interest rule (gated UNVERIFIED); live tax-bill source; first bank servicing contract.

## Inputs for v3.0 and how to treat them

Archived copies: `/Volumes/BackupPlus/VideoLab/work/xrpl-v3-inputs/mortgageos_v3_architecture-notes.txt` (1,315-line AI chat transcript with a "v3.0 / v8" spec and Python and C code) and `.../mortgageos_v3_architecture.pdf` (2-page "v8 blueprint"). They were produced by another assistant and carry its own "responses may include mistakes" notice, so evaluate each idea against the ledger's real feature state before adopting.

| Input idea | Verdict for v3.0 | Reason |
|---|---|---|
| Replace the NFToken loan-record handle with an MPT (`MPTokenIssuanceCreate`, `tfMPTCanFreeze`, `tfMPTCanClawback`, metadata holding an IPFS CID) | **Evaluate, likely reject as the note; optionally adopt as a second, non-economic record only if it adds something the NFToken cannot** | MPTokensV1 is live on Mainnet, so it is not blocked by feature state. But an MPT is units of supply with balances; the v2 decision (user: "the note is not a token") and R31 forbid representing the note or any economic interest. Freeze and clawback on a record with no balance add nothing over the NFToken. The NFToken URI already carries `{v, loan, sha256, ptr}`. If kept as NFToken, write the reason in `docs/standards-mapping.md` (it already argues "supply implies units"). |
| C-WASM Hooks installed with `SetHook` as an on-chain payment firewall that splits incoming payments and rejects partial amounts | **Reject for Mainnet; do not build** | Hooks are not enabled on the XRP Ledger Mainnet (they run on the Xahau sidechain). `docs/appendix-deferred-amendments.md` already lists Hooks as deferred. The same guarantee is delivered off-ledger today by `planMonthlyApplication` (refuses a receipt that does not equal the legs) and the settlement journal. Record the rejection with the feature-state check date. |
| Hook State slots (`TAX_DUE_DATE`, `TAX_AUTHORITY_ID`, `INITIAL_TAX_RATE`, `LAST_KNOWN_VALUATION`, `ORACLE_URI_HASH`) | **Adapt off-ledger** | These are the fields of a verified bill and its evidence. Put them on `VerifiedBill` / the tax-bill source record (due date, payee account, rate basis points, last valuation cents, evidence URI hash) and carry the due date on the TokenEscrow `FinishAfter` as today. |
| Rolling 12-month projection, collect 1/12 of the last actual bill, servicer advances shortfalls, recover at the next analysis | **Already implemented** | This is 12 CFR 1024.17 as coded in `src/servicing/analysis.ts`, `disburse.ts` (advance-first) and the annual analysis; the fixture shows the December advance and the year-two deposit rise. Nothing to add except the live bill source (DoD item 5). |
| IPFS/Filecoin pinning of the metadata manifest (Python `MortgageDataPersistence` using Pinata), CID stamped into the token | **Adopt, ported to the repo's TypeScript pipeline** | Replaces the `cas://htm/<loan>/v1` placeholder pointer with a content-addressed CID. Keep PII out of the manifest (hashes, opaque ids, structure only). Pinata needs an API key; if none is on file, use a local IPFS node or compute the CID offline (`ipfs-only-hash`) and document pinning as an operator step. Test: CID recomputed from the manifest equals the CID in the NFToken URI. |
| XLS-66 evaluation ("not viable for retail mortgages") | **Already the repo's position** | v2 removed XLS-65/66 with reasons in the appendix; the notes agree. No action. |
| Python xrpl-py "core engine" and "escrow_analysis.py" | **Do not port** | The TypeScript engine is more complete (exact (f)(2)–(f)(4) options, statements, cases, journal, tests). The Python versions use drops and XRP amounts, not issued-USD cents. |
| ARM multi-year amortization recalculator | **Out of scope** | User scope is fixed-rate 30-year loans only. |
| "Emergency freeze engine" (Hook-based account freeze on 90-day default or title dispute) | **Reject as Hook; note the business rule** | The delinquency state machine (R15) already tracks 36/45/120-day clocks. Freezing an issued-currency trust line is possible on Mainnet (`asfGlobalFreeze` / `tfSetFreeze`) but freezing a borrower's payment path is the opposite of what a servicer wants; record as considered and rejected. |
| "Treasury separation" and "no asset-liability mismatch" sections | **Already covered** | Custodial accounts per purpose, bank books authoritative, S8 MIP separation, R22, R24. Cross-reference in the architecture if useful. |

## Next actions, in order

1. **Demo video (blocks submission).** Option recommended in session: I script ~90 seconds, capture the demo page and explorer links with Playwright, capture `npm run loan-year:replay` output and the Testnet log as terminal frames, assemble with ffmpeg or Remotion on the Mac (`/Volumes/BackupPlus/VideoLab/remotion-worker` exists), voiceover via ElevenLabs (key in `repos/.env` / `aiaa-server-tools.env`), user reviews the script and voice first. Alternative: Rich records a QuickTime walkthrough. Link the file from README and the checklist.
2. **Submit.** Confirm the open route on <https://xrplgrants.org> that day (the August proposal noted intake pages change). Attach `docs/grant-proposal-2026-09-10.pdf`, the deck, the repo and demo links. Paste the one-paragraph pitch from `docs/grant-application-checklist.md` after updating it to the two operating models.
3. **v3.0 work, after submission**, in this order: tax-bill source (DoD 5) → CID pointer (DoD 4) → verdict table above written into the docs (DoD 3) → roast v3 → fresh Testnet run → version bump → evaluator → push.

## Commands and gotchas that cost time this week

```bash
npm run typecheck && npm test          # 127 tests; S3 scan has a 60 s budget (external volume is slow)
npm run loan-year:replay               # writes out/loan-year/run-*.json and the bank receipt CSV; reconciles 75/75
nohup npm run loan-year -- --key-drill > out/testnet-run-vN.log 2>&1 &   # ~20 min; detached so a stopped task cannot kill it
npm run test:testnet                   # 9 assertions over the newest testnet run record
npm run evidence -- <run.json> --out docs/evidence    # examiner pack; commit it with the run
python3 scripts/build-grant-deck.py && scripts/build-grant-pdf.sh       # rebuild deck and PDF after edits
```

- Testnet pacing: one six-leg period takes ~100 s. Escrow `CancelAfter` window on the ledger track is `max(240, 4 x STEP)` s and escrow finishes run before the period's payment legs; otherwise a finish lands past `CancelAfter` → `tecNO_PERMISSION`.
- A below-quorum multisig submitted with `submitAndWait` burns the `LastLedgerSequence` window; submit it with plain `submit` and autofill the two-signer proof fresh (`tefMAX_LEDGER` otherwise).
- After `--key-drill`, the drilled role's master key is disabled on Testnet; the wallet loader now detects `lsfDisableMaster` and funds a fresh wallet. Old wallet files are renamed `out/wallets.testnet.drilled-*.json`.
- Setup submits re-prepare up to three times after a provably closed ledger window (Testnet congestion). Settlement legs never re-sign; they go through `settleOnce` only.
- The reopened PGlite store after the S11 restart proof must stay live (key-drill events, final chain read); it is closed at the end of the run.
- AppleDouble `._*` sidecars appear next to every file on this volume; the run finder and the test-source reader ignore them; `find . -name '._*' -delete` before commits if they show up in `git status`.
- The sandbox proxies `curl` to localhost and to Testnet JSON-RPC (`{"error":"not found"}` / no response). Test pages on GitHub Pages; probe the ledger with xrpl.js over WSS from inside the repo (`npx tsx out/probe.mts`).
- GitHub Pages builds from `main` `/docs` with a 10-minute CDN cache; add `?v=<sha>` when checking a fresh deploy in the browser.
- The automation browser (Playwright MCP) holds a logged-in LinkedIn session; profile sections are lazy-loaded, use `/details/experience/` for the experience list.
- Policies in force: no Mainnet, no purchases, sub-agents never commit or push, ai-consult (CF/Ollama) for roast council and cheap drafts, outputs on `/Volumes/BackupPlus` not `/tmp`, commit trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` plus the `Claude-Session` line.

## Files that define v2 (start here when reading code)

`src/loan-year.ts` (orchestrator, both tracks), `src/servicing/analysis.ts` (1024.17), `src/servicing/apply.ts`, `src/servicing/disburse.ts`, `src/servicing/escrow-statements.ts`, `src/servicing/bank-receipts.ts`, `src/xrpl/settlement-journal.ts` + `src/db/settlement-store.ts` (S11), `src/xrpl/escrow.ts`, `src/xrpl/keys.ts`, `src/xrpl/record.ts` (NFToken URI), `src/cli/evidence-pack.ts`, `src/servicing/cost-model.ts`; docs: `docs/architecture.md` (§7a–7c, §11 control map), `docs/standards-mapping.md`, `docs/threat-model.md`, `docs/cost-model.md`, `docs/roast-v2-2026-09-10.md`, `docs/branch-comparison-2026-09-10.md`.
