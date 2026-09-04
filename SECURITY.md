# Security Policy

This repository is a **Devnet reference implementation**. It never holds real
funds, real borrower data, or production keys.

- All wallets are created from the public XRPL Devnet faucet at run time and
  written to `out/wallets.json` (gitignored). Devnet XRP has no value.
- All loan documents under `data/documents/` are synthetic. Names, addresses,
  case numbers, parcel numbers and recording numbers are fictitious.
- Do not point this code at Mainnet. `src/config.ts` refuses a Mainnet URL.

## Reporting

Email security@hightechmortgage.com with a description and reproduction steps.
We acknowledge within 5 business days. Please do not open public issues for
vulnerabilities in the on-ledger flow until we have responded.

## Threat model

See [docs/threat-model.md](docs/threat-model.md).
