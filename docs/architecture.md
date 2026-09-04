# Architecture

```mermaid
sequenceDiagram
  autonumber
  participant Docs as Closing package (paper/PDF)
  participant Ingest as src/ingest
  participant KYC as KYC issuer
  participant Desk as HTM Lending Desk (broker)
  participant Cap as HTM Capital Markets (issuer)
  participant Inv as Investors A/B
  participant WH as HTM Warehouse (borrower)
  participant L as XRPL Devnet

  Docs->>Ingest: OCR text
  Ingest->>Ingest: normalise, extract, build canonical JSON, validate tie-outs, sha256 bundle
  KYC->>L: CredentialCreate (A, B)
  Inv->>L: CredentialAccept
  Desk->>L: PermissionedDomainSet(accepts KYC) -> DomainID
  Cap->>L: MPTokenIssuanceCreate(HTMN1, 45,000,000 units, XLS-89 meta w/ docs hash)
  Inv->>L: MPTokenAuthorize (opt in)
  Cap->>L: MPTokenAuthorize(Holder) x2, Payment MPT 60/40
  Desk->>L: VaultCreate(XRP, private, DomainID) -> VaultID, ShareMPTID
  Inv->>L: VaultDeposit
  Desk->>L: LoanBrokerSet(VaultID, cover 10%) -> LoanBrokerID
  Desk->>L: LoanBrokerCoverDeposit
  Desk->>WH: LoanSet signed by Desk
  WH->>L: countersign + submit -> LoanID
  Note over L: buyer EscrowCreate cash-to-close -> title EscrowFinish
  WH->>L: LoanPay(PeriodicPayment + fee, PITI memo)
  Desk->>L: LoanManage impair / unimpair (/ default, LoanDelete)
  L-->>Ingest: report: out/latest.md
```

## Accounts and reserves

Eight Devnet accounts, one per role, funded from the faucet (100 XRP each). Objects and their owners:

| Object | Owner | Reserve |
|---|---|---|
| Credential ×2 | investors (subject) after accept | 1 each |
| PermissionedDomain | broker | 1 |
| MPTokenIssuance | issuer | 1 |
| MPToken ×2 | investors | 1 each |
| Vault (+ pseudo-account, share MPT issuance) | broker | 1 |
| LoanBroker (+ pseudo-account) | broker | 1 |
| Loan | borrower | 1 |
| Escrow | buyer (until finished) | 1 |

## Failure handling

Critical steps (credentials, MPT, vault, broker, LoanSet) fail the run. Servicing and escrow steps
are "soft": a failure is recorded in the report's Notes and the run continues, so a reviewer always
gets a complete report. Credentials are idempotent on reused wallets.

## Devnet vs production

| Concern | Devnet demo | Production |
|---|---|---|
| Vault asset | XRP, 1 XRP = $10,000 | RLUSD or bank stablecoin |
| Loan schedule | 12 × 60 s | 360 × 30 days |
| Keys | single faucet key per role | multisig + HSM, `lsfDisableMaster` |
| Holder gating | explicit `MPTokenAuthorize(Holder)` | `DomainID` on the issuance + credential expiry |
| Escrow release | timer | recording confirmation via authorised signer |
| Document source | JSON fixtures | eVault eNote hash + custodian credential |
