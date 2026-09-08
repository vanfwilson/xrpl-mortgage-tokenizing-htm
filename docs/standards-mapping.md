# XRPL primitives used, the exact fields we set, and why

Every transaction type below is enabled on Mainnet (feature RPC checked 2026-09-08). Nothing here depends on a Devnet-only
amendment. For the rejected routes see [appendix-deferred-amendments.md](appendix-deferred-amendments.md).

## Settlement asset: controlled test USD (S5)

`AccountSet` on the issuer, in this order and before any trust line exists (src/xrpl/issuer.ts):

| Field | Value | Why |
|---|---|---|
| `SetFlag` | `asfAllowTrustLineLocking` (17) | required for TokenEscrow of an issued currency; RLUSD's issuers have it off on Mainnet and Testnet, so RLUSD is never used |
| `SetFlag` | `asfDefaultRipple` (8) | lets holders pay each other in the issued USD |

Runtime preflight: `account_info` → `account_flags.allowTrustLineLocking` must be `true` or `createImpoundEscrow` refuses.
`TrustSet` from every servicing account: `LimitAmount { currency: "USD", issuer, value: "100000000" }`.

## Settlement legs: `Payment` (src/xrpl/settle.ts)

| Field | Value | Why |
|---|---|---|
| `Amount` | `{ currency: "USD", issuer, value: "<cents/100 to 2 dp>" }` | exact cents; never XRP for servicing money |
| `Memos[0].MemoType` | hex `htm/servicing` | one memo type for every leg |
| `Memos[0].MemoData` | hex JSON `{"v":1,"loan":"<opaque>","period":"YYYY-MM","leg":"tax","cents":28500,"run":"<id>"}` | six allow-listed keys, ≤ 256 bytes, PII guard at build time |

Legs per month: `receipt` (homeowner → servicer), `pi` (servicer → note holder), `tax`, `hazard`, `mip` (servicer → payables),
`mip_remit` (MIP payable → HUD); plus `initial_deposit` at boarding and `advance` when a bill is short. Each leg carries one
idempotency key; a replay returns the first hash. Batch is not Mainnet-live, so legs are independent, never "atomic".

## Loan record: XLS-20 NFToken (src/xrpl/record.ts)

| Transaction | Fields | Why |
|---|---|---|
| `NFTokenMint` | `NFTokenTaxon 0`, `Flags tfTransferable`, `URI` = hex JSON `{"v":1,"loan":"<opaque>","sha256":"<bundle>","ptr":"cas://…"}` (≤ 256 bytes) | one non-economic handle per loan; no `Amount`, no `Destination` |
| `NFTokenCreateOffer` | `Amount "0"`, `Flags tfSellNFToken`, `Destination` = successor servicer | hand-off on a servicing transfer |
| `NFTokenAcceptOffer` | `NFTokenSellOffer` = offer id | successor accepts |

An MPT with supply 1 would also work but its metadata is immutable without DynamicMPT and "supply" implies units of
something. No token carries principal units or cash-flow rights.

## Impound date lock: TokenEscrow (src/xrpl/escrow.ts)

| Transaction | Fields | Why |
|---|---|---|
| `EscrowCreate` | `Account` = impound sub-account, `Destination` = allow-listed payee, `Amount` = issued USD for the full verified bill, `FinishAfter` = statutory date (17:00 UTC), `CancelAfter` = due + 45 days, `Memos` as above | cannot be finished before the date (proof T10); bounded recovery |
| `EscrowFinish` | `Owner`, `OfferSequence` = the EscrowCreate sequence | anyone may finish after `FinishAfter`; the servicer's automation does |
| `EscrowCancel` | `Owner`, `OfferSequence` | after `CancelAfter` if the payee never took delivery or the bill was corrected downward |

Policy: never more than three near-term objects in flight; 0.2 XRP owner reserve each; never 360 pre-created escrows.

## Key management (src/xrpl/keys.ts)

`SetRegularKey` → proof transaction signed by the regular key → `AccountSet asfDisableMaster` → proof that the master key is
refused. `SignerListSet` with `SignerQuorum 2` across three bank roles for production accounts.

## Not used, and why

- **XLS-65 / XLS-66**: funding protocols for new loans; not on Mainnet; cannot represent an already-funded loan.
- **Credentials / Permissioned Domains**: live on Mainnet, but there is no third-party depositor to gate.
- **Batch, DynamicMPT, Smart Escrows, EVM sidechain, Hooks**: see the appendix.
