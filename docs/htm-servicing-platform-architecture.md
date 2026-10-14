# High Tech Mortgage — servicing platform: architecture, payments and positioning

> **Informational copy.** The canonical, maintained version is [`hightechmortgage-site/docs/servicing-platform-architecture.md`](https://github.com/vanfwilson/hightechmortgage-site/blob/main/docs/servicing-platform-architecture.md). It describes how this servicing engine fits into the HTM platform (WordPress login, self-hosted face check, Privy wallets, CouncilForge `htm_mortgages`). Edit the canonical copy, then re-copy here.


*Written 2026-10-14 from the owner's decisions in the build session. Canonical copy:
`hightechmortgage-site/docs/servicing-platform-architecture.md`; an informational copy lives in
`xrpl-mortgage-tokenizing-htm/docs/`. The loan-file rules enforced in the database are in
`hightechmortgage-site/data/servicing/README.md`.*

> Not legal advice. The compliance section lists questions for a licensed attorney; it does not
> answer them.

---

## 1. What HTM is (positioning)

HTM is the **XRP Ledger servicing layer** for loans: it computes each payment's legal split, records
it permanently, proves it on the XRP Ledger, and reports it to every party. Privy (a Stripe company)
holds wallets and signs; it does not service loans, know about loans, or produce reports.

The niche the owner chose:

- **Commercial, cross-border (non-US/EU), non-bank and custom ("abnormal") loan servicing** — e.g. a
  client pays HTM to build a servicing setup for their loan type, tests it and approves it.
- Recipients who can be paid **on the XRP Ledger** (XRP, RLUSD) or through a local provider, not only
  through US/EU banks.
- **One verified gate for every payment method:** members log in to HTM and pass HTM's own face check
  *before* any payment provider is involved, so HTM can offer methods Privy does not (XRP/RLUSD, cards,
  GCash/PHP, checks, PayPal…) with the same verified identity, legal split and permanent record. Privy is
  one payment rail behind that gate, not the gate itself.
- **Transparency as the product:** a permanent loan file, an append-only history, on-ledger proof,
  and role-scoped reports for borrower, lender/note holder, creditor, tax authority and insurer.

## 2. Who does what

| Component | Role |
|---|---|
| **WordPress + Ultimate Member** (`hightechmortgage.com`, server 31.220.57.8) | Registration and login, member roles (many per member), mirrored to FluentCRM (field + tag + list per role). Easy sign-up, no extra checks. |
| **HTM face check** (Docker `htm-face` on the WordPress server, 127.0.0.1 only) | Self-hosted webcam face recognition (OpenCV YuNet + SFace, commercial-use licences) with random head-turn liveness. Gate for reports and payments. Stores encrypted face templates only. |
| **Passkeys** (optional second method) | Face ID / Touch ID / Windows Hello / phone; computers without a built-in sensor get a QR code to use the phone. |
| **Cloudflare Worker** (`hightechmortgage-site`) | Serves the site, issues the 15-minute verified session after a face check or passkey, and signs HTM member identity tokens for Privy. |
| **CouncilForge Postgres, schema `htm_mortgages`** (server 72.60.225.136) | The loan file: loans, parties (user–role–loan links), payments and their split, escrow, transfers, documents, ledger hashes, history. Row-level security per member. |
| **XRP Ledger** | Authoritative loan record (loan-record token) and payment settlement, built by HTM's servicing engine (`xrpl-mortgage-tokenizing-htm`). |
| **Privy** (app `htm-mortage-servicing`) | Borrower wallets (XRP Ledger) and transaction signing under per-loan policies; optional bank payouts (US/EU/SWIFT) via Bridge. Entered **only** when a borrower makes a payment. |

## 3. Member flow

1. **Register / log in** to HTM (WordPress). Nothing more is asked here.
2. **Face check** with the webcam on `/security/` (set up once with consent + an e-mailed code;
   afterwards just look at the camera and follow the head turns). Passes for 15 minutes.
3. **View reports** — every role, only for the loans that member is linked to, only their share.
4. **Make a payment** — **borrowers only**. This is the only point where Privy is used: the
   borrower's Privy XRP Ledger wallet is created on their first payment.

Third parties may be authorised to pay a loan (a *payer* role, planned), whether or not the lender
knows; they see what is due and their own payments, not the full loan report.

## 4. Security design

- **Two tiers:** joining is easy (WordPress); loan reports and payments need a fresh face check (or
  passkey). The verified session is an HMAC-signed cookie bound to the WordPress session, 15 minutes.
- **HTM is Privy's identity provider.** After a face check the Worker signs a 10-minute ES256 JWT
  (`iss https://hightechmortgage.com`, `aud` = Privy app id, `sub htm-wp-<id>`, `amr` = how the member
  proved it). Privy verifies it against `https://hightechmortgage.com/.well-known/htm-jwks.json`.
  Privy's JWT integration is set to **server-side only**, so a token taken from a browser is useless.
- **Spending needs the token.** Privy releases a short-lived signing key for a member's wallet only in
  exchange for HTM's token — so no face check, no token, no payment.
- **Per-loan Privy policies** (planned): a payment may only go to that loan's approved destination
  addresses, with amount caps — a guard rail even against bugs in HTM's code.
- **Database:** dedicated least-privilege login for HTM servicing (no DELETE, nothing outside
  `htm_mortgages`), row-level security (no scope set = no rows), every read logged.
- **Biometric data:** consent recorded (version, time, IP); template deleted on request or with the
  account; camera allowed only on `/security/`.
- **Planned audit trail (owner spec):** append-only `htm_servicing_audit_log` (time, user, loan, role,
  action, face-snapshot key, interactions, IP, user agent); one face snapshot per verification in a
  private R2 bucket (consent text to be updated first); click / key-*category* tracking on servicing
  pages only.

## 5. Where the data lives and the loan-file rules

All loan and payment data lives in **HTM's database** (CouncilForge `htm_mortgages`), not in Privy.
The owner's rules, enforced by the database (details in `data/servicing/README.md`):

1. A loan file is **permanent** — like a lien at the registry of deeds, payoff adds a recorded
   reconveyance/satisfaction and nothing is erased. Admins can only *void* a data-entry error, and only
   if the loan never reached the ledger, never received a payment and has no recorded document.
2. **The ledger outranks our records**: the loan-record token on the XRP Ledger is authoritative.
3. Access to a loan file ends **only through a servicing transfer**, and the revocation must cite it.
   If the new servicer leaves HTM, the loan is frozen as `transferred_out` and every party's report
   shows where servicing went (site and last known contact).
4. **Member records are not loan files**: accounts and un-accepted submissions may be deleted, by an
   administrator only, with a written reason kept in the database.
5. **Lenders and creditors see active liens only** (released loans stay in the file but are hidden from
   their property views, which exist to show unencumbered equity).

## 6. Payments and payouts

**HTM computes; Privy signs.** For each borrower payment, HTM's servicing engine computes the legal
split (principal and interest to the note holder, tax escrow, insurance escrow, mortgage insurance),
asks Privy to sign each leg, records the result and the ledger hashes, and reports it.

### What Privy can and cannot pay out

| Payout | Privy | Notes |
|---|---|---|
| USD to a US bank | ✅ via Bridge | ACH, same-day ACH, wire (FedNow waitlisted) |
| EUR to an IBAN account | ✅ | SEPA |
| International bank wire | ✅ | SWIFT; settlement currencies "such as usd or eur" — confirm the full list |
| Stablecoins to a crypto wallet | ✅ | USDC, USDT, EURC and other "well-known" assets on Ethereum, Base, Arbitrum, Polygon, Solana, Tron, Tempo; bridging and same-peg conversion |
| XRP / RLUSD on the XRP Ledger | ⚠️ signing only | Not in Privy's transfer or payout service; **HTM builds these payments** (the servicing engine) |
| Bitcoin | ⚠️ not turnkey | Not in the transfer/payout lists; would need raw signing — confirm wallet support |
| PHP, JPY, other local currencies | ❌ | Only via SWIFT if the bank accepts; otherwise a local provider (e.g. PayMongo, Xendit, Coins.ph for the Philippines) |
| GCash, PayPal, Apple Pay | ❌ | Separate integrations |
| Paper check | ❌ | Check-printing service or the servicer's bank bill-pay |

- **Fiat payouts start only from stablecoins on Privy's chains, never from XRP Ledger wallets.** If a
  payee needs USD in a bank, either the leg settles as USDC on Base/Solana and Privy pays out, or the
  XRP Ledger stays the settlement layer and conversion to USD happens outside Privy.
- **Bank payouts need the paying entity verified** (KYC for a person, KYB for a business). A
  third-party integration guide says Bridge's off-ramp is limited to verified businesses — confirm.
- **Wallets are global**; bank payout corridors are not published — ask Privy/Bridge for the
  corridors covering the US, EU, Switzerland and the Philippines.

### Payment types HTM should offer that Privy does not (owner, 2026-10-14)

The owner wants HTM to accept and pay out in the ways borrowers and payees actually use, including
those outside Privy. Each is added when a real payer or payee needs it, behind the same rules: face
check before any payment, HTM records every leg in `htm_mortgages`, and reports cite the proof
(ledger hash, provider transaction id, check number).

| Payment type | Direction | How HTM would offer it | Candidates to evaluate |
|---|---|---|---|
| **XRP** and **RLUSD** on the XRP Ledger | pay-in and payout | **HTM-built** — the servicing engine constructs and records XRP Ledger payments and escrows; Privy only signs borrower wallets. HTM's core strength. | built in-house (`xrpl-mortgage-tokenizing-htm`) |
| **Other XRP Ledger issued currencies** (other countries' stablecoins issued on the XRP Ledger) | pay-in and payout | HTM-built payments over trust lines, per issuer the payee accepts | built in-house; vet each issuer |
| **Other countries' stablecoins on other chains** (beyond Privy's well-known USDC/USDT/EURC set) | payout | Privy can sign same-chain transfers of custom ERC-20/SPL tokens, but not convert or cash them out; conversion needs a provider | issuer or exchange per currency |
| **Bitcoin** | pay-in and payout | Not in Privy's transfer/payout service; HTM builds and broadcasts Bitcoin transactions, or uses a custody/payments provider | BitGo, Coinbase (Prime/Commerce), BTCPay Server (self-hosted) |
| **Paper check by mail** | payout | Check-printing and mailing service, or the servicer-of-record's bank bill-pay | Lob, Checkbook.io, servicer's bank |
| **GCash / PHP** (Philippines) | pay-in and payout | Philippine payment provider with GCash and InstaPay/PESONet bank rails | PayMongo, Xendit, Coins.ph |
| **PHP, JPY and other local currencies to local bank accounts** | payout | Multi-currency payout provider (Privy offers only US, IBAN/SEPA and SWIFT wire) | Wise Business API, local providers per country |
| **PayPal** | pay-in and payout | PayPal checkout (pay-in) and PayPal Payouts (payout) | PayPal |
| **Apple Pay** (and cards) | pay-in only | Card / Apple Pay checkout; Apple Pay is not a business payout method | Stripe (also Privy's parent), Adyen |

Notes:

- **Pay-in vs payout.** Apple Pay and cards bring money *in* from borrowers; checks, GCash, PayPal
  Payouts, local bank transfers and crypto send money *out* to payees. Each method must say which.
- **Every non-ledger method is converted at the edge.** A borrower paying by card or GCash is
  recorded in HTM's database like any other payment; the split and escrow logic does not change with
  the method.
- **Licensing and fees differ per provider and country** and are not verified here — each provider is
  a candidate until checked, and accepting or sending money for others raises the same custody and
  money-transmission questions as section 7.

### Payees

Every payee (note holder, county, insurer, vendor, private seller) gets a **preferred payout method**
in HTM's database; HTM routes each leg: crypto on a Privy chain → Privy transfer; USD/EUR bank →
Privy fiat payout; XRP Ledger → HTM-built payment; anything else (checks, GCash/PHP, PayPal, JPY) →
the servicer's bank or a dedicated provider, added when a real payee needs it.

**Private citizens** (e.g. a seller-carryback note holder): paid either to their bank account from a
verified paying wallet (the seller is the beneficiary, not the verified party — confirm with Privy),
or on the XRP Ledger (RLUSD/XRP) to a wallet of their own, with no bank involved.

Counties and most insurers do not accept crypto: tax and insurance legs go to an **HTM-held escrow
(impound)** on the XRP Ledger, locked per bill until its due date, and are paid when bills fall due
(the servicing engine already models escrow per bill).

## 7. Liability and compliance (questions for counsel)

Using the XRP Ledger, RLUSD and Privy — and a client testing and approving — **does not by itself**
make HTM a non-liable "transitional service". Liability follows what HTM actually does:

- **Servicing a US residential mortgage** brings RESPA / Regulation X (12 CFR 1024 — the source of the
  transfer-notice dates used here) and usually a **state servicer licence** (California: DFPI),
  regardless of who wrote the software.
- **Holding or moving other people's money** — which HTM does for tax and insurance escrow — can make
  HTM a **custodian or money transmitter**, licensed in most US states, and in the Philippines by the
  BSP for virtual-asset services. Fiduciary duty follows custody, not titles.
- **Contracts** (servicing agreement, HTM as technology provider or sub-servicer, indemnities,
  limitation of liability, client acceptance testing) can allocate a lot of risk, but cannot waive
  statutory duties.

### HTM holds escrow funds (owner, 2026-10-14)

"HTM never holds funds or keys" is **not** the rule: HTM holds XRP Ledger funds in a **tax escrow**
until the tax bill is paid at year end (and the same pattern applies to insurance). So HTM is a
custodian of escrow for the time it is held, and the design should make that custody provable:

- **One escrow per loan and bill, never pooled with HTM's own money** — the on-ledger equivalent of a
  segregated trust account.
- **Ledger-enforced locks:** the servicing engine already escrows each verified bill with an XRP Ledger
  `EscrowCreate` that cannot be finished before its date (and is cancelled only through the
  corrected-bill path). Until the release date the ledger itself refuses to release the funds, so not
  even HTM can divert them early.
- **Every movement recorded** in `htm_mortgages` (impound accounts, disbursements, ledger hashes) and
  reported to the borrower, lender and the tax authority / insurer for that loan.
- **The borrower's wallet stays the borrower's** (Privy user-owned); HTM's custody is limited to the
  escrow legs.

What custody means legally (licensing as a servicer or money transmitter, trust-account rules, the
annual escrow analysis already modelled by the engine) is the first question for counsel.

### Preferred direction: escrow in a lender-owned account HTM provably cannot move (owner, 2026-10-14)

The owner prefers that escrow sit in an XRP Ledger account **owned by the lender**, which HTM sets up
when the lender cannot, and which HTM can only *read*:

1. **HTM creates the account, then hands control to the lender:** the lender's own key is set as the
   account's regular key or signer list, and the master key is disabled (`AccountSet asfDisableMaster`).
   From then on no key HTM holds can sign for the account — and anyone can verify that from the
   account's flags and signer list on the public ledger. (The servicing engine already demonstrates
   this "key drill" in WALKTHROUGH step 12.)
2. **Read-only by nature:** XRP Ledger balances are public, so HTM can always show the lender, borrower
   and tax authority that the escrow is funded, without access.
3. **Locked to its purpose:** the lender's account creates an `EscrowCreate` per bill with a **fixed
   `Destination`** (the payee or its payment agent) and `FinishAfter` = due date. After that date any
   account — HTM included — may submit `EscrowFinish`, but the ledger only pays the fixed destination.
   HTM can make sure bills are paid on time and cannot redirect funds. Corrections use `CancelAfter`
   (funds return to the lender's account).
4. **The lender's control must not come from HTM.** Borrower wallets are unlocked by HTM-signed
   identity tokens; a lender escrow account must not be, or HTM could sign as the lender. Options: the
   lender's own wallet app (e.g. Xaman, hardware key), or a Privy wallet the lender unlocks with their
   own Privy login (email/passkey), not HTM's custom auth.
5. **Lost-key safety:** a 2-of-3 signer list — lender's main key, lender's backup, and an independent
   party (attorney or trust company), never HTM alone.

Effect: custody of escrow moves to the lender; HTM is a read-only record-keeper that can only release
escrows to fixed destinations on their dates. Still to be confirmed by counsel, but it directly
answers the custody question above.

**Before live funds move:** one consult with a US mortgage/fintech attorney and one Philippine
attorney (Manila office), covering servicer licensing, money transmission/custody, the technology-
provider structure, and biometric-privacy consent (Illinois BIPA, Texas, Washington, CPRA).

## 8. Open decisions

The full gap list is in [servicing-todo.md](htm-servicing-todo.md).


1. Custody scope: today HTM holds tax (and insurance) escrow; preferred direction is lender-owned
   escrow accounts HTM can only read (above). Confirm with counsel which licences and trust-account
   rules apply to each model in each jurisdiction served.
2. Settlement asset for payment legs: USDC on Base/Solana (Privy bank payouts work directly) or the
   XRP Ledger (HTM-built payments; USD conversion outside Privy)?
3. Which payout corridors matter first (US, EU, Switzerland, Philippines)? Confirm with Privy/Bridge.
4. Payer role, servicing API + "My Loans" screens, audit trail and R2 snapshots — build order.

## 9. Sources

- Privy: [JWT-based auth setup](https://docs.privy.io/authentication/user-authentication/jwt-based-auth/setup.md),
  [Payouts](https://docs.privy.io/financial-flows/payouts/overview.md),
  [Fiat payouts](https://docs.privy.io/financial-flows/transfers/fiat-payouts/overview.md),
  [Fiat payout setup](https://docs.privy.io/financial-flows/transfers/fiat-payouts/setup.md),
  [Execute a payout](https://docs.privy.io/financial-flows/transfers/fiat-payouts/execute-payout.md),
  [Register a bank account](https://docs.privy.io/financial-flows/transfers/fiat-payouts/register-bank-account.md),
  [Transfers](https://docs.privy.io/wallets/actions/transfer/overview.md),
  [Supported chains and assets](https://docs.privy.io/treasury-management/supported-chains-and-assets.md),
  [XRPL policies](https://docs.privy.io/controls/policies/example-policies/xrpl.md),
  [MFA](https://docs.privy.io/authentication/user-authentication/mfa)
- Stripe acquisition of Privy: [Blockworks](https://blockworks.com/news/stripe-acquires-privy-wallet)
- Bridge: [off-ramp liquidation](https://apidocs.bridge.xyz/get-started/guides/move-money/offramp_liquidation.md),
  [Stripe stablecoin availability](https://docs.stripe.com/stablecoins/availability); third-party:
  [Squads Bridge off-ramp](https://docs.squads.so/main/getting-started/on-and-off-ramp/bridge-off-ramp),
  [rfp.wiki Bridge review](https://www.rfp.wiki/crypto/stablecoins-on-off-ramps/bridge)
- OpenCV Zoo models: [YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet),
  [SFace](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface)
