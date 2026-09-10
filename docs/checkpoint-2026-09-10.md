# Completion-pass checkpoint — paused by user

Date: 2026-09-10. Branch: `codex-servicing-rebuild`. Starting commit: `a4fc5c9`.

The user requested a pause and push to conserve credits. **This is an unfinished-work checkpoint, not a claim that the original research or every A–E requirement is complete.** Main and other branches are not targets.

## Implemented since the previous checkpoint

- Evidence-bearing ordinary NOE/RFI, force-placed insurance and loss-mitigation workflows; separate early-intervention deadlines. Unsupported exceptions route to specialist review. No foreclosure authorization is produced.
- Initial/annual escrow statement contents, account-history tie-outs and delivery evidence; transfer date validation, record manifest and misdirected-payment protection.
- Durable PostgreSQL business-event hash chain, append-only and scoped; migration `004_servicing_event_log.sql`. Tested only in isolated PGlite, not deployed to a shared database.
- Issuer preflight binds locking evidence to the actual validated issuer account. Escrow timestamp range and bounded recovery-window checks.
- Coupled twelve-receipt impound replay: opening 123050 + deposits 713136 + simulated advance 40170 - disbursements 713136 = closing 163220 cents. Surplus/shortage examples remain separate scenarios, not this actual closing balance.
- Removed three obsolete Python sketches under the build prompt's S6 authorization. Recoverable at `a4fc5c9`; they contained obsolete scaling, schema references and an APN memo.
- Corrected a broken research link and the incorrectly expanded baseline hash. Git resolves `3368b48` to `3368b4860679f254bfc7fd4945e2a001a81c8a15`.

## Validation already completed

- Typecheck and **117 tests in 16 files passed** after the substantive implementation changes.
- **Two live Devnet checks passed** with the stricter issuer preflight (2026-09-10). New raw smoke output is in ignored `out/devnet-smoke.json`; the previously published Devnet evidence remains historical.
- Read-only re-verification of **81 original Testnet hashes passed** and updated the published evidence/replay. The prior supplemental five transactions remain documented; no new Testnet payment run was submitted.
- A five-role ai-consult review and code-review pass ran. Several advisory findings were rejected: `parseDay` returns milliseconds, ISO dates sort chronologically, and transfer hash/required-record validation already exists. Advisory output is not a compliance certification.

## Resume here — do not restart the project

1. Finish the explicit original-prompt and A–E completion register. The older validation report is a historical snapshot and must be reconciled with these additions, not silently treated as current.
2. Run `npm exec tsx src/cli/audit-historical-ledger.ts`. Its first attempt failed because the prior report supplied the wrong expanded commit hash. The script now uses the verified hash but has **not been rerun**. No new historical evidence bundle is claimed.
3. Finish historical claim-by-claim documentation tracing, raw ledger arithmetic reconciliation, source freshness and exact legal excerpts. Summary-level coverage in the original report is not proof of exhaustive completion.
4. Locate and quote the requested HUD custodial passage. The official index points to the August 12, 2026 handbook PDF below; the web reader refused its 14 MB size. Exact passage remains **UNVERIFIED in this pass**.
5. Review and integrate the new ordinary-path case/statement modules with the broader replay and control map. Full exception-specific statements, bank operation scheduling, actual notice delivery and tax filing are not newly implemented by this checkpoint.
6. Keep F/G deferred under the build prompt's stop-after-E instruction unless the user changes scope. External licensing, custody, bank agreements, HSM/vendor controls and Idaho counsel approval remain unresolved.

## Primary sources consulted this pass

Accessed 2026-09-10. No claim of production legal compliance follows from these engineering mappings.

- [Escrow statements and insurance disbursements — 1024.17](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/)
- [Servicing transfers — 1024.33](https://www.consumerfinance.gov/rules-policy/regulations/1024/33/)
- [Error resolution — 1024.35](https://www.consumerfinance.gov/rules-policy/regulations/1024/35/)
- [Information requests — 1024.36](https://www.consumerfinance.gov/rules-policy/regulations/1024/36/)
- [Force-placed insurance — 1024.37](https://www.consumerfinance.gov/rules-policy/regulations/1024/37/)
- [Early intervention — 1024.39](https://www.consumerfinance.gov/rules-policy/regulations/1024/39/)
- [Loss mitigation — 1024.41](https://www.consumerfinance.gov/rules-policy/regulations/1024/41/)
- [Ownership notices — 1026.39](https://www.consumerfinance.gov/rules-policy/regulations/1026/39/)
- [IRS 1098 instructions](https://www.irs.gov/instructions/i1098) — returned page labels itself 12/2026; retain effective-year review, not an unconditional reportability assumption.
- [XRPL EscrowCreate](https://xrpl.org/docs/references/protocol/transactions/types/escrowcreate)
- [XRPL account_info](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_info)
- [XRPL Grants rubric](https://xrplgrants.org/faq)
- [HUD handbook index](https://www.hud.gov/hudclips/handbooks/housing); [linked August 2026 PDF](https://www.hud.gov/sites/default/files/Housing/documents/40001-hsgh-Update-18.pdf) — exact custodial passage still pending extraction.
