# Cost model: what one loan-year costs on the XRP Ledger

Computed by `src/servicing/cost-model.ts` (tests `T14_*`). The XRP price is an input, never fetched, so every number here can be reproduced with:

```bash
npx tsx -e "import { loanYearCost, PRODUCTION_FOOTPRINT } from './src/servicing/cost-model.ts'; console.log(loanYearCost({ ...PRODUCTION_FOOTPRINT, xrp_usd: 2 }))"
```

## Two kinds of cost

- **Transaction fees** are burned, once per validated transaction. The reference fee is 10 drops (0.00001 XRP); rippled raises it under load, so the model takes the fee as an input.
- **Owner reserves** are parked, not spent: 0.2 XRP per ledger object an account owns (trust line, escrow, NFToken page, signer list) and returned when the object is removed. The model reports the peak reserve as capital carried for the year.

## Per loan-year

Six settlement legs a month (receipt, P&I, tax, hazard, MIP, MIP remittance), two boarding deposits, two impound bills through TokenEscrow (create + finish each), one loan-record NFToken.

The **fixture** footprint funds one wallet per role for a single loan, so it holds 11 trust lines. In **production** the role accounts (servicer, impound accounts, MIP payable, HUD, payees) are shared across the book and the per-loan objects are one borrower trust line, one NFToken and the escrows in flight.

| Footprint | Transactions | Fees (drops) | Peak reserve (XRP) |
|---|---|---|---|
| Fixture (Testnet run) | 86 | 860 | 2.8 |
| Production (shared role accounts) | 81 | 810 | 0.8 |

Dollars, production footprint, at three stated XRP prices:

| XRP price | Fees per loan-year | Reserve parked | All-in per loan-month |
|---|---|---|---|
| $0.50 | $0.0004 | $0.40 | $0.03 |
| $2.00 | $0.0016 | $1.60 | $0.13 |
| $5.00 | $0.0041 | $4.00 | $0.33 |

The fee cost is negligible at any plausible price. The only material line is the reserve, and it is returned when the loan pays off and its objects are removed. Even treating the reserve as an expense, the all-in stays under the $0.50 per loan-month floor of the stated price band at $5 per XRP.

## Scale

`scaleNote(loans, per_ledger)` assumes one ledger close every 4 seconds and `per_ledger` independent-account submissions per close (50 by default; the servicer, impound and payee accounts each carry their own sequence so legs across loans do not serialise on one account).

| Loans | Transactions per month | Serial hours | Batched hours (50 per ledger) | Peak reserve (XRP, production) | Fees per month (XRP) |
|---|---|---|---|---|---|
| 1,000 | 6,333 | 7.0 | 0.14 | 800 | 0.06 |
| 10,000 | 63,333 | 70.4 | 1.4 | 8,000 | 0.63 |
| 100,000 | 633,333 | 703.7 | 14.1 | 80,000 | 6.33 |

Reading the table: a 10,000-loan book settles its monthly legs in under two hours of ledger time when submissions are spread across accounts, and parks 8,000 XRP of reserves. The serial column is the wrong design and is shown only to make the point.

## What this does not include

- Bank, servicing and custodial fees, which do not change with the ledger.
- The cost of a production settlement asset. The Testnet runs use a controlled test USD because RLUSD issuers do not allow trust-line locking; a production instrument is an open business item (roast RS7).
- Node or API costs. The runs use public Testnet endpoints; production would use a paid or self-hosted rippled.

## Pricing statement

Position the software as an evidence and settlement add-on at $0.50 to $1.50 per loan per month on top of the servicing fee, not as a replacement for a servicing system. At that price the ledger cost is under a tenth of revenue in the worst case in the table above.
