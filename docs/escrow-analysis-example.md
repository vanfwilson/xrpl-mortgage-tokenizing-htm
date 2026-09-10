# Aggregate escrow examples

Generated from the deterministic replay. Base monthly deposit is annual disbursements / 12; recovery is a separate election. Target balances use the zero-opening trial minimum plus the allowed cushion. Source: [12 CFR 1024.17](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/), accessed 2026-09-09. Amounts below are integer USD cents.

## analysis_surplus

Annual disbursements 713136; base monthly deposit 59428; cushion 118856; target opening 207856; surplus 92144; allowed options: refund_30_days.

| Month | Deposit | Disbursement | Target closing balance |
|---|---:|---:|---:|
| 1 | 59428 | 18428 | 248856 |
| 2 | 59428 | 189428 | 118856 |
| 3 | 59428 | 18428 | 159856 |
| 4 | 59428 | 18428 | 200856 |
| 5 | 59428 | 18428 | 241856 |
| 6 | 59428 | 18428 | 282856 |
| 7 | 59428 | 18428 | 323856 |
| 8 | 59428 | 189428 | 193856 |
| 9 | 59428 | 18428 | 234856 |
| 10 | 59428 | 18428 | 275856 |
| 11 | 59428 | 168428 | 166856 |
| 12 | 59428 | 18428 | 207856 |

## analysis_shortage

Annual disbursements 713136; base monthly deposit 59428; cushion 118856; target opening 207856; shortage 206856; allowed options: do_nothing, collect_12_or_more.

| Month | Deposit | Disbursement | Target closing balance |
|---|---:|---:|---:|
| 1 | 59428 | 18428 | 248856 |
| 2 | 59428 | 189428 | 118856 |
| 3 | 59428 | 18428 | 159856 |
| 4 | 59428 | 18428 | 200856 |
| 5 | 59428 | 18428 | 241856 |
| 6 | 59428 | 18428 | 282856 |
| 7 | 59428 | 18428 | 323856 |
| 8 | 59428 | 189428 | 193856 |
| 9 | 59428 | 18428 | 234856 |
| 10 | 59428 | 18428 | 275856 |
| 11 | 59428 | 168428 | 166856 |
| 12 | 59428 | 18428 | 207856 |
