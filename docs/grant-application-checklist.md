# What it takes to start the grant process (checked 2026-09-04)

## Where to apply

| Program | Status | How |
|---|---|---|
| **Brinc × XRPL Hong Kong Financial Innovation Program (HFIP)** | Applications for the current cohort are **closed**; the page offers a form to be notified of the next one | <https://brinc.io/xrpl-program> → Airtable form <https://airtable.com/appO6UjaQfU92aIhc/pagojNBqROFqN80Xl/form> (page 1 asks: Program, Company Name, Your Email, Company Website; later pages cover startup, team, traction, use case) |
| **XRPL Grants (global, rolling)** | Open, rolling pre-screen within 2–3 weeks | <https://xrplgrants.org> → Apply; award range US$10k–200k, ~30 % tied to product/integration milestones, ~70 % to growth milestones |
| **XRPL Accelerator** | Cohort-based, US$50k–200k | via xrplgrants.org; incorporated entities only for post-programme venture funding |

Process (both): online application → pre-screen → full application invitation → interview → award → onboarding with first milestone funding. HFIP: 12 weeks online, Demo Day in Hong Kong, grants awarded *during* the programme against milestones, not guaranteed on acceptance.

## What a strong application contains (from the XRPL Grants FAQ)

- [x] **Public GitHub repo with a working proof of concept** — this repository; Devnet run log in [devnet-run.md](devnet-run.md)
- [ ] **2-minute demo video** — record `npm run print` → paper stack → `npm run scan` → `npm run demo` (explorer links appear live)
- [x] **Clear XRPL integration plan** — [standards-mapping.md](standards-mapping.md): why MPT + XLS-65/66 instead of NFTs or IOUs
- [x] **3–12 month milestone roadmap** — 12-week plan in [grant-narrative.md](grant-narrative.md)
- [x] **Budget breakdown** — $200,000 over 12 months, M1–M7, in the [August 2026 proposal](grant-proposal-2026-08-24.pdf) §5–7
- [x] **At least one experienced developer on the core team** — name them in the form
- [x] **Team bios + company details** — [TEAM.md](../TEAM.md): Rich Young (Founder/President, DRE #01106294, NMLS #291547), Dr. Van Wilson (data science, MIT), Trish Wilson (PRC #0024025), Bill Thompson
- [ ] **Traction** — pipeline of loans that could be boarded; title/escrow partner willing to run the scanner pilot; HK investor conversations
- [ ] **Hong Kong connection** (HFIP preference) — HK PI-offering angle, Manila operations in HK time zone, any HK partner or advisor
- [x] Eligibility basics: 18+, not OFAC-sanctioned, not Ripple employees; companies may apply

## The one-paragraph pitch to paste

High Tech Mortgage, Inc. is a licensed US mortgage lender (Sacramento + Manila). We take the close-of-escrow
paper package a title company hands us (Closing Disclosure, Fannie Mae Form 3200 Note, Form 3013 Deed of Trust,
recorded deed), scan it, tie every figure out to the cent, and tokenize the note on the XRP Ledger as a
permissioned Multi-Purpose Token funded through a Single Asset Vault and Lending Protocol facility (XLS-65/66),
with the servicer's three standard disbursements (P&I, property tax, hazard insurance) mirrored on-ledger.
It runs today on Devnet: <https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm>.

## Before submitting

1. Record the 2-minute video (screen capture of the three commands + the Devnet explorer).
2. Reconcile the 12-week HFIP milestones in grant-narrative.md with the 12-month M1–M7 plan in the August proposal (the repo now completes most of M1–M2).
3. Decide the HK anchor: partner, advisor, or PI-offering counsel.
4. Register on the Brinc notification form now; apply to XRPL Grants (rolling) in parallel so the repo is under review while waiting for the next HFIP cohort.
