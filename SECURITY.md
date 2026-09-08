# Security Policy

This repository is a **test-network reference implementation** of a mortgage-servicing layer. It never holds real
funds, real borrower data, or production keys.

- All wallets are created from the public XRPL Testnet (or Devnet) faucet at run time and written to
  `out/wallets.<network>.json` (gitignored). Test XRP and the controlled test USD have no value.
- All loan documents under `data/documents/` are synthetic. Names, addresses, case numbers, parcel numbers and
  recording numbers are fictitious.
- No ledger-bound payload (memo, NFToken URI, Data field) may carry personal data; `src/xrpl/settle.ts` enforces an
  allow-list of six memo keys and `tests/engine/security.test.ts` scans the payload builders.
- Do not point this code at Mainnet. `src/config.ts` refuses a Mainnet URL.

## Reporting

Email security@hightechmortgage.com with a description and reproduction steps. We acknowledge within 5 business days.
Please do not open public issues for vulnerabilities in the on-ledger flow until we have responded.

## Threat model

See [docs/threat-model.md](docs/threat-model.md).
