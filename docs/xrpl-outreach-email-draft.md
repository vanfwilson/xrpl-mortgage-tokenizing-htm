# Outreach Email — XRPL Grants Committee & RippleX Ecosystem

Two-step sequence. Drafted 2026-09-24, superseding the 2026-09-17 draft.
Pairs with `docs/xrpl-next-steps-2026-09-17.md` (§2, §6).

## Why two emails, not one

The cover letter was signed on 2026-09-17 and says "Version 3.1", "operating on the XRP Ledger
Testnet". It is accurate today. Once the Mainnet demo runs it becomes understated — but revising
it costs a fresh signature round-trip with two busy executives.

So: **send the signed letter now**, and send the Mainnet news later as a plain-text follow-up on
the same thread. The follow-up needs no signature at all, and turns the deployment into a second
legitimate touchpoint on a warm thread rather than a delayed first contact. Applications are
closed until at least October, so this is relationship-opening, not an application.

---

# EMAIL 1 — send now

| Field | Value |
|---|---|
| **From** | `vanw@globalrealtor4acause.com` (matches the signed identity) |
| **To** | `info@xrplgrants.org` |
| **Cc** | `RippleXEcosystem@ripple.com` |
| **Subject** | MortgageOS™ — Live XRPL Institutional Mortgage Servicing & Tokenization (MPT / TokenEscrow), Open Source |
| **Attach 1** | `docs/grant-cover-letter-2026-09-17-signed.pdf` — **the SIGNED file, not the unsigned render beside it** |
| **Attach 2** | `docs/grant-proposal-2026-09-11.pdf` (12 pages) |

Both recipients on one message, Cc not Bcc, so each can see the other was included.

## Body

Dear XRPL Grants Committee and RippleX Ecosystem Team,

We understand there are presently no open calls for applications. We are writing now rather than
waiting, because the project is already built, published and running — and we would value being
on your radar ahead of the new programming announced for October.

High Tech Mortgage, Inc. (HTM), together with Global Realtor 4A Cause (GRC), has open-sourced
**MortgageOS™** — a working institutional mortgage servicing and tokenization layer on the XRP
Ledger, using only amendments already live on Mainnet.

What it does, in three lines:

- **Multi-Purpose Tokens** act as unalterable digital twins of promissory notes.
- **TokenEscrow (XLS-85)** performs deterministic, date-locked monthly cash-flow settlement to
  note holders.
- The asset/settlement rail is fully bifurcated from the legal note layer, holding to RESPA, TILA
  and UCC Articles 3 & 9 — with **zero borrower PII on the public ledger**.

Two links you can verify without talking to us first:

- Source, MIT licensed — https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm
- Live evidence report — https://vanfwilson.github.io/xrpl-mortgage-tokenizing-htm/evidence/v3/

We note the program's stated focus on real-world assets, collateral movement and tokenization.
Mortgage servicing is, we would argue, the hardest honest test of that thesis: high-volume,
heavily regulated, economically meaningful, and the place where tokenized-RWA claims usually stop
at the slide deck. We have taken it to running code.

We also understand that ecosystem funding is moving to a more distributed model in 2026. If the
**FinTech Builder Program** or **XRP Asia** is a better door for a regulated institutional
use-case like this one — we have established operational channels into the ASEAN banking corridor
via Manila — we would welcome being pointed that way.

The team: 30+ years of licensed California mortgage brokerage (DRE #01106294, NMLS #291547),
prior Fannie Mae and SEC data science and AI architecture experience.

Attached are a signed one-page cover letter and a 12-page technical and regulatory specification.

We would welcome a brief 15-minute technical demonstration with the RippleX engineering team, at
your convenience. We are equally glad simply to be pointed at the right intake when the October
programming opens — whichever is more useful to you.

Thank you for your time, and for the work the program does.

Sincerely,
Van Wilson
on behalf of Richard Kent Young, High Tech Mortgage, Inc.
and Maria Theresa Wilson, Global Realtor 4A Cause

---

# EMAIL 2 — send after the Mainnet demo lands

Plain-text reply on the same thread. **No signature required** — it is an update, not a
submission. Do not redraft the letter and do not ask for new signatures.

**Subject:** Re: MortgageOS™ — now live on XRPL Mainnet

Following up on the below — MortgageOS is now running on **XRPL Mainnet**, not only Testnet.

We deployed a single demonstration loan end to end: the note issued as an MPT, the holder
authorized, and a full principal-and-interest period settled through TokenEscrow, all on Mainnet
using amendments already enabled there.

- Note token on the ledger: `<livenet.xrpl.org MPT issuance link>`
- Mainnet evidence report: `<v4 evidence report link>`

To be explicit: the demonstration loan is synthetic — a fictitious borrower and property, no real
promissory note and no borrower data on the ledger. Tokenizing a live consumer note is a
securities and licensing question we are deliberately taking to counsel before, not after.

We thought you would want to see it working on the live network.

## Before sending Email 2

- [ ] Mainnet run complete, evidence report published
- [ ] Both links resolve (HTTP 200) — check, do not assume
- [ ] MPT renders on livenet.xrpl.org (XLS-89d metadata validates clean as of v4)

---

## Notes on the drafting

- **Leads by acknowledging the closed window.** Pretending not to know reads as a mass mailing.
  Naming it, and naming the October announcement, shows the homework and gives them a low-cost
  way to respond.
- **Puts the two verifiable links high.** A reviewer's first question is "does it exist." Running
  code answers it before any claim has to be taken on trust.
- **Names FinTech Builder Program and XRP Asia.** Their intake URLs were not publicly findable as
  of 2026-09-24, so asking which door to use is a genuine question, not flattery — and it shows
  we read their 2026 restructuring rather than asking them to explain it.
- **Offers two exits, one cheap.** Asking only for a demo makes "no" the easy answer. Adding "or
  just point us at the right intake" makes a useful reply nearly free.
- **Claims only what is true today.** Email 1 says nothing about Mainnet. That is Email 2's job.
