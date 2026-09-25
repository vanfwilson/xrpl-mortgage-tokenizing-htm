# Brinc HFIP application — exact contents as filled, 2026-09-25

**Status: FILLED, NOT SUBMITTED.** Form URL:
https://airtable.com/appO6UjaQfU92aIhc/pagY061yePgBn1sQT/form

This is a verbatim dump of every answer currently sitting in the form, captured from the live
page so it can be reviewed without access to the browser holding it.

## Program and contact

| Field | Value |
|---|---|
| Program | Ripple x Brinc-1 (locked) |
| How did you hear about us? | XRPL Foundation |
| Founder First / Last Name | Van / Wilson |
| Email | vanw@globalrealtor4acause.com |
| Title | Project Lead, MortgageOS — Data Science, AI & Blockchain (GRC) |
| LinkedIn | https://linkedin.com/in/drvanwilson |

## Team

| Field | Value |
|---|---|
| Founder Status | At least two founders are full-time |
| Technical lead? | Yes |
| Started a company before? | Yes |
| Successfully exited? | Yes |

## Company

| Field | Value |
|---|---|
| Company Name | High Tech Mortgage, LLC (HTM) & Global Realtor 4A Cause (GRC) — MortgageOS Joint Venture |
| Legal name | High Tech Mortgage, LLC |
| Website | https://hightechmortgage.com |
| Founded | 1/1/1994 (year from the Action Residential lineage; the form demanded a day) |
| Regions operating | North America, Southeast Asia |
| Registered / incorporated? | Yes — United States |
| Business Model | B2B Software, SaaS |
| Pitch Deck | grant-deck-2026-09-25.pptx (attached) |
| 1-Minute Pitch URL | *(blank — optional; fast-tracks to a DD call)* |
| Socials (Telegram / Discord / X / LinkedIn) | *(all blank — optional)* |

## Traction and financials

| Field | Value |
|---|---|
| Active users or customers | 0 |
| Proof of concept / prototype? | Yes |
| Revenue Generating | **No** |
| Runway (months) | **999** — declared in the equity text as a placeholder, not a disclosure |
| External investment to date? | No |
| Current valuation | **$0.00** — explained in the equity text |
| Currently fundraising? | No |

## Open items before submission

- Exact filed entity name and formation state from the California Secretary of State, before the
  repo-wide `Inc.` → `LLC` sweep touches `LICENSE` and the signed cover letter. See
  `docs/htm-entity-facts.md`.
- The 9/17 Brinc email in the GRC inbox may carry a personalised long-form link; unread as of
  this writing. If it does, confirm this generic form is the right intake.
- Rich Young at 100% membership: **confirmed** by the owner 2026-09-25.

---

# Long-form answers, verbatim

## Founder and Key Member Details

MortgageOS is built by a four-person joint venture between High Tech Mortgage, LLC (HTM) and Global Realtor 4A Cause (GRC).

Rich Young, CRS — Founder, Lead Broker and Managing Member, HTM. California DRE Broker's License #01106294, NMLS #291547; more than 32 years in California real estate and mortgage lending. He founded Action Residential Mortgage & Property Management in 1994 and built HTM as its virtual successor, specialising in the scenarios macro-lenders decline — international income, dual-country documentation, Fil-Am and immigrant financing, and commercial debt schedules. He is the licensed principal and directs California deployment, origination, servicing and compliance.

Dr Van Wilson — GRC, Data Science, AI and Blockchain; technical lead and project contact. Post-graduate degree in data science and AI from MIT (2022). Built Fannie Mae's post-COVID mortgage-forbearance forecasting model, and an AI legal-document model for a U.S. federal financial regulator. AWS, Databricks, Blockchain Training Alliance and Microsoft certified; certified PostgreSQL, SQL Server and MySQL DBA. Real estate investor since 1998 with 120+ closed transactions. He designed and wrote MortgageOS and reviews all code.

Maria Theresa Wilson (aka Trish Wilson) — Owner, GRC; Philippine Real Estate and Finance. Licensed Philippine real estate broker (PRC 0024025), former Certified Public Accountant and banker, former internal auditor at Philippine Airlines, licensed U.S. Realtor and International Certified Financial Consultant. Executive-level relationships with three of the largest Philippine developers — Megaworld, Ayala Land and ArthaLand — and their lender-bank groups. She leads Philippine market development and the Manila servicing-operations team under dual control.

Bill Thompson — GRC, Operations, IT and Logistics. ITIL v4 service management and Six Sigma quality assurance expert; CompTIA A+ and TOPCIT certified. Ateneo Graduate School of Business and California State University, Dominguez Hills. He owns operations, infrastructure and process discipline for the pilot, including the dual-control task queue.

Team profiles: https://hightechmortgage.com/about/

## Exit Details

Vertical: real estate and mortgage finance.

The founding team has built up privately held corporations, operated them profitably and exited them. These were owner-operator exits — a business built, run and sold or wound down on its own terms — rather than venture-backed M&A or IPO events, and we flag the distinction so the answer is not read as more than it is. The most directly relevant example is the lineage of the applicant itself: Rich Young founded Action Residential Mortgage & Property Management in California in 1994 and carried that business through to High Tech Mortgage, LLC, its virtual successor.

We are not pursuing a venture-scale exit with MortgageOS. The venture is being built for organic compounding growth with expansion systems in place, and for a protocol that other institutions run themselves, rather than for a near-term sale.

## Company Description (150 char limit)

Mortgage note tokenization and servicing on the XRP Ledger: a digital twin of each note, with monthly payments settled and proven on-chain.

## What problem does your company solve today?

U.S. mortgage notes and their monthly servicing cash flows are illiquid, siloed bank assets with no independently verifiable settlement record. A lender that owns a note cannot prove to a counterparty, an auditor or an examiner that a given month's principal, interest and escrow actually settled, other than by trusting the servicer's own books. That opacity is what makes mortgage assets expensive to service, slow to transfer and hard to finance. The same gap blocks new markets: in the Philippines, banks were handed lending capacity when the Bangko Sentral ng Pilipinas cut the reserve requirement from 7% to 5% effective March 28, 2025, but they do not know how to originate, fund or service residential loans without taking on risk they cannot measure.

## What is the solution your company is creating?

MortgageOS puts two strictly separated things on the XRP Ledger for each loan. The asset layer: one Multi-Purpose Token issuance (XLS-89d) per loan is the unalterable digital twin of the note — the lender's right to the fixed principal-and-interest cash flow — held at face value, transferable only between authorized institutions, escrowable, and beyond the issuer's power to reduce. The servicing rail: each month's P&I and impound legs settle through native TokenEscrow (XLS-85) contracts that cannot finish before the due date, so every validated finish is an on-chain cryptographic proof of payment that an audit sweep re-reads from the ledger. Everything about the borrower, and the outstanding balance, stays off-chain in the servicer's PostgreSQL books — the token never replaces the Note, Deed of Trust, lien or county record. The engine is a Python/xrpl-py application with a PostgreSQL system of record, open source under MIT, and its full cycle went live on XRP Ledger Mainnet on September 24, 2026.

The settlement rail is asset-agnostic by construction: MPT issuance, escrow legs, memo format, the single submit path and the audit sweep do not know what kind of debt they are settling. Only the schedule builder is specific to the proven fixture, a 30-year residential fixed-rate note, because it enforces an identical payment every period. Extending to commercial debt — balloons, interest-only periods, rate resets — is a relaxation of that one module, not a rebuild, and it is where we intend to take the product.

## Current customers and sales pipeline

MortgageOS itself is pre-revenue and we state that plainly: no bank has signed a servicing contract yet, and the loan proven on Mainnet is synthetic — a fictitious borrower and property, no real promissory note, and no borrower data of any kind on the ledger. Tokenizing a live consumer note awaits counsel characterization of the note asset (UCC Article 3/9, ESIGN/UETA/MERS, securities analysis), the first milestone of our plan.

Our beachhead customer is deliberately small and local, not the money-center banks. In the United States: small California credit unions and community banks — institutions that hold paper, feel servicing cost acutely, cannot justify a core-platform migration, and have no independent way to evidence that a period's principal, interest and escrow actually settled. In the Philippines: the direct equivalents in Metro Manila — rural banks, thrift banks and cooperatives — which were handed lending capacity when the Bangko Sentral ng Pilipinas cut the reserve requirement from 7% to 5% in 2025 but lack the servicing infrastructure to deploy it. Introductions into either group, and to Asian institutions more broadly, are the single most valuable thing this program could provide us.

On business model, we have made a deliberate choice: we are not trying to own a monopoly servicing platform. The protocol stays open and MIT-licensed, and we want other institutions — including competitors — running it. Three reasons. First, our buyer is a small, conservative, examiner-supervised institution; open, auditable software that its regulator can read is far easier to adopt than a proprietary black box, so openness is an adoption advantage rather than a giveaway. Second, the product is verifiable settlement evidence, and evidence that only we can verify is not evidence — a closed verification layer contradicts the thing being sold. Third, adoption, not extraction, is the bottleneck: a standard that every community lender can run becomes the standard, and that is worth more than a licence fee collected from the few who would pay one.

We capture value by operating inside the network rather than taxing it: HTM's own origination and servicing book in the U.S.–Philippines corridor; servicing-operations contracts where an institution wants our Manila team to run the work under dual control; managed hosting, key management and SLA for institutions that do not want to operate a ledger integration; implementation and integration; the examiner-facing evidence and reconciliation product; and certification under the MortgageOS™ mark, which a fork cannot claim. For XRPL this is the point that matters most: an open, shared protocol puts every adopting institution's book on-chain, not only the loans one company could service itself. Commercial debt is the priority line — larger balances, more structurally varied settlement events, and outside consumer credit, so a materially shorter path to a live non-synthetic loan.

The operating business underneath the product is real. High Tech Mortgage, LLC is a virtual California mortgage brokerage, digital successor to Action Residential Mortgage & Property Management (founded 1994), run end to end online. Its book sits in the scenarios macro-lenders decline: international income, dual-country documentation, Fil-Am and immigrant financing structures, and commercial debt schedules — the same corridor MortgageOS serves. HTM also advises high-net-worth clients on cryptocurrency liquidity and tokenized mortgage structures, which is how the product originated, and it is the licensed operator that would run the first controlled pilot on real, redacted loan files under its own licences.

In the Philippines, GRC's owner holds executive-level relationships with Megaworld, Ayala Land and ArthaLand and their lender-bank groups, and the venture intends to acquire a 40% position in a small provincial bank near Clark International Airport in Pampanga. Those relationships are a route to senior decision-makers, not commitments to adopt.

## Top 3 competitors and competitive advantage

1) Figure Technologies / Provenance — the largest blockchain mortgage effort, but on its own purpose-built chain, tokenizing whole loans and HELOCs for its own marketplace. 2) Liquid Mortgage — on-chain loan-level payment reporting for securitizations, reporting-focused rather than a servicing rail. 3) Incumbent servicing platforms (ICE/Black Knight MSP, Sagent) — the systems of record institutions actually use, with no independent settlement proof at all.

Our advantage is the separation the others do not make. We do not tokenize the legal obligation: the Note, Deed of Trust, lien, county record and the borrower's obligation stay exactly where the law puts them, and only the lender's cash-flow right and the settlement events go on-chain. That keeps the product deployable by a licensed servicer today instead of waiting for a legal regime that does not exist. We are XRPL-native rather than private-chain: MPT and TokenEscrow are ledger primitives, so a payment proof is verifiable by anyone against a public ledger, with no permission from us. And the operator is a licensed California broker with 30+ years of underwriting behind it, not a crypto company approaching mortgage from the outside.

Why now, technically: the primitives only just became usable. MPT (XLS-89d) and TokenEscrow (XLS-85) are enabled on Mainnet, and our full cycle has run there since September 24, 2026; the forward path to Single Asset Vault (XLS-65) and the Lending Protocol (XLS-66) for collateralized financing is on Devnet.

Why now, for XRPL specifically: commercial debt, not residential, is where this generates ledger volume. Commercial paper carries far larger balances, more frequent and more structurally varied settlement events, shorter terms with refinance and balloon events, and it sits adjacent to trade finance and collateral movement — the exact on-chain activity the XRPL ecosystem says it wants to fund. A single commercial servicing relationship produces settlement volume a residential book cannot match, and commercial lending is also outside consumer credit, so it is a materially shorter regulatory path to a live, non-synthetic loan on the ledger. Our licensed operator already writes commercial debt schedules as part of its specialty book, so this is an extension of existing underwriting competence rather than a new market.

## Equity holders breakdown

Applicant legal entity — High Tech Mortgage, LLC (California, United States), stylized HighTechMortgage. Member-managed, so interests are membership interests rather than shares.
• Rich Young, CRS — Founder, Lead Broker and Managing Member — 100% membership interest. No outside members.

MortgageOS is developed under a joint venture between HTM and Global Realtor 4A Cause (GRC). GRC is not a corporation. It is the trade name under which Maria Theresa Wilson (aka Trish Wilson) practises as a sole proprietor; she holds Philippine Real Estate Broker licence PRC 0024025. Philippine real estate brokerage licences are personal to the licensee, which constrains incorporating the practice, so GRC has no equity holders other than:
• Maria Theresa Wilson, Owner and Sole Proprietor — 100%.

The joint venture has issued no equity to anyone. High Tech Mortgage, LLC is the limited-liability entity of record and would be the counterparty to any grant or milestone agreement.

Please read our financial answers in this light. We are an established operating business, not a startup seeking financing, and the standard venture metrics do not map cleanly onto us:

• Revenue generating: answered No. MortgageOS, the venture this application concerns, has earned nothing — it is pre-revenue and pre-pilot. HTM's underlying brokerage has operated since 1994 and does earn, but that income is modest, private, and separate from this venture; we do not publish it and it is not what you are assessing.

• Valuation: entered as 0 because there is none to report, not because the company is worth nothing. HTM has never taken outside capital, so there has been no priced round and no third-party valuation.

• Currently fundraising: No. We are not raising equity and are not seeking venture investment. We are asking for non-dilutive grant funding and, candidly, for institutional introductions — particularly to small California credit unions and community banks, and their counterparts in Metro Manila.

• Runway: the figure entered is a placeholder rather than a disclosure. HTM is self-funded and is not burning investor capital against a deadline, so runway in months is not the applicable measure; the business is not financing-dependent. We are glad to discuss our position directly with your team in confidence.

We would rather state this plainly than submit numbers that imply a company shape we are not.
