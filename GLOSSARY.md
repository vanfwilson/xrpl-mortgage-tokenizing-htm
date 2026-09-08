# Glossary, for mortgage and finance people

Plain definitions of every technical term in this repository. Mortgage terms are included where the blockchain world uses
the same word differently.

## The ledger

| Term | Meaning here |
|---|---|
| **XRP Ledger (XRPL)** | A public, shared database run by many independent computers ("validators") since 2012. Anyone can write a transaction to it; nobody can alter one after it settles (about 4 seconds). Think of it as a county recorder's office that is worldwide, open 24×7, and cannot lose a page. |
| **Mainnet** | The real XRP Ledger. We do not touch it; the code refuses a Mainnet address. Every feature we use is live there. |
| **Testnet** | A copy of the ledger with play money that runs the same features as Mainnet. Every proof in this repo comes from Testnet. |
| **Devnet** | Another test copy where brand-new features are tried first. We use it only for a compressed smoke run and never cite it as proof. |
| **Faucet** | A free service that hands out test XRP so developers can pay transaction fees and reserves. |
| **XRP / drops** | The ledger's native currency (one XRP = 1,000,000 drops). We use it only for fees and reserves, never for servicing money. |
| **Issued currency / test USD** | A token issued by an account. Our settlement asset is a USD token we issue ourselves on Testnet with locking enabled. It is test value only: not a deposit, not borrower money, not RLUSD. |
| **Reserve** | XRP an account must hold: 1 XRP base plus 0.2 XRP per object it owns (escrows, tokens, trust lines). Three impound escrows in flight cost about 0.6 XRP. |
| **Account / wallet / address** | A ledger account is identified by an address beginning with `r`. "Wallet" means the account plus the secret key that controls it. Each party (servicer, note-holding bank, impounds, county, carrier, HUD, homeowner) is one account. |
| **Transaction / hash** | One signed instruction to the ledger. Each gets a permanent 64-character ID you can look up on the explorer (`testnet.xrpl.org`). |
| **Memo** | A short note on a transaction, visible to everyone. Ours has exactly six keys: version, opaque loan id, period, leg, cents, run id. Never a name, address, parcel number or case number. |
| **Amendment** | A ledger feature upgrade validators vote on. We use only amendments already live on Mainnet: MPTokensV1, TokenEscrow, NonFungibleTokensV1_1, Credentials, PermissionedDomains. |

## What we create on the ledger

| Object | Plain meaning | What it is not |
|---|---|---|
| **Loan-record NFToken** | One non-fungible token per loan carrying the fingerprint (SHA-256) of the closing package, an opaque loan id and a pointer to the off-ledger file. It is handed to the successor servicer on a transfer by a zero-price offer. | The note, a security, an ownership certificate, or a claim on cash. Ownership of the note changes by contract and notice, not by moving the token. |
| **Settlement leg** | An exact-cent payment in the issued USD from one servicing account to another (borrower → servicer, servicer → note holder, servicer → tax impound, → hazard impound, → MIP payable → HUD). | A bank transfer. The bank's custodial accounts are the legal cash; the ledger leg is the reconcilable record of it. |
| **Impound escrow (ledger)** | Money locked to a named payee until a date (`FinishAfter`). Before that date nobody can release it, not even the servicer; after it anyone can. Created only for a verified bill the impound can fund in full. | The closing escrow a title company runs. Also not the servicing escrow account itself, which is the bank custodial account plus our subledger. |
| **Escrow analysis** | The once-a-year RESPA calculation (12 CFR 1024.17) that projects the account month by month, caps the cushion at one-sixth of annual bills, and classifies the balance as surplus, shortage or deficiency with the options the regulation allows. | A discretionary fee change. P&I never changes on a fixed-rate loan; only the escrow deposit does. |

## The paper side

| Term | Meaning here |
|---|---|
| **Close-of-escrow package** | The documents the title/escrow company delivers when a purchase loan funds. Four are needed to board: Closing Disclosure, FHA model Note, FHA Idaho Deed of Trust, recorded Warranty Deed. |
| **OCR** | Optical character recognition (`tesseract`) turning a scanned image into text. Imperfect, which is why every figure is cross-checked. |
| **Canonical loan record** | One JSON file holding the loan exactly once, assembled from the documents. Every downstream step reads only this file. |
| **Tie-out** | An accounting check that two figures agree. If any tie-out fails the process stops. |
| **Hash / fingerprint (SHA-256)** | A 64-character code computed from a file. Change one pixel and the code changes completely. |
| **Four legs** | What a servicer does with one payment on an FHA loan: principal & interest to the note holder, property-tax impound, hazard-insurance impound, FHA mortgage insurance premium to HUD. HOA dues and optional products are the homeowner's own business. |
| **Impound / escrow account (mortgage sense)** | The servicer's reserve for taxes and insurance, funded monthly from the payment and held in the bank's custodial account. |
| **Servicer advance** | The servicer's own money used to pay a bill in full when the impound is short, as RESPA requires when the borrower is not more than 30 days overdue. Recovered later under the deficiency rules. |
| **Servicer of record** | The licensed entity legally responsible for servicing; here a bank-owned subservicer. HTM is its technology provider. |
| **Suspense** | Where a partial payment waits until a full periodic payment is available. |
| **Form 1098** | The IRS mortgage-interest statement the servicer files and sends the borrower each January. |

## The two "MIT"s

- **MIT License** (file `LICENSE`) is a permissive open-source *software* license.
- **MIT** in the team page refers to the Massachusetts Institute of Technology. The two are unrelated except by name.
