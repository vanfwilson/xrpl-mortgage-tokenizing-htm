# Standards mapping

How each XRPL standard is used, the exact transaction fields we set, and why.

## XLS-33 Multi-Purpose Tokens (amendment `MPTokensV1`)

`MPTokenIssuanceCreate` (src/steps/02-mpt.ts)

| Field | Value | Why |
|---|---|---|
| `AssetScale` | 2 | units are USD cents |
| `MaximumAmount` | `"45000000"` | original principal, $450,000.00 |
| `TransferFee` | 0 | no secondary-sale fee |
| `Flags` | `tfMPTRequireAuth \| tfMPTCanLock \| tfMPTCanClawback \| tfMPTCanEscrow \| tfMPTCanTransfer` | allow-listed holders; servicer freeze; error/court correction; XLS-85 escrow of participations; transferable among authorised holders |
| `MPTokenMetadata` | XLS-89 JSON, 775 bytes | see below |

Not set: `tfMPTCanTrade` (no DEX listing of a private-credit interest), `DomainID` on the issuance
(we authorise holders explicitly with `MPTokenAuthorize` + `Holder` so the demo is deterministic; a
domain-gated issuance is the production path).

Holder flow: holder `MPTokenAuthorize` (opt-in, creates the `MPToken` object) → issuer
`MPTokenAuthorize` with `Holder` (allow-list) → issuer `Payment` with `{ mpt_issuance_id, value }`.
`mpt_issuance_id` is read from `meta.mpt_issuance_id` of the create transaction.

## XLS-89 MPT metadata schema

Short keys, `ac: "rwa"`, `as: "private_credit"` (a mortgage participation is private credit secured by
real estate; `real_estate` is reserved for equity-like property interests). `ai` carries loan id,
note amount, rate, term, maturity, lien position, state, and `docs_sha256`, the bundle hash from
`src/domain/hash.ts`. Encoder enforces the 1024-byte limit (src/domain/metadata.ts).

## XLS-70 Credentials and XLS-80 Permissioned Domains

`CredentialCreate` by the KYC issuer (`CredentialType` = hex `HTM_ACCREDITED_KYC_2026`), `CredentialAccept`
by each investor, then `PermissionedDomainSet` on the issuer account accepting that credential. The
resulting `DomainID` gates the vault (`tfVaultPrivate` + `DomainID`).

## XLS-65 Single Asset Vault (amendment `SingleAssetVault`)

`VaultCreate`: `Asset: { currency: "XRP" }` (Devnet stand-in for RLUSD), `Flags: tfVaultPrivate`,
`DomainID`, `WithdrawalPolicy: vaultStrategyFirstComeFirstServe`, `AssetsMaximum: "0"` (uncapped),
`Data` = hex JSON `{ n, w }`. `VaultID` is the `CreatedNode` of type `Vault`; `ShareMPTID` from the
ledger entry is the vault's share token (itself an MPT). Depositors `VaultDeposit` XRP drops.

## XLS-66 Lending Protocol (amendment `LendingProtocol`)

`LoanBrokerSet`: `VaultID`, `ManagementFeeRate: 100` (0.10 %), `CoverRateMinimum: 10000` (10 %),
`CoverRateLiquidation: 5000` (50 % of the minimum per default), `DebtMaximum: "0"`.
`LoanBrokerCoverDeposit`: first-loss capital in the vault asset.

`LoanSet` is **two-party**: the broker signs as `Account` with `Counterparty` = HTM Warehouse, then
the counterparty countersigns with `signLoanSetByCounterparty` (xrpl.js ≥ 5.1). Fields:
`PrincipalRequested` in drops, `InterestRate: 6250` (6.25 % in 1/10 bp), `LateInterestRate: 5000`,
`PaymentTotal: 12`, `PaymentInterval: 60`, `GracePeriod: 60`, fees in drops, `Flags: tfLoanOverpayment`.
`LoanID` is the `CreatedNode` of type `Loan`; `PeriodicPayment` and `NextPaymentDueDate` come from the entry.

`LoanPay`: `Amount` = `PeriodicPayment + LoanServiceFee`, memo type `htm/servicing` with the PITI split.
`LoanManage`: `tfLoanImpair` / `tfLoanUnimpair` (early-warning), `tfLoanDefault` after grace
(consumes first-loss cover), then `LoanDelete`.

## Native escrow (amendment `TokenEscrow` also enabled for MPT escrow)

`EscrowCreate` from buyer to title for cash to close with `FinishAfter`; `EscrowFinish` by title.
In production the release condition is "deed recorded", which is a crypto-condition or an
authorised-signer flow, not a timer.

## Not used, and why

- **NFTokenMint** for the note: an NFT cannot carry a balance, cannot be allow-listed per holder,
  and cannot be held by a vault. The note is one MPT issuance whose supply *is* the principal.
- **Trust-line IOUs**: no per-holder authorisation without `RequireAuth` on the whole account, no
  clawback granularity, ~5× the reserve footprint of MPT.
- **Hooks / smart contracts**: not on Devnet's amendment set; the native primitives above cover the flow.
