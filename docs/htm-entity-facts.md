# High Tech Mortgage — entity facts of record

Source: Rich Young, via the owner, 2026-09-25. This file is the reference for the applicant
entity's legal identity. **It supersedes every "High Tech Mortgage, Inc." reference elsewhere in
this repository** — see the open correction at the bottom.

## Legal identity

| Field | Value |
|---|---|
| Legal name | **High Tech Mortgage, LLC** |
| Stylized as | HighTechMortgage |
| Entity type | Limited liability company (member-managed) |
| Founder and Lead Broker | Rich Young, CRS |
| Predecessor firm | Action Residential Mortgage & Property Management, founded by Rich Young in **1994** |
| Relationship | HTM is the digital/virtual evolution of the predecessor California company |
| Website | https://hightechmortgage.com |

## Licensing

| Field | Value |
|---|---|
| NMLS ID | #291547 |
| California DRE Broker's License | #01106294 |
| Capacity | Licensed California Real Estate & Mortgage Broker |

## Addresses

Corporate documents list historical and operational connections to both:

- 730 I Street, Sacramento, CA 95814
- 1466 Bellevue Avenue, Suite 27, Burlingame, CA 94010

The Manila operational address used on HTM letterhead is 19F Marco Polo Ortigas, Sapphire Road,
Ortigas Center, 1600 Pasig City, Metro Manila.

## Business model and specialty book

Virtual brokerage: the firm operates entirely online and paperwork-light, with clients handling
milestones by phone, email and video consultation.

Specialty book — deliberately the scenarios macro-lenders decline:

- international income and dual-country documentation
- Fil-Am / immigrant financing structures
- **commercial debt schedules**
- guidance for high-net-worth clients on cryptocurrency liquidity management, blockchain
  infrastructure, and tokenized mortgage environments

Per Rich Young, 2026-09-25: **"the most lucrative wheelhouse is commercial debt and servicing."**
See the strategic note below — this is not yet reflected in the grant proposal's milestone plan.

## Ownership

Rich Young holds **100% of the membership interest** in High Tech Mortgage, LLC. No outside
members. Confirmed by the owner 2026-09-25; previously inferred from "owned by Rich Young" in
the grant proposal and carried as unverified until then.

## OPEN CORRECTION — "Inc." vs "LLC"

As of 2026-09-25 the repository names the entity **"High Tech Mortgage, Inc."** in 15 files and
"LLC" in none. Known occurrences include:

- `LICENSE` — the MIT copyright holder
- `docs/grant-cover-letter-2026-09-17-signed.pdf` — **signed by Rich Young and Trish Wilson**;
  correcting the entity name requires new signatures, the same constraint noted for the SEC
  naming issue in commit `ef3a28a`
- `docs/grant-proposal-2026-09-11.md` (3) and its rendered PDFs
- `docs/grant-cover-letter-2026-09-17.md` (2), `docs/grant-cover-letter-2026-09-24.md` (2)
- `README.md`, `docs/grant-narrative.md`, `docs/grant-application-checklist.md`,
  `docs/xrpl-next-steps-2026-09-17.md`, `docs/xrpl-outreach-email-draft.md`,
  `docs/build-prompt-servicing-architecture-2026-09-08.md`
- `docs/demo/canonical-loan.json`, `data/documents/02-fha-model-note.json`
- `scripts/make-funding-sheet.py`, `scripts/build-grant-deck.py`

**Not yet corrected.** Before the sweep runs, confirm the exact filed name and formation state
against the California Secretary of State record rather than a bio — "High Tech Mortgage, LLC"
vs "HighTechMortgage LLC" matters on a grant agreement.

## Strategic note — commercial vs residential

Everything proven on XRPL Mainnet to date is a residential FHA 30-year fixed-rate fixture. The
settlement rail is asset-agnostic (`mortgageos/ledger/*`: MPT issuance, escrow legs, memo
format, submit path, audit sweep). The residential coupling lives in one module,
`mortgageos/servicing/amortization.py`:

- `assert_fixed_rate()` requires an identical P&I every period, which rejects balloons,
  interest-only periods and rate resets
- `respa_monthly()` / `respa_shortfall()` implement 12 CFR 1024.17 consumer escrow
- `REG_MARKERS` in `phases.py` carry `RESPA-1024.17`, `TILA-1026.41`, `fixed_rate_30y`

Commercial debt is outside consumer credit, so RESPA, TILA, Reg Z periodic statements and
borrower Form 1098 largely fall away — which removes much of milestones M1–M3 in the current
$200,000 proposal, including the consumer note characterization that §11 names as the gate on
touching a live loan.

**Implication:** if commercial is the wheelhouse, the funded milestone plan is aimed at the
wrong market. This needs a planning pass (`ai_plan` + roast council) before the proposal is
re-pitched. Not started.
