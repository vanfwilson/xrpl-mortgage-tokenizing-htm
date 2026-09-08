# Escrow analysis example (12 CFR 1024.17, aggregate method)

Synthetic Idaho FHA loan; every figure is integer cents reconciled by `npm run loan-year`.

## Initial analysis at settlement (R02, R03, R05, R08)

Annual disbursements $4,920.00 (tax $3,420.00 in two halves, hazard $1,500.00). Monthly deposit $410.00. Cushion cap one-sixth = $820.00.

| month | deposit | disbursed | balance |
|---|---|---|---|
| 2026-11 | $410.00 | $0.00 | $410.00 |
| 2026-12 | $410.00 | $1,710.00 | -$890.00 |
| 2027-01 | $410.00 | $0.00 | -$480.00 |
| 2027-02 | $410.00 | $0.00 | -$70.00 |
| 2027-03 | $410.00 | $0.00 | $340.00 |
| 2027-04 | $410.00 | $0.00 | $750.00 |
| 2027-05 | $410.00 | $0.00 | $1,160.00 |
| 2027-06 | $410.00 | $1,710.00 | -$140.00 |
| 2027-07 | $410.00 | $0.00 | $270.00 |
| 2027-08 | $410.00 | $0.00 | $680.00 |
| 2027-09 | $410.00 | $1,500.00 | -$410.00 |
| 2027-10 | $410.00 | $0.00 | $0.00 |

Lowest projected balance -$890.00 in month 2; target starting balance $1,710.00. Opening balance from the Closing Disclosure initial deposit $1,230.50 -> **shortage $479.50** (one month or more). Options under 1024.17(f)(3): do_nothing, equal_monthly_payments. Year 1 election: do nothing; the December bill is covered by a servicer advance under 1024.17(k)(1).

## Servicer advances during the year (R10)

- 2026-12-31: $284.65 advanced for bill-1

## Year-end analysis (R02, R07/R08/R09)

Escrow balance for analysis = tax + hazard − advances outstanding = $1,230.50. Target $1,710.00 -> **shortage $479.50**.

| month | deposit | disbursed | balance |
|---|---|---|---|
| 2027-11 | $410.00 | $0.00 | $410.00 |
| 2027-12 | $410.00 | $1,710.00 | -$890.00 |
| 2028-01 | $410.00 | $0.00 | -$480.00 |
| 2028-02 | $410.00 | $0.00 | -$70.00 |
| 2028-03 | $410.00 | $0.00 | $340.00 |
| 2028-04 | $410.00 | $0.00 | $750.00 |
| 2028-05 | $410.00 | $0.00 | $1,160.00 |
| 2028-06 | $410.00 | $1,710.00 | -$140.00 |
| 2028-07 | $410.00 | $0.00 | $270.00 |
| 2028-08 | $410.00 | $0.00 | $680.00 |
| 2028-09 | $410.00 | $1,500.00 | -$410.00 |
| 2028-10 | $410.00 | $0.00 | $0.00 |

Options: do_nothing, equal_monthly_payments (≥ 12 months). Election: equal monthly payments over 12 months -> year-2 monthly escrow $449.96. Annual statement due 2028-11-30 (R06).

## Surplus case (R07)

Had the opening balance been $1,770.00 (target + $60.00), the analysis would classify a surplus of $60.00; with the borrower current it is refunded within 30 days (12 CFR 1024.17(f)(2)(i)). A $49.99 surplus may be refunded or credited.

## California profile (R23, R30)

Same balances under Cal. Civ. Code 2954.8: 2 % simple interest = $39.77, credited annually; Form 1099-INT required ($10 threshold).
