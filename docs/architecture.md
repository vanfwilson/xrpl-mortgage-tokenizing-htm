# Architecture

```mermaid
sequenceDiagram
  autonumber
  participant Docs as 4 closing documents (paper/PDF)
  participant Ingest as src/ingest + src/scan
  participant DB as Postgres htm_mortgages
  participant KYC as KYC issuer
  participant Desk as HTM Lending Desk (broker)
  participant Cap as HTM Capital Markets (issuer)
  participant Inv as Investors A/B
  participant SV as HTM Loan Servicing (borrower)
  participant HO as Homeowner
  participant L as XRPL Devnet

  Docs->>Ingest: scan -> OCR -> normalise -> extract
  Ingest->>DB: canonical loan + document hashes (tie-outs must pass)
  KYC->>L: CredentialCreate (A, B); Inv->>L: CredentialAccept
  Desk->>L: PermissionedDomainSet -> DomainID
  Cap->>L: MPTokenIssuanceCreate(HTMN1, XLS-89 meta w/ docs sha256); MPTokenAuthorize; Payment 60/40
  Desk->>L: VaultCreate(private, DomainID); Inv->>L: VaultDeposit
  Desk->>L: LoanBrokerSet + CoverDeposit; Desk->>SV: LoanSet (two-party) -> LoanID
  loop every month (60 s on Devnet)
    HO->>SV: Payment sweep $3,368.23
    SV->>L: LoanPay (P&I leg) ; Payment -> Tax Impound ; Payment -> Insurance Impound
  end
  L->>L: EscrowCreate impound -> County Treasurer (FinishAfter Dec 20 / Jun 20)
  L->>L: EscrowCreate impound -> Carrier (FinishAfter renewal)
  L-->>DB: db:record mirrors objects + tx hashes
```

## Accounts and reserves

Eleven Devnet accounts, one per role, funded from the faucet (100 XRP each). Objects and their owners:

| Object | Owner | Reserve |
|---|---|---|
| Credential ×2 | investors (subject) after accept | 1 each |
| PermissionedDomain | broker | 1 |
| MPTokenIssuance | issuer | 1 |
| MPToken ×2 | investors | 1 each |
| Vault (+ pseudo-account, share MPT issuance) | broker | 1 |
| LoanBroker (+ pseudo-account) | broker | 1 |
| Loan | borrower | 1 |
| Escrow ×2 (impound disbursements) | tax / insurance impound accounts | 1 each |

## Failure handling

Critical steps (credentials, MPT, vault, broker, LoanSet) fail the run. Servicing sweeps and impound escrows
are "soft": a failure is recorded in the report's Notes and the run continues, so a reviewer always
gets a complete report. Credentials are idempotent on reused wallets.

## Devnet vs production

| Concern | Devnet demo | Production |
|---|---|---|
| Vault asset | XRP, 1 XRP = $10,000 | RLUSD or bank stablecoin |
| Loan schedule | 360 × 60 s | 360 × 30 days |
| Keys | single faucet key per role | multisig + HSM, `lsfDisableMaster` |
| Holder gating | explicit `MPTokenAuthorize(Holder)` | `DomainID` on the issuance + credential expiry |
| Impound release | time-lock to statutory date | same, plus payee-confirmed `EscrowFinish` and escrow analysis |
| Document source | JSON fixtures | eVault eNote hash + custodian credential |
