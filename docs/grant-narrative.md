# Grant narrative: Brinc × XRPL Hong Kong Financial Innovation Program

Working answers for the HFIP application, kept next to the code so the claims and the repo never drift.

## One paragraph

High Tech Mortgage, Inc. (HTM) is a licensed US mortgage lender with an operations office in Manila.
We are building MortgageOS™, a digital-twin platform for the mortgage lifecycle, and this repository
is its XRPL settlement layer prototype. It takes a real closing package format (Fannie Mae 1003, TRID
Closing Disclosure, ALTA settlement statement, FHA clause, recorded Deed of Trust), normalises it into
a canonical loan record that must tie out to the cent, and then exercises every XRPL primitive needed
to fund, tokenize and service that loan: permissioned MPT participations (XLS-33/89), credential-gated
domains (XLS-70/80), a private Single Asset Vault (XLS-65), the Lending Protocol with first-loss
cover and two-party origination (XLS-66), and native escrow for closing funds. It runs on Devnet today.

## Track fit

- **Tokenization & Capital Markets.** The participation MPT is the security-like layer; the vault is the
  capital-formation layer. Both are permissioned by construction.
- **Credit & Lending.** We use XLS-66 the way it was designed: uncollateralised on-ledger credit to an
  underwritten borrower (HTM's warehouse), with the real collateral (recorded lien) held off-ledger and
  bound by document hash. We do not pretend the homeowner is a DeFi borrower.
- **Institutional DeFi.** Everything is domain-gated; nothing lists on the DEX.

## Why Hong Kong

US agency-eligible residential mortgages are a US$13 trillion asset class with a 30-year track record,
and Asian institutional and family-office capital has almost no direct, programmable access to it.
Hong Kong is where that capital sits, and where the SFC's tokenised-securities framework and the HKMA's
Project Ensemble are building the rails for exactly this kind of RWA. HTM's Manila operations centre
means the servicing and document workforce is already in the region and in Hong Kong's time zone.
The MPT participation structure maps naturally onto a professional-investor offering under the SFC regime
(a legal question we would work through during the programme with local counsel).

## What is already true

- Devnet run with every transaction type above at `tesSUCCESS`: see [devnet-run.md](devnet-run.md).
- Canonical loan schema with cross-document validation; OCR repair for degraded scans.
- XLS-89 metadata that fits 1024 bytes and binds the token to the document bundle.
- Offline test suite and CI; live amendment check for the target network.

## What is not yet true (and we say so)

- No legal wrapper. The participation agreement, SPV or trust that gives token holders a claim on the
  note does not exist yet.
- No real documents. Everything is synthetic; production ingest would hash an eVault eNote, not a scan.
- No independent oracle for the servicing stream. Today the servicer's LoanPay *is* the report.
- XLS-65/66 are on Devnet and in Mainnet validator voting; our Mainnet timeline is gated on activation.

## 12-week milestone plan

| Weeks | Milestone | Evidence |
|---|---|---|
| 1–2 | Legal structure memo (US participation + HK PI offering), data-privacy design for memos and metadata | memo in `docs/`, counsel engaged |
| 3–4 | Replace synthetic ingest with eVault/eNote hash flow on a test eNote; MISMO 3.4 mapping of the canonical schema | `src/ingest/mismo.ts`, fixtures |
| 5–6 | Servicing oracle: trustee co-signature on `LoanPay` (multisig `SignerList`), investor report generator from ledger history | `src/oracle/`, sample report |
| 7–8 | Vault in RLUSD on Testnet/Mainnet-candidate; issuer/broker accounts on multisig + HSM; `DomainID` on the MPT issuance | Testnet run log |
| 9–10 | Pilot design with one HK professional investor and one US title/escrow partner; dashboard in MortgageOS (admin.hightechmortgage) reading ledger state | LOIs, dashboard screenshots |
| 11–12 | Security review (threat-model items 1, 4, 5), Demo Day deck, Mainnet go/no-go criteria | audit notes, deck |

## Team

- Van Wilson, founder, HTM. Mortgage operations, real estate, and the MortgageOS platform.
- Rich Young, CA DRE #01106294 / NMLS #291547. 30+ years originating and servicing US mortgages.
- Manila operations team (document processing, servicing support).
- Engineering: this repository and the MortgageOS admin platform on Cloudflare Workers + Postgres.

## Ask

Non-dilutive milestone funding to complete weeks 1–12 above, plus introductions to HK professional
investors and Ripple's RLUSD / institutional DeFi team for the vault asset.
