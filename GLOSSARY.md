# Glossary, for mortgage and finance people

Plain definitions of every technical term in this repository. Mortgage terms are included where the
blockchain world uses the same word differently.

## The ledger

| Term | Meaning here |
|---|---|
| **XRP Ledger (XRPL)** | A public, shared database run by many independent computers ("validators") since 2012. Anyone can write a transaction to it; nobody can alter one after it settles (about 4 seconds). Think of it as a county recorder's office that is worldwide, open 24×7, and cannot lose a page. |
| **Mainnet** | The real XRP Ledger, where XRP has value. We do not touch it. |
| **Testnet** | A copy of the ledger for testing, with play money. |
| **Devnet** | Another test copy where brand-new features are turned on before Testnet or Mainnet get them. The mortgage features we use (vaults, lending) exist today only on Devnet. Devnet is where every result in this repo comes from. Its money is worthless and its data can be reset by Ripple. |
| **Faucet** | A free web service that hands out test money on Devnet so developers can pay transaction fees. Our demo asks the faucet for 100 test XRP per account. |
| **XRP** | The ledger's native currency. Transaction fees are paid in it. On Devnet it is play money. |
| **Drops** | The smallest unit of XRP: one XRP = 1,000,000 drops. Amounts on the ledger are written in drops, so "45000000" drops means 45 XRP. |
| **Demo scale** | In this demo 1 XRP stands for US$10,000, so a $450,000 loan appears as 45 XRP. In production the amounts would be a dollar stablecoin such as RLUSD at face value. |
| **Account / wallet / address** | A ledger account is identified by an address beginning with `r` (for example `rPf2udJq…`). "Wallet" means the same account plus the secret key that controls it. Each party in our demo (lender, servicer, borrower, investors, county treasurer…) is one account. |
| **Transaction** | One signed instruction to the ledger: pay, create a token, deposit to a vault, and so on. Each gets a permanent hash (ID) you can look up on the explorer. |
| **Explorer** | A website (`devnet.xrpl.org`) where anyone can look up an account or transaction by its ID. Every result in this repo links to it. |
| **Amendment** | A ledger feature upgrade that validators vote on. `MPTokensV1`, `SingleAssetVault` and `LendingProtocol` are the amendments this project depends on; all are live on Devnet. |
| **XLS-nn** | "XRP Ledger Standard number nn." A published specification for a ledger feature, like a building code section. We *use* these standards; we do not write or modify them. |

## The four standards we use

| Standard | Plain meaning | What we create with it |
|---|---|---|
| **XLS-33, Multi-Purpose Token (MPT)** | The ledger's built-in template for issuing a token: a fungible unit with a fixed maximum supply, optional holder allow-listing, freeze and clawback controls. It is the ledger's equivalent of a share-registry template. | **One mortgage note token, `HTMN1`.** Its total supply equals the note's principal in cents (45,000,000 units for $450,000.00). Holding units is holding a participation in that note's cash flows. The ledger calls each such token an "MPT issuance"; the "issuance ID" is its serial number. |
| **XLS-89, MPT metadata** | The agreed format for the small (1 KB) description attached to a token: ticker, name, asset class, issuer, links. | The description of `HTMN1`, including the fingerprint (hash) of the scanned closing package it represents. |
| **XLS-65, Single Asset Vault** | A pooled account that holds one kind of asset for many depositors and issues them shares. Comparable to a warehouse line's funding pool or a money-market fund. Can be private: only depositors holding a credential may enter. | **One private funding vault** for this loan, funded by two KYC-approved investors. |
| **XLS-66, Lending Protocol** | Rules for lending out of a vault: a **LoanBroker** (the lending desk, which posts first-loss capital), and **Loans** with a fixed term, rate, payment count and grace period, repaid with `LoanPay`. The ledger amortises the loan itself. | **One LoanBroker (HTM Lending Desk) and one Loan** whose borrower is HTM Loan Servicing. The loan is the lender's *funding facility* for the note, not the homeowner's mortgage. The homeowner's payments are what the servicer uses to repay it. |

**Which one "tokenizes the mortgage"?** XLS-33 does: the note becomes the `HTMN1` token. XLS-65 and XLS-66 are how the tokenized note is *funded and repaid* on the same ledger. When the owner's brief says "send it through XLS-65 / XLS-66", that is the funding and repayment part; the OCR output goes first to the token (XLS-33), then the token's loan is funded (XLS-65) and originated (XLS-66).

## Supporting ledger features

| Term | Meaning here |
|---|---|
| **Credential (XLS-70)** | An attestation one account writes about another, like "this investor passed KYC on this date." Issued by a KYC provider account, accepted by the investor. |
| **Permissioned domain (XLS-80)** | A list of accepted credentials. Vaults and tokens can require members of a domain, which is how "accredited investors only" is enforced on the ledger. |
| **Escrow (on-ledger)** | Money locked in the ledger for a named recipient until a set date, after which anyone can release it and before which nobody can. We use it to hold impounded tax and insurance money for the county treasurer and the insurance carrier until their due dates. This is *not* the closing escrow a title company runs, and not the monthly escrow account line on a mortgage statement. |
| **Memo** | A short note attached to a transaction, visible to everyone. We use memos to tag each payment with the loan number, period and purpose. Never for personal data. |
| **First-loss cover** | Capital the LoanBroker posts that absorbs defaults before vault depositors lose anything. |
| **Two-party signing** | A `LoanSet` must be signed by both the lending desk and the borrower before the ledger accepts it. |

## The paper side

| Term | Meaning here |
|---|---|
| **Close-of-escrow package** | The documents the title/escrow company delivers when a purchase loan funds. This project uses four: Closing Disclosure, Note (Form 3200), Deed of Trust (Form 3013), recorded Warranty Deed. Supporting documents (URLA 1003, settlement statement, FHA clause, escrow instructions) are also printed for the scanning test but are not needed to tokenize. |
| **OCR** | Optical character recognition: software (`tesseract`) that turns a scanned image into text. It is imperfect, which is why every figure is cross-checked. |
| **Canonical loan record** | One JSON file that holds the loan exactly once, assembled from the documents. Every downstream step reads only this file. |
| **Tie-out** | An accounting check that two figures agree: P&I matches rate and term, base loan plus financed UFMIP equals the note amount, cash to close balances, the three servicing buckets sum to the monthly payment. If any tie-out fails the process stops. |
| **Hash / fingerprint (sha256)** | A 64-character code computed from a file. Change one pixel of the scan and the code changes completely. Writing the scan's hash into the token binds this exact paper to this exact token. |
| **Provenance** | For each extracted field, which page it came from. Fields the paper did not supply are listed, not guessed. |
| **Three buckets** | The only things a standard Fannie Mae servicer collects and pays out of the monthly payment: principal & interest, property-tax impound, hazard (and FHA) insurance impound. HOA dues, home warranties and credit life are the homeowner's own business. |
| **Impound / escrow account (mortgage sense)** | The servicer's reserve for taxes and insurance, funded monthly from the payment. On the ledger each is a sub-account plus a time-locked escrow to the payee. |

## The two "MIT"s

- **MIT License** (file `LICENSE`) is a permissive open-source *software* license, named after the university that published it in the 1980s. It means anyone may use this code.
- **MIT** in the team page refers to the Massachusetts Institute of Technology, where HTM's founder studied. The two are unrelated except by name.
