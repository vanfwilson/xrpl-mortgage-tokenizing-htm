> **Status: UNSIGNED — deliberately.** This briefing replaces the signed letter of September 17,
> 2026, which described the system as running on Testnet and cited figures that predated the
> Mainnet deployment. It is issued unsigned because no formal application is open. When XRPL
> Grants reopens and there is a real application to make, this will be redrafted and signed by
> Richard Kent Young and Maria Theresa Wilson. Pairs with
> `docs/grant-proposal-2026-09-11.pdf` (13 pages, corrected September 24, 2026).

# Project Briefing: MortgageOS™ — Live Institutional Mortgage Servicing on XRPL Mainnet

**Date:** September 24, 2026

To the XRPL Grants Committee and Ripple Ecosystem Leadership,

This briefing supersedes our letter of September 17, 2026. That letter described MortgageOS™ as running on Testnet; the system has since been deployed to **XRP Ledger Mainnet**, and the figures it quoted have been corrected to match the deployed loan. We are issuing this one unsigned because there is presently no open call for applications — when a formal application is open, we will submit a signed letter with it.

High Tech Mortgage, Inc. (HTM), with Global Realtor 4A Cause (GRC), has built and open-sourced MortgageOS™, a servicing and tokenization layer for institutional mortgage lending. On September 24, 2026 a complete servicing cycle for one loan was executed on Mainnet using only amendments enabled there.

**Live on Mainnet and independently verifiable:**

- Note asset (MPT issuance): `0663EACAC1E295FCE4BA9E9ECD5EC0E84C5089AEE6B00E65`
- Issuance transaction: `217A9632ED44DCCE273C1102446D137E709D81859620E3BBCC0A5C6BD642DFFC`

Both settlement legs — principal and interest, and the tax and insurance impound — finished with `tesSUCCESS`; their transaction hashes are in Section 5 of the attached specification.

The demonstration loan is synthetic: a fictitious borrower and property, no real promissory note, and no borrower data of any kind on the ledger. Tokenizing a live consumer note is a securities and licensing question we are taking to counsel first.

Multi-Purpose Tokens act as unalterable digital twins of promissory notes, their XLS-89d metadata carrying the fixed terms; TokenEscrow (XLS-85) performs deterministic, date-locked monthly settlement. The asset and settlement rail is fully bifurcated from the legal note layer, holding to RESPA, TILA and UCC Articles 3 and 9, with zero borrower PII on the ledger. Behind it: more than thirty years of licensed California mortgage brokerage (DRE #01106294, NMLS #291547), prior Fannie Mae mortgage-forbearance modelling and federal financial-regulatory AI work, and established operational channels across the ASEAN banking corridor via Manila.

- Open-Source Repository (MIT): https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm
- Evidence Report: https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/evidence/v3/

We invite the committee to review the attached 13-page specification, and would welcome a brief 15-minute technical demonstration with the RippleX engineering team — or simply to be pointed toward the right intake when the October programming opens.

**Please direct all correspondence to vanw@globalrealtor4acause.com**, the project contact for the HTM–GRC joint venture. Our earlier message reached you from a personal address; this is the account we monitor for this project.

Sincerely,

<p class="sig"><b>Richard Kent Young</b><br>Founder &amp; President | High Tech Mortgage, Inc.<br>California DRE #01106294 | NMLS #291547<br>hightechmortgage.com</p>

<p class="sig"><b>Maria Theresa Wilson</b> (aka Trish Wilson)<br>Owner | Global Realtor 4A Cause<br>globalrealtor4acause.com</p>

<p class="sig"><i>Issued unsigned. A signed original will accompany a formal application when XRPL Grants reopens.</i></p>
