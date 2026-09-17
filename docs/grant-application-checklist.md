# What it takes to start the grant process (checked 2026-09-08)

## Where to apply

| Program | How |
|---|---|
| **XRPL Grants (global, rolling)** | <https://xrplgrants.org> → Apply; award range US$10k–200k; product/integration first, growth metrics for later funding |
| **Brinc × XRPL Hong Kong Financial Innovation Program (HFIP)** | <https://brinc.io/xrpl-program> (cohort-based; register for the next cohort) |

## What a strong application contains (XRPL Grants FAQ and rubric)

- [x] **Public GitHub repo with a working proof of concept** — this repository; Testnet loan year in [testnet-run.md](testnet-run.md)
- [x] **Product demo or prototype link** — the Testnet evidence report <https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/evidence/v3/> plus `python -m mortgageos.verify`. A video is not required for XRPL Grants (checked xrplgrants.org/faq 2026-09-15); the "2-min Project Demo" is an Accelerator-track item only, optional here
- [x] **Clear XRPL integration plan** — [v3-architecture.md](v3-architecture.md): MPT note asset, DepositAuth/Preauth, TokenEscrow legs, asset hold; XLS-65/66 forward compatibility only (feature state verified 2026-09-11)
- [x] **3–12 month milestone roadmap** — [grant-narrative.md](grant-narrative.md)
- [x] **Budget breakdown and proposal** — [grant-proposal-2026-09-11.md](grant-proposal-2026-09-11.md) / [PDF](grant-proposal-2026-09-11.pdf) §9–10 (milestones, targets and budget; rewritten September 17, 2026 around the Fannie Mae / CFPB servicing standard)
- [x] **Reviewer deck** — [grant-deck-2026-09-11.pptx](grant-deck-2026-09-11.pptx), 15 slides, built by `scripts/build-grant-deck.py`
- [x] **Joint-venture applicants, team bios + company details** — High Tech Mortgage, Inc. (HTM) and Global Realtor 4A Cause (GRC); [TEAM.md](../TEAM.md)
- [x] **Submission contact** — Dr Van Wilson, `vanw@globalrealtor4acause.com` (GRC email)
- [ ] **Traction** — banks that want HTM to run servicing operations under their name as the official servicer, and HTM's own-client servicing under its California licences; pipeline of loans that could be boarded (state honestly: conversations, no signed servicing contract yet)
- [x] **Security posture** — [threat-model.md](threat-model.md); key drill proven on Testnet
- [x] Eligibility basics: 18+, not OFAC-sanctioned, not Ripple employees; companies may apply

## The one-paragraph pitch to paste

Use the "One paragraph" section of [grant-narrative.md](grant-narrative.md); it is kept identical in substance to the letter's executive summary.

## Before submitting

1. (Optional) record a 2-minute walkthrough of the verify run if applying to the Accelerator track.
2. Proposal rewritten 2026-09-17 (no earlier-generation terms; servicing control map in §3). Deck and grant-narrative.md aligned 2026-09-17.
3. State the open items verbatim from README "Open business items" (bank acceptance of ledger evidence, residential carve-outs and Idaho posture to counsel, production settlement asset, Idaho interest rule, live tax-bill source, first servicing contract).
4. Apply to XRPL Grants (rolling); register for the next HFIP cohort in parallel.
5. Submit under the HTM–GRC joint venture using Dr Van Wilson's GRC address, `vanw@globalrealtor4acause.com`.
