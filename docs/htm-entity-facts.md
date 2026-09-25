# High Tech Mortgage — entity facts of record

Source: Rich Young, via the owner, 2026-09-25. This file is the reference for the applicant
entity's legal identity. **It supersedes every "High Tech Mortgage, Inc." reference elsewhere in
this repository** — see the open correction at the bottom.

## Legal identity

| Field | Value |
|---|---|
| Legal name (as filed) | **HighTech Mortgage LLC** — one word, no comma. See the filing note below. |
| Also written as | High Tech Mortgage, LLC / HighTechMortgage (marketing and prior documents) |
| California entity number | B20250043019 (document no. B20250043019, Initial Filing) |
| Registered address on the filing | 730 I Street, Sacramento, CA 95814 |
| Date filed with CA SoS | **2025-03-24** (initial filing; approval notice 2025-03-26) |
| Federal EIN assigned | **2026-06-06** (IRS Notice CP575G). The number itself is deliberately NOT recorded here. |
| Statement of Information | Filed within the 90-day window (confirmed by the owner 2026-09-25). Entity in good standing; recurring biennial filing thereafter. |
| Entity type | Limited liability company, California (member-managed) |
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

Revenue lines, per the owner 2026-09-25: **"Our bread and butter is Philippine condos and
California residential loans, but the cream is at the commercial."**

- **Bread and butter:** Philippine condominium sales (GRC, under Maria Theresa Wilson's PRC
  brokerage licence) and California residential mortgage loans (HTM, under Rich Young's DRE and
  NMLS licences).
- **Cream:** commercial debt and servicing — the highest-margin line, entered deliberately and
  gradually rather than as a pivot.

Specialty book — deliberately the scenarios macro-lenders decline:

- international income and dual-country documentation
- Fil-Am / immigrant financing structures
- **commercial debt schedules**
- guidance for high-net-worth clients on cryptocurrency liquidity management, blockchain
  infrastructure, and tokenized mortgage environments

Per Rich Young, 2026-09-25: **"the most lucrative wheelhouse is commercial debt and servicing."**
See the strategic note below — this is not yet reflected in the grant proposal's milestone plan.

## Ownership

Rich Young — full legal name **Richard Kent Young, CRS** — holds **100% of the membership
interest** in HighTech Mortgage LLC. No outside members.

Independently corroborated: the IRS CP575G notice of 2026-06-06 addresses the entity as
"HIGHTECH MORTGAGE LLC / RICHARD YOUNG SOLE MBR", i.e. federal records carry him as sole
member. Also confirmed by the owner 2026-09-25. Previously inferred from "owned by Rich Young"
in the grant proposal and carried as unverified until then.

Per his email signature: licensed by the California Department of Real Estate **since 1993**.
Three dates that are easy to conflate and are all distinct:

| Date | What it is |
|---|---|
| 1993 | Rich Young licensed by the California DRE |
| 1994 | Action Residential Mortgage & Property Management founded |
| 2025-03-24 | HighTech Mortgage LLC filed with the California Secretary of State |
| 2026-06-06 | Federal EIN assigned |

The Brinc application was submitted with "founded 1/1/1994", which is the Action Residential
date, not the LLC's. See `docs/brinc-hfip-correction-2026-09-25.md`.

**Addresses — resolved, not a discrepancy.** The business office is **730 I Street,
Sacramento, CA 95814**, which is what the California Secretary of State filing registers and
what should appear on any agreement or correspondence. The Tucson, Arizona address on the IRS
CP575G notice is Rich Young's other home, used as the personal mailing address for the sole
member. A member residing outside the state of incorporation is ordinary and carries no
implication for the entity.

An earlier version of this note flagged a possible conflict with the standing instruction not
to use an Arizona identity on HTM material. That was a conflation: the instruction concerns
**HighTechLending**, a different company, and has nothing to do with where Rich lives.
Withdrawn.

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

**Not yet corrected.** The filed name is confirmed: **HighTech Mortgage LLC**, California
entity **B20250043019**, Initial Filing, **File Date 03/24/2025**, approval notice dated
March 26, 2025, registered at 730 I Street, Sacramento, CA 95814. Source: the California
Secretary of State "Initial Business Filing Approved" notice emailed by Rich Young 2026-09-25
at 13:56, read directly from the document on 2026-09-25.

The same mail carries an IRS notice (CP575G) showing an Employer ID Number. Do not forward that
attachment to third parties and do not copy the EIN into this repository.

Note the sweep is a three-way change, not two: occurrences are currently "High Tech Mortgage,
Inc."; the marketing spelling is "High Tech Mortgage, LLC"; the filed legal name is "HighTech
Mortgage LLC". Legal and contractual contexts (LICENSE, cover letters, any grant agreement)
should carry the filed name. Prose may keep the readable spelling.

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

**Current posture (owner, 2026-09-25): "We are in residential now. We are getting into
commercial slowly."**

So the $200,000 milestone plan is NOT misaimed. Residential is the operating business and the
near-term pilot target; the M1-M7 consumer-compliance work (RESPA escrow analysis, Reg Z
periodic statements, 1024.35-.41 case workflows, Form 1098) is what residential actually
requires and should stay. Rich's "most lucrative wheelhouse is commercial debt and servicing"
describes where the margin is, not where the business is today.

Commercial is a planned, gradual extension, and the sequencing argument still holds on its own
terms: it needs only a relaxation of `assert_fixed_rate`, and being outside consumer credit it
is a shorter regulatory path to a live non-synthetic loan. Treat it as a track to add to the
plan later, not a replacement for it. An earlier draft of this note claimed the funded plan was
"aimed at the wrong market" — that was an overstatement and is withdrawn.
