# Next Steps: Communicating with XRPL / Ripple / Brinc

**Originally written September 17, 2026. Contact channels and open/closed status re-verified live on
September 24, 2026 — see the re-verification note in §2 and the corrected §3.**

Status snapshot and exact next actions for getting MortgageOS™ in front of XRPL Grants,
RippleX, and the Brinc × XRPL Hong Kong Financial Innovation Program (HFIP). Kept next to the
proposal so the plan and the documents never drift.

## 1. Brinc × XRPL Hong Kong Financial Innovation Program (HFIP) — IN PROGRESS

- **Done (2026-09-17):** Submitted the short-form questionnaire at
  `brinc.io/xrpl-program` (Airtable form, program `Ripple x Brinc-1`).
  - Company Name: "High Tech Mortgage, Inc. (HTM) & Global Realtor 4A Cause (GRC) — MortgageOS
    Joint Venture"
  - Email: vanw@globalrealtor4acause.com
  - Website: hightechmortgage.com / globalrealtor4acause.com
- **Next action (you):** Watch the GRC inbox (`vanw@globalrealtor4acause.com`), **including
  spam**, for an automated email containing the link to the full long-form HFIP application.
  Airtable's own confirmation explicitly warns it can land in spam.
- **When the long-form arrives:** Most of its fields map directly from
  `docs/xrplgrants-application-answers-2026-09-17.md` (Executive Summary, Architecture,
  Milestones M1–M7, Budget, Repo/Testnet links, Team & Entity Background). Send me the long-form
  questions and I'll draft the answers the same way.
- **Note:** the public `brinc.io/xrpl-program` page displays contradictory copy — a banner says
  "applications are closed," but the Airtable short-form itself is live and accepted the
  submission. The long-form email is the real signal of whether the cohort is actually open.

## 2. Direct outreach to XRPL Grants (info@xrplgrants.org) — BLOCKED, needs you

- **Verified live contacts (re-checked 2026-09-24, both by raw page scrape):**
  - `info@xrplgrants.org` — the only email published on `xrplgrants.org`, explicitly for
    "application support." This is the **grants-committee** channel.
  - `RippleXEcosystem@ripple.com` — the only email published on the submission portal
    `submit.xrplgrants.org/submit`, given as the contact to use *while there are no open calls*.
    This is the **RippleX ecosystem / programs** channel and is the closer match for
    "XRPL exec management." **Send to both.**
  - No `grants@xrplgrants.org` address exists on either site — do not use it. Note the domain is
    `xrplgrants.org` (plural "grants"); `xrplgrant.org` is not the right domain.
- **Status:** an automated send attempt was blocked by Claude Code's own permission layer (not
  by Gmail, not by the recipient). Nothing was sent.
- **What's ready:** the transmittal letter (`docs/grant-cover-letter-2026-09-17.md`), the
  12-page grant proposal (`docs/grant-proposal-2026-09-11.pdf`, commit `b34096c` on branch
  `v3`), and the **ready-to-send email body + send parameters** in
  `docs/xrpl-outreach-email-draft.md` (drafted 2026-09-24 — one message, To `info@xrplgrants.org`,
  Cc `RippleXEcosystem@ripple.com`).
- **Next action (you), pick one:**
  1. Send it yourself from `vanw@globalrealtor4acause.com` (or any mailbox), to
     `info@xrplgrants.org`, with the PDF attached — copy the letter text directly from
     `docs/grant-cover-letter-2026-09-17.md`.
  2. Tell me to retry the send from your connected Gmail (`vfw4444@gmail.com`) and approve the
     send action when Claude Code asks — note this sends under your personal Gmail identity, not
     the GRC domain the letter is signed from.
- **Before sending either way:** Rich and Trish still need to apply an actual signature to the
  letter — the current file only has printed names.

## 3. General XRPL Grants application — CONFIRMED STILL CLOSED (re-verified 2026-09-24)

- **Correction to the original Sept 17 note.** That check looked only at the marketing site
  `xrplgrants.org`, which does not surface the form. The real intake lives on a separate
  subdomain: **`submit.xrplgrants.org`** (a Submittable portal), reached as the
  "Unified Application: XRPL Grants & XRPL Accelerator." One unified form covers XRPL Grants,
  the XRPL Accelerator, and the sub-funds (AI, Brazil, Korea/Japan, Global, DIFC, Tenity).
- **Live status on 2026-09-24:** the portal returns, verbatim,
  `There are presently no open calls for applications.` Every program on it — Grants,
  Accelerator, Product Integrations, Technical Mentorship, Hackathons, Ecosystem Partnerships,
  Equity Investment — is closed. So the Sept 17 conclusion ("no open form") was right, but for
  the wrong reason; we now have the correct URL to watch.
- **Watch this URL, not the marketing homepage:**
  `https://submit.xrplgrants.org/submit`
- `xrplgrants.org` also states: **"Additional new programming to be announced in October 2026."**
  That is the next expected reopening signal — recheck in early October.
- **Encouraging fit signal:** the program states it funds projects with financial use-cases
  driving on-chain XRPL activity, explicitly naming **Real World Assets (RWA)**, collateral
  movement, and trade finance, and its use-case picker includes a **Tokenization** category.
  MortgageOS sits squarely in the stated target.
- `docs/xrplgrants-application-answers-2026-09-17.md` stays pre-built and field-mapped for the
  reopening — it will be a copy-paste job.

## 4. Ripple corporate "Partner With Us" — LOWER PRIORITY, needs you (CAPTCHA)

- `ripple.com/lp/partner-with-us/` is Ripple's general enterprise-partnerships intake, separate
  from XRPL Grants/RippleX. It is gated by a reCAPTCHA that automation cannot complete, and its
  "Solution Interest" dropdown (Cross-border payments / Crypto liquidity / Stablecoin / Custody /
  Other) doesn't have a tokenization/RWA option — it likely routes to enterprise sales, not the
  ecosystem team. Lower priority than §2. If you want to try it, you'll need to fill and submit
  it yourself.

## 6. THE BIGGER SHIFT: XRPL funding decentralized in 2026 (researched 2026-09-24)

Waiting for "the XRPL Grants wave to reopen" is now only a partial strategy. Ripple published
*Supporting Innovation on the XRP Ledger: What's Changing in 2026*
(`ripple.com/insights/supporting-innovation-on-the-xrp-ledger/`), stating:

> "While those programs remain important, 2026 marks a shift toward a more distributed model,
> where independent organizations, regional hubs, venture partners, and community-led initiatives
> play a larger role in supporting builders."

XRPL Grants is **not** being wound down, but it is no longer the main door. Funding now runs
through several independent bodies. Ranked by fit to MortgageOS:

| Channel | Fit | Status |
|---|---|---|
| **Ripple FinTech Builder Program** | **BEST** — explicitly for institutional-grade financial apps on XRPL: tokenization, credit infrastructure, regulated financial services | Announced, no public apply URL found as of 2026-09-24 |
| **XRP Asia** (new APAC regional hub) | **STRONG** — matches the Manila / ASEAN banking corridor already claimed in our letter | Announced, intake not yet located |
| **XRPL Commons grants** (3 tracks, incl. `Glow`) | GOOD — `Glow` retroactively rewards *completed* open-source XRPL contributions; our MIT repo qualifies as-is | Launched July 2026; apply URL not verified — `xrpl-commons.org/grants` 404s, needs a manual look |
| **XAO DAO** | Fallback — community microgrants, voted | Ongoing |
| **UDAX** university accelerators | Poor fit — we are not university-affiliated | Expanding (Oxford summer 2026, UC Berkeley fall 2026) |

- **"A new dedicated XRPL funding hub will soon launch"** as a single entry point for discovering
  every grant/accelerator in the ecosystem. This is very likely what the
  "additional new programming to be announced in **October 2026**" on xrplgrants.org refers to.
  **That hub is the thing to watch.**
- **Action implied:** the email in `docs/xrpl-outreach-email-draft.md` should go out *now*
  (once signed) rather than waiting for October. Under a distributed model, being known to the
  RippleX ecosystem team before the hub launches is worth more than a cold application after it.

## 7. Does shipping more code improve the odds? Yes — specifically

- **Testnet → Mainnet is the single biggest credibility jump available to us.** Every claim in
  the proposal is currently Testnet-only, and reviewers discount Testnet heavily. The proposal
  already notes we use only amendments live on Mainnet, so this is executable, not speculative.
- **The `Glow` track is retroactive** — it funds open-source work already completed. For that
  channel, shipping the code *is* the application; there is no need to pitch ahead of building.
- **Each new release is a legitimate reason to re-contact** the ecosystem team without
  nagging — a short "v3.2 is live on Mainnet, here's the evidence report" note re-opens the
  thread on substance.
- Keep the evidence report at
  `vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/evidence/v3/` current with each release; it
  is the artifact doing the persuading.

## 5. Community / developer-relations channels — for ongoing visibility

- RippleX Discord: xrpldevs.org
- RippleX Twitch: twitch.tv/ripplexdev
- Brinc general contact: marketing@brinc.io

## Summary: what to do right now

1. **Get Rich's and Trish's actual signatures** on `docs/grant-cover-letter-2026-09-17.md` —
   this is the only hard blocker on the email going out.
2. **Send the letter + `docs/grant-proposal-2026-09-11.pdf` to BOTH**
   `info@xrplgrants.org` (grants committee) **and** `RippleXEcosystem@ripple.com`
   (RippleX ecosystem team). Preferred sender identity is `vanw@globalrealtor4acause.com`,
   which matches the domain the letter is signed from.
3. Watch `vanw@globalrealtor4acause.com` (incl. spam) for the Brinc HFIP long-form link.
4. Recheck `https://submit.xrplgrants.org/submit` in **early October 2026** for the announced
   new programming.

## Link check (2026-09-24)

All public links cited in the cover letter resolve (HTTP 200):
`github.com/vanfwilson/xrpl-mortgage-tokenizing-htm`,
`vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/evidence/v3/`,
`hightechmortgage.com`, `globalrealtor4acause.com`.
