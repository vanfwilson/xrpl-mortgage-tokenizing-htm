# MortgageOS v4 — Mainnet Deployment Runbook

Branch `v4`. Purpose: run the MortgageOS servicing demo on **XRPL Mainnet** with a **single
synthetic note**, so a grant reviewer can verify the system on a public explorer rather than
taking a Testnet claim on trust.

## Scope and boundary — read first

**What goes on Mainnet: one synthetic demonstration loan.** Fictitious borrower, fictitious
property, fictitious note. Real transactions, real amendments, real explorer links.

**What does NOT go on Mainnet: any real HTM promissory note.** An MPT representing a real note,
with escrowed cash flows to holders, is plausibly a securities offering and touches RESPA/TILA,
UCC Articles 3 & 9, CA DFPI/DRE, and Rich Young's DRE #01106294 / NMLS #291547. That step
requires securities counsel first. It is explicitly out of scope for v4.

The demo carries essentially the whole credibility gain for a grant reviewer — the question they
are asking is "does this code run in production conditions," and a synthetic Mainnet run answers
it completely.

## Amendment prerequisites — verified live 2026-09-24

Queried `xrplcluster.com`; of 94 enabled Mainnet amendments, all required primitives are live:

| Amendment | Needed for | Mainnet |
|---|---|---|
| `MPTokensV1` | note digital twin (XLS-89d) | enabled |
| `TokenEscrow` | date-locked P&I settlement (XLS-85) | enabled |
| `fixTokenEscrowV1` | escrow correctness fix | enabled |
| `fixMPTDeliveredAmount` | MPT delivered-amount reporting | enabled |
| `Credentials`, `PermissionedDomains` | future permissioned-holder work | enabled |

## Safety interlock

`mortgageos/config.py` refuses any Mainnet endpoint unless the operator sets the opt-in phrase
verbatim. This is deliberate: a Mainnet run spends real XRP and cannot be undone, so it must
never be reachable by an accidental env var.

    MOS_ALLOW_MAINNET=yes-real-xrp

`load_or_fund_wallets(..., allow_faucet=False)` on Mainnet turns a missing wallet into a hard
stop instead of a confusing faucet error — **there is no faucet on Mainnet**.

## Step 1 — Provision the role wallets (done)

    XRPL_WSS=wss://xrplcluster.com MOS_ALLOW_MAINNET=yes-real-xrp \
      /Volumes/BackupPlus/venvs/mortgageos/bin/python -m mortgageos.provision

Creates any missing role wallets, writes seeds to `out/wallets.py.mainnet.json`, and prints what
each account still needs. Read-only against the ledger — it never moves money. Re-run it to
re-check funding; it exits 0 only when every role is funded.

**The seeds file controls real funds.** `out/` is gitignored. Back it up offline; never commit,
paste, or send it.

## Step 2 — Fund the wallets (HUMAN ACTION — 30 XRP total, ~$46)

Generated 2026-09-24. Send real XRP from your own holdings:

| Role | Address | XRP |
|---|---|---|
| issuer | `rJgwiVNzEEgtXngyi4bhSVkVLhWWu7UqfS` | 5 |
| lender | `rBoJ7MWPXiejVbqCRhiVgGcaXAHXVstCD4` | 6 |
| impound | `rPGMFosJTuEQUqcEzVrEZSdqWqthGPP7Bg` | 5 |
| borrower | `rw4tVZXoDHcVm2frmxXJra3EoxHDjp4US4` | 8 |
| usdm_issuer | `r4NHJEz1w7iXckeExjmFG1RxEcFDgBFgN8` | 3 |
| tax_authority | `rhTpxQdPSJxjLTeEnAuzWTg41VSpBREoUi` | 3 |
| | **TOTAL** | **30** |

Sizing: 1 XRP base reserve per account, 0.2 XRP per owned object (MPT issuance, MPToken holdings,
DepositPreauth, each escrow), plus headroom for a 12-month servicing run. Leftover XRP stays
spendable in the wallets.

**The first payment to a new XRP account must be at least the 1 XRP base reserve** or it is
rejected. No destination tag is needed. Verify each address by copy-paste, not by eye.

## Step 3 — Deploy

Re-run `provision` until it reports all funded, then run the servicing engine against Mainnet.
Capture the validated tx hashes and the MPT issuance ID for the evidence report.

## Step 4 — Evidence and grant materials

- Publish a v4 evidence report alongside the existing v3 one.
- Update the cover letter and proposal: they currently say Testnet. After a successful run they
  should say **live on Mainnet**, with the explorer link to the MPT issuance.
- `livenet.xrpl.org` is the Mainnet explorer (the Testnet one is `testnet.xrpl.org`).

## XLS-89d explorer compliance (fixed in v4)

The v3 metadata failed three XLS-89d validator checks, and non-compliant MPTs "might not be
discoverable by Explorers and Indexers." On Testnet that was cosmetic; on Mainnet it would have
undermined the entire demo, whose value is that a reviewer can *see* the token. Fixed:

- `ticker` `HTMNOTE` (7 chars) → `HTMMTG` — the rule is `^[A-Z0-9]{1,6}$`.
- `icon` was absent → now a public raw.githubusercontent URL (GitHub Pages does not serve
  `/assets`, so the Pages URL 404s — raw does not).
- `asset_subclass` was absent but is required when `asset_class` is `rwa` → `private_credit`.
  A mortgage note is a credit instrument; `real_estate` would describe the property, not the note.

Also added `uris`, giving a reviewer a path from the explorer straight to the repository and the
evidence report. Metadata validates clean at 846/1024 bytes.
