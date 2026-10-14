# HTM servicing platform — to-do list (gaps not covered by Privy or the current software)

> **Informational copy.** Canonical: [`hightechmortgage-site/docs/servicing-todo.md`](https://github.com/vanfwilson/hightechmortgage-site/blob/main/docs/servicing-todo.md). Update there, then re-copy.


*Compiled 2026-10-14. "Current software" = this site (WordPress login, face check, Worker,
`htm_mortgages` schema) plus `xrpl-mortgage-tokenizing-htm` v3.1 (`mortgageos`: note token, fixed-P&I
escrow settlement, impounds, audit, on the XRP Ledger **Testnet**). Context:
[servicing-platform-architecture.md](htm-servicing-platform-architecture.md). Canonical copy lives in
`hightechmortgage-site/docs/`; an informational copy is in `xrpl-mortgage-tokenizing-htm/docs/`.*

Priority: **P0** = needed before the first live loan · **P1** = needed for the HTM niche · **P2** = later.
Status: ☐ open · ◐ started · ☑ done.

## A. Payment methods HTM must provide itself (Privy does not)

| # | Item | Dir | P | Status |
|---|---|---|---|---|
| A1 | XRP and RLUSD payments on the XRP Ledger (HTM-built; Privy only signs) | in/out | P0 | ◐ engine exists on Testnet |
| A2 | Other XRP Ledger issued currencies (other countries' stablecoins) via trust lines; issuer vetting | in/out | P1 | ☐ |
| A3 | Stablecoins outside Privy's well-known set (custom ERC-20/SPL) — conversion/cash-out provider | out | P2 | ☐ |
| A4 | Bitcoin (build/broadcast or provider: BitGo, Coinbase, BTCPay Server) | in/out | P2 | ☐ |
| A5 | Mailed paper checks (Lob, Checkbook.io or servicer's bank bill-pay) | out | P1 | ☐ |
| A6 | GCash / PHP (PayMongo, Xendit, Coins.ph) | in/out | P1 | ☐ |
| A7 | Local-currency bank payouts beyond US/SEPA/SWIFT — PHP, JPY, … (Wise Business API, local providers) | out | P1 | ☐ |
| A8 | PayPal checkout and PayPal Payouts | in/out | P2 | ☐ |
| A9 | Apple Pay / card checkout (Stripe, Adyen) — pay-in only | in | P1 | ☐ |
| A10 | **Payee registry** with a preferred payout method per payee, and a router that sends each payment leg to the right channel | out | P0 | ☐ |
| A11 | Confirm with Privy/Bridge: payout corridors (US, EU, CH, PH), SWIFT currencies, whether private individuals can be paid out, KYB for HTM | — | P0 | ☐ |

## B. Loan types and servicing logic beyond v3.1

| # | Item | P | Status |
|---|---|---|---|
| B1 | Configurable amortisation engine: commercial, interest-only, balloon, ARM / variable rate, seller carryback, private and custom ("abnormal") loans the client defines and approves (v3.1 = 30-year fixed residential only) | P1 | ☐ |
| B2 | Multi-currency loans and accounting (PHP, JPY, CHF…), FX source and rounding rules | P1 | ☐ |
| B3 | Partial payments, prepayments, late fees, grace periods, delinquency and default handling | P0 | ☐ |
| B4 | Payoff quotes and payoff processing → reconveyance / satisfaction recorded in the loan file | P0 | ☐ |
| B5 | Port v2 → v3: aggregate escrow analysis with cushion, statements, servicing transfers, notices of error, loss mitigation, Form 1098 (control map R01–R31) | P0 | ☐ archived on `main` |
| B6 | Non-US tax documents equivalent to 1098 / 1099-INT (Philippines, Switzerland) | P2 | ☐ |
| B7 | Live tax-bill source per county/jurisdiction; IPFS pinning of the terms manifest | P1 | ☐ |
| B8 | **Reconcile the two schemas**: `mortgageos` (ledger repo) and `htm_mortgages` (site) — one system of record | P0 | ☐ |

## C. Ledger, wallets and custody

| # | Item | P | Status |
|---|---|---|---|
| C1 | Production settlement instrument (RLUSD issuers do not allow trust-line locking; runs use a test USD) — decide the asset for escrows | P0 | ☐ |
| C2 | Mainnet go-live: key management for issuer / impound / servicer keys (HSM or KMS), Mainnet guard removal, runbooks | P0 | ☐ |
| C3 | **Lender-owned escrow accounts HTM can only read**: create, hand to the lender's key, disable master key, 2-of-3 signer list, per-bill `EscrowCreate` with fixed destination (key drill exists in WALKTHROUGH step 12) | P0 | ☐ |
| C4 | Privy payment signing: HTM token → user session key (HPKE decrypt), authorization signatures, XRPL `xrpl_signTransaction` | P0 | ☐ |
| C5 | Per-loan Privy policies: allowlisted destinations, amount caps, Payment-only | P0 | ☐ |
| C6 | Borrower Privy wallet created on first payment (route built, borrower-only, face-gated) | P0 | ◐ |
| C7 | Funding paths for borrowers into their wallet (Privy deposits: bank transfer / crypto) | P1 | ☐ |

## D. Portal, reports and staff tools

| # | Item | P | Status |
|---|---|---|---|
| D1 | HTM servicing API (container on the CouncilForge server, own Cloudflare Tunnel + Access, `htm_servicing` login, row-level security) | P0 | ☑ live 2026-10-14 |
| D2 | "My Loans": role-scoped reports for borrower, lender/note holder, realtor, creditor, PITI tax, PITI insurance, payer | P0 | ◐ `/my-loans/` live; needs real loans + owner face check |
| D3 | **Make a payment** button and flow (borrowers, and authorised payers) | P0 | ◐ button shown, disabled until payment rails exist |
| D4 | Active-liens-only property view for lenders/creditors; transfer notice on every party's report | P1 | ☐ |
| D5 | Members submit loans for servicing (`loan_servicing_requests`) + staff review / accept / decline / create loan | P0 | ◐ member submit live; staff review to do |
| D6 | Staff tools: link parties, record transfers, void with reason, payer arrangements, document upload | P0 | ☐ |
| D7 | Cloudflare Access with biometrics for staff and wp-admin | P1 | ☐ |
| D8 | Notifications: payment receipts, statements, RESPA transfer notices (timing from the engine), escrow analysis | P0 | ☐ |
| D9 | Statement and report PDFs; OCR document ingest (v2 archived) | P1 | ☐ |
| D10 | Profile self-service role checkboxes (GRC-style), newsletter opt-in with double opt-in and consent fix in FluentCRM | P1 | ☐ |
| D11 | Role explanation pages (`/roles/…`) and Apply flow split (borrower loan vs lender/realtor servicing) | P1 | ☐ |

## E. Security, audit and privacy

| # | Item | P | Status |
|---|---|---|---|
| E1 | Owner's first real face check (confirms the head-turn direction setting) | P0 | ☐ |
| E2 | Face snapshot per verification to private R2 (`htm-facial-vault`), consent text and retention updated first | P1 | ☐ |
| E3 | Click / key-category interaction tracker on servicing pages → `htm_servicing_audit_log` | P1 | ☑ on `/my-loans/` |
| E4 | Face-template retention job (delete after 3 years unused, as the consent text says) | P1 | ☐ |
| E5 | Passkey end-to-end test on a real device (virtual-authenticator test stalled) | P1 | ☐ |
| E6 | Cloudflare WAF / rate-limit rules for `/api/*` (current API token cannot edit WAF) | P1 | ☐ |
| E7 | Backups and restore test for `htm_mortgages`; monitoring and alerts for the API, face engine and Worker | P0 | ☐ |

## F. Legal and business (counsel, not code)

| # | Item | P | Status |
|---|---|---|---|
| F1 | Servicer licensing per state/country served (CA DFPI/DRE carve-outs, Idaho; Philippines) | P0 | ☐ |
| F2 | Custody / money transmission for HTM-held escrow vs lender-owned escrow accounts | P0 | ☐ |
| F3 | Note token: UCC Art. 3/9, eNote (ESIGN/UETA, MERS), securities question | P0 | ☐ |
| F4 | Bank's written acceptance of ledger proofs as books and records | P0 | ☐ |
| F5 | Biometric privacy consent and retention (BIPA, Texas, Washington, CPRA; Philippine Data Privacy Act) | P0 | ☐ |
| F6 | Contracts: servicing agreement, technology-provider / sub-servicer role, client acceptance testing, indemnities | P1 | ☐ |
