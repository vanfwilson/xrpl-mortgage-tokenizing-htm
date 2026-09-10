# What it takes to start the grant process (checked 2026-09-08)

## Where to apply

| Program | How |
|---|---|
| **XRPL Grants (global, rolling)** | <https://xrplgrants.org> → Apply; award range US$10k–200k; product/integration first, growth metrics for later funding |
| **Brinc × XRPL Hong Kong Financial Innovation Program (HFIP)** | <https://brinc.io/xrpl-program> (cohort-based; register for the next cohort) |

## What a strong application contains (XRPL Grants FAQ and rubric)

- [x] **Public GitHub repo with a working proof of concept** — this repository; Testnet loan year in [testnet-run.md](testnet-run.md)
- [ ] **2-minute demo video** — record `npm run print` → paper → `npm run tokenize` → `npm run loan-year` (explorer links appear live)
- [x] **Clear XRPL integration plan** — [standards-mapping.md](standards-mapping.md) and [architecture.md](architecture.md): Payment, NFToken, TokenEscrow, key management; why XLS-65/66, EVM and Hooks were rejected ([appendix](appendix-deferred-amendments.md))
- [x] **3–12 month milestone roadmap** — [grant-narrative.md](grant-narrative.md)
- [x] **Budget breakdown and proposal** — [grant-proposal-2026-09-10.md](grant-proposal-2026-09-10.md) / [PDF](grant-proposal-2026-09-10.pdf) §7–9 (servicing-only milestones; supersedes the August 2026 PDF)
- [x] **Reviewer deck** — [grant-deck-2026-09-10.pptx](grant-deck-2026-09-10.pptx), 14 slides, built by `scripts/build-grant-deck.py`
- [x] **Team bios + company details** — [TEAM.md](../TEAM.md)
- [ ] **Traction** — banks that want HTM to run servicing operations under their name as the official servicer, and HTM's own-client servicing under its California licences; pipeline of loans that could be boarded (state honestly: conversations, no signed servicing contract yet)
- [x] **Security posture** — [threat-model.md](threat-model.md); key drill proven on Testnet
- [x] Eligibility basics: 18+, not OFAC-sanctioned, not Ripple employees; companies may apply

## The one-paragraph pitch to paste

High Tech Mortgage, Inc. is a licensed California mortgage broker (Sacramento + Manila). We take the close-of-escrow paper
package a title company hands us, scan it, tie every figure out to the cent, board the loan, and service it for thirty years
for the bank that owns it: payment application, escrow analysis under 12 CFR 1024.17, statements, Form 1098. The XRP Ledger
records every settlement leg to the cent without borrower data, holds each verified impound bill under a native date lock,
and carries one loan-record token per loan. It runs today on Testnet with only Mainnet-live transaction types:
<https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm>.

## Before submitting

1. Record the 2-minute video.
2. Done 2026-09-10: the proposal PDF and deck carry the servicing-only milestones; keep grant-narrative.md, the proposal and the deck in step.
3. State the open items verbatim from README "Open business items" (bank acceptance of ledger evidence, residential carve-outs and Idaho posture to counsel, production settlement asset, Idaho interest rule, live tax-bill source, first servicing contract).
4. Apply to XRPL Grants (rolling); register for the next HFIP cohort in parallel.
