# Independent audit — xrpl-mortgage-tokenizing-htm (Fable 5.1 pass, 2026-09-08)

Audited working copy: `/Volumes/BackupPlus/VideoLab/repos/xrpl-mortgage-tokenizing-htm` (HEAD as of 2026-09-04 run). Live objects re-read from Devnet (`wss://s.devnet.rippletest.net:51233`, rippled 3.4.0-rc2) on 2026-09-08. Offline suite: 36/36 pass.

## 1. Definition-of-Done checklist

| # | Item | Status | Note |
|---|---|---|---|
| 1 | Every standards-mapping.md claim checked against a current primary source | DONE | Table in §2 T1/T3; one claim INACCURATE (CoverRateLiquidation), one OUTDATED (reserves in architecture.md), rest ACCURATE |
| 2 | Every fee/rate/unit conversion recomputed by hand | DONE | §2 T2/T3; all decoded from the live ledger objects, not from the repo |
| 3 | Full amortization reconciled to the cent against code output | DONE | USD schedule and the ledger's own 60-second schedule both reproduced |
| 4 | RESPA/TILA/Reg D/GAAP claims cited | DONE | §2 T6. Live-fetched: 12 CFR 1024.17, 24 CFR 203.25, ML 2023-05, 17 CFR 230.506(c), 12 CFR 1026.39, ASC 860-10-40-6A. Cited from regulation text without a live fetch this session (verify before quoting externally): 12 CFR 1026.3(a), 1026.36(c), ASC 310-20-25-2, ASC 326, ASC 470, HUD 4000.1 custodial-account rule |
| 5 | Every doc claim traced to enforcing code or flagged | DONE | §2 T7 |
| 6 | Severity-ranked findings table | DONE | §3 |
| 7 | Separate business-standpoint explainer | DONE | §4 |
| 8 | Final verdict (grant readiness + regulatory/GAAP defensibility) | DONE | §5 |

Nothing skipped. Two limits: I did not verify individual professional licences in TEAM.md, and I could not fetch XLS-66 Appendix A-3 verbatim (the periodic-rate formula in §A-2.1.1 was fetched and independently confirmed against the live Loan object).

## 2. Test results T1–T8

### T1 — Amendment field/flag conformance: PASS on all seven (one documentation error carried to T3)

Method: every field the repo sets was decoded from the live ledger objects and transactions, then checked against the XLS text or xrpl.org reference and the xrpl.js 5.1.0 validators.

| Amendment | Repo sets | Ledger shows | Spec check | Result |
|---|---|---|---|---|
| XLS-33 MPTokensV1 | AssetScale 2, MaximumAmount 45000000, TransferFee 0, Flags RequireAuth+CanLock+CanClawback+CanEscrow+CanTransfer, 775-byte metadata | Flags = 110 = 2+4+8+32+64; metadata 775 bytes | All flags exist with those hex values; TransferFee 0 valid; DomainID correctly omitted and correctly described as requiring RequireAuth + PermissionedDomains + SingleAssetVault | PASS |
| XLS-89 metadata | t,n,d,i,ac=rwa,as=private_credit,in,us[u,c,t],ai | Same, 775 bytes | All five required keys present; `as` is required when `ac=rwa` and is present; ticker "HTMN1" satisfies A-Z0-9 ≤6; `private_credit` and `real_estate` both enumerated | PASS |
| XLS-70 Credentials | CredentialCreate(Subject, CredentialType hex, URI); CredentialAccept | Domain accepts {Issuer kyc, type 48544D5F…} | Fields valid. `Expiration` (optional) not set — see finding m8 | PASS |
| XLS-80 PermissionedDomains | PermissionedDomainSet(AcceptedCredentials[1]) | PermissionedDomain owner = broker | Valid; 1–10 credentials allowed | PASS |
| XLS-65 SingleAssetVault | Asset XRP, tfVaultPrivate, DomainID, WithdrawalPolicy 1, AssetsMaximum 0, Data ≤256 B | Flags 65536, WithdrawalPolicy 1, ShareMPTID present, AssetsTotal 60,000,966 | All per spec; `AssetsMaximum 0` = uncapped confirmed; Data 95 B < 256 B | PASS |
| XLS-66 LendingProtocol | LoanBrokerSet(100, 0, 10000, 5000); LoanSet(45000000 drops, 6250, 5000, 360, 60, 60, fees, tfLoanOverpayment); two-party countersign | LoanBroker and Loan entries match exactly; Loan Flags 262144 = lsfLoanOverpayment | All in range (InterestRate ≤100000; ManagementFeeRate ≤10000; PaymentInterval ≥60; GracePeriod ≤ PaymentInterval; OriginationFee ≤ Principal; Data ≤256 B). Spec is silent on borrower needing domain membership; empirically not required (servicer holds no credential and LoanSet succeeded) | PASS |
| XLS-85 TokenEscrow | Only the `tfMPTCanEscrow` capability flag; impound escrows are native XRP escrows | TokenEscrow enabled on Devnet | Flag semantics per spec (issuer must set CanEscrow + CanTransfer) — both set | PASS |

Devnet amendment state on 2026-09-08 matched README's "verified 2026-09-04" list: MPTokensV1, SingleAssetVault, LendingProtocol, LendingProtocolV1_1, PermissionedDomains, Credentials, TokenEscrow all enabled.

### T2 — Amortization: PASS (to the cent, both schedules)

| Quantity | Independent recomputation | Code / ledger | Match |
|---|---|---|---|
| Level P&I, $450,000 @ 6.25% / 360 | 2770.727402 → $2,770.73 | loan-math.ts → 2770.73; CD and Note fixtures 2770.73 | YES |
| Period-1 interest / principal | $2,343.75 / $426.98 | loan-math.ts schedule row 1 = 2343.75 | YES |
| Ledger periodic payment (45,000,000 drops, rate 6250/100000, interval 60 s, 360 payments, periodicRate = rate × 60 / 31,536,000 per XLS-66 §A-2.1.1) | 125,002.68 drops | Loan.PeriodicPayment = 125002.682964893616 | YES |
| LoanPay amount | ceil(125,002.68) + LoanServiceFee 2,500 = 127,503 | LoanPay tx 58E8B37C… Amount = 127503 | YES |
| PrincipalOutstanding after 2 payments | 45,000,000 − 2 × (125,002.68 − 5.35) ≈ 44,750,005 | Loan.PrincipalOutstanding = 44750006 | YES (ledger rounds up) |

### T3 — Unit conversions: PARTIAL (one of three wrong)

| Field | Repo comment | Spec unit | Actual meaning | Result |
|---|---|---|---|---|
| ManagementFeeRate 100 | "0.10 %" | 1/10 bp, range 0–10000 | 0.10 % of interest | PASS |
| CoverRateMinimum 10000 | "10 %" | 1/10 bp, range 0–100000 | 10 % of DebtTotal | PASS |
| CoverRateLiquidation 5000 | "50 % of that minimum" (04-lending.ts:30, standards-mapping.md) | 1/10 bp, range 0–100000 | **5 %** of the minimum cover → DefaultCovered = min(DebtTotal × 0.10 × 0.05, DefaultAmount, CoverAvailable) = 0.5 % of DebtTotal ≈ 0.22 XRP of the 10 XRP posted | **FAIL** |
| InterestRate 6250 / LateInterestRate 5000 | 6.25 % / 5 % | 1/10 bp | 6.25 % / +5 % premium | PASS |

### T4 — Impound escrow timing: PASS on timing; GAP on amount

Live tax escrow A97B2B2A…: Amount 57,000 drops ($570 = 2 × $285), FinishAfter = 2026-12-20T17:00:00Z. Live insurance escrow 8E11E312…: 62,500 drops ($625 = 2 × $312.50), FinishAfter = 2027-09-01T17:00:00Z. Idaho Code 63-903 confirms Dec 20 / Jun 20 halves. Native escrow cannot be finished before FinishAfter; EscrowFinish deletes the object so it cannot be double-finished. No code path submits EscrowFinish early. GAP: the escrow locks whatever has accumulated, not the amount due ($1,710 for the Dec 20 half); `evaluateImpound` computes `deficit` and `ready_to_disburse` but 05-servicing.ts ignores both and escrows unconditionally. No CancelAfter, so a mis-addressed escrow is unrecoverable.

### T5 — Credential gating: PASS with notes

CredentialCreate (kyc) → CredentialAccept (investor) → PermissionedDomainSet (broker, accepts that credential) → VaultCreate(tfVaultPrivate, DomainID). Per XLS-65 a non-owner depositor "must be a valid member of the permissioned domain"; the owner is exempt; any shareholder may withdraw regardless. No bypass found. Notes: credentials carry no Expiration; no CredentialDelete/revocation exercised; the MPT issuance is not domain-gated (documented); the KYC issuer is an HTM-controlled wallet.

### T6 — Regulatory mapping

| Requirement | Citation | Code / doc | Status |
|---|---|---|---|
| Escrow cushion ≤ 1/6 of annual disbursements; aggregate analysis; annual statement | 12 CFR 1024.17(c)(1)(ii), (d), (i) | Not implemented; threat-model #11 references 1024.17 | GAP |
| Servicer must pay escrow items on time even if balance short | 12 CFR 1024.17(k)(1) | Escrow locks partial balance; no advance | GAP |
| Escrow funds in federally insured custodial account (FHA) | HUD 4000.1 (verify section) | XRP sub-accounts | GAP (production) |
| Initial escrow deposit at closing flows into escrow | 1024.17(c)(2) | CD shows $1,230.50; on-ledger sub-account starts at 0 | GAP |
| FHA late charge ≤ 4 % after 15 days | 24 CFR 203.25; HUD model note | Note fixture 5 % ($138.54); LoanSet LatePaymentFee 13854 drops | **FAIL** |
| UFMIP = 1.75 % of base loan; annual MIP on base | HUD ML 2023-05 | Fixture computes both on total ($450,000) | FAIL (fixture) |
| TILA applies to consumer credit only | 12 CFR 1026.3(a) | On-ledger XLS-66 loan is HTM-to-HTM business credit → Reg Z does not attach to it; it attaches to the off-ledger consumer note | NOT-APPLICABLE-BECAUSE-DESIGN (state this in docs) |
| Prompt crediting of consumer payments | 12 CFR 1026.36(c)(1) | Sweep credited same ledger | SATISFIED (Devnet) |
| Ownership-transfer notice on sale of partial interests | 12 CFR 1026.39; (c)(3) partial-interest exception | MPT transfers are partial-interest transfers; exception applies only if servicer/notice party unchanged | GAP (document) |
| Reg D 506(c) reasonable-steps verification; Form D; general solicitation | 17 CFR 230.506(c)(2)(ii); SEC staff letter 2025-03-12 | "ACCREDITED_KYC" credential is self-issued; public repo + website = solicitation | GAP (acknowledged in threat-model #9) |
| Participating-interest sale accounting | ASC 860-10-40-6A(b),(c) | HTM first-loss cover subordinates HTM → not pro-rata → secured borrowing, loan stays on HTM balance sheet | GAP (not addressed anywhere) |
| Loan origination fee deferred, effective-interest | ASC 310-20-25-2 | $4,500 LoanOriginationFee paid to broker at LoanSet | GAP (accounting note needed) |
| Credit-loss allowance on vault loan | ASC 326 | Not addressed | GAP |
| No borrower PII on ledger | GLBA/threat-model #7 | Names/SSN absent; APN present in tax memo (05-servicing.ts:47) | PARTIAL |

### T7 — Documentation claims

| Claim | Where | Enforcing code | Verdict |
|---|---|---|---|
| "refuses to continue unless every figure agrees across documents to the cent" | README | canonical.ts validateCanonical (9 tie-outs) + consistency.test.ts (note = DoT = deed) + tokenize exit 2 | IMPLEMENTED (with the 5 % late-charge and UFMIP figures being wrong but internally consistent) |
| "each monthly payment is split into the three things… P&I → LoanPay" / flowchart "LoanPay P&I $2,770.73" | README, WALKTHROUGH row 11 | LoanPay pays 127,503 drops (~$1,275 demo scale); on-ledger legs total 184,753 of 336,823 drops swept | MISLEADING |
| MPT is a "participation certificate in one note's cash flows… carrying the payment history for the life of the loan" | README | No cash flow reaches MPT holders; supply fixed at 45,000,000 while principal amortizes; history lives on the Loan object | MISLEADING |
| "First-loss cover 10 %… consumes first-loss cover on default" | threat-model #5, standards-mapping | CoverRateLiquidation caps draw at 0.5 % of DebtTotal per default | MISLEADING |
| "impossible to alter or backdate" | README | Ledger immutability | IMPLEMENTED (content is still whatever the servicer submits — threat-model #1 says so) |
| "no borrower personal data on the ledger" | README, threat-model #7 | Names/SSN/address absent; APN in memo, state + maturity in metadata | PARTIAL |
| "the ledger amortises the loan itself" | GLOSSARY | Loan.PeriodicPayment computed by rippled | IMPLEMENTED |
| "Every step is a signed transaction with a public ID" | README | 26 tesSUCCESS links reproduced | IMPLEMENTED |
| "auto-disburse mechanism without custom contract code" | 05-servicing.ts header, GLOSSARY | Escrows exist but lock partial balances; no sufficiency gate | ASPIRATIONAL |
| "native escrow for closing funds" | grant-narrative | No closing-funds escrow exists | ASPIRATIONAL |
| "XLS-65/66 … in Mainnet validator voting" | grant-narrative | Latest reports: ~37 % / ~34 % support vs 80 % needed | IMPLEMENTED (accurate; timing outside HTM's control) |
| "Reserve 1 each" per object | architecture.md | Devnet server_info: reserve_base 1 XRP, reserve_inc 0.2 XRP | OUTDATED |
| "32 offline tests" | README | 36 tests | OUTDATED (trivial) |
| Devnet amendment list | README footer, GLOSSARY | feature RPC matches | IMPLEMENTED |

### T8 — 1024-byte limit: PASS

`encodeMetadataHex` throws RangeError when `Buffer.byteLength(json) > 1024` before hex-encoding; metadata.test.ts covers the reject path; on-ledger blob is 775 bytes.

## 3. Findings (severity-ranked)

| # | Sev | File:line | Finding | Conflicts with | Fix |
|---|---|---|---|---|---|
| 1 | Blocking | data/documents/02-promissory-note-3200.json:14; src/steps/04-lending.ts:59; src/ingest/canonical.ts:105; README "Numbers that must tie" | Loan is labelled FHA (MIC 411-…, UFMIP, MIP) but is documented on Fannie Form 3200 with a 5 % late charge; the tie-out enforces the illegal figure and LoanSet encodes it (13,854 drops) | 24 CFR 203.25 (≤4 %); HUD model note | Set late charge to 4 % ($110.83), or make the fixture conventional and drop MIP. Change the form label to the FHA model note/security instrument |
| 2 | Major | src/steps/05-servicing.ts:40; README flowchart; WALKTHROUGH row 11 | On-ledger "P&I leg" is the ledger's 60-second-schedule due (127,503 drops), not the $2,770.73 P&I; ~152,070 drops per period never leave the servicer on-ledger | README's own "split into three" and "mirrored on-ledger" claims | Say so plainly in README/WALKTHROUGH (standards-mapping already does), or run the Testnet demo with PaymentInterval = 2,592,000 s so amounts align, or forward the residual |
| 3 | Major | src/steps/04-lending.ts:30; docs/standards-mapping.md; docs/threat-model.md row 5 | CoverRateLiquidation 5000 = 5 % of minimum cover, not 50 %; per-default draw is 0.5 % of DebtTotal | XLS-66 LoanBrokerSet field definition (1/10 bp) | Use 50000 (50 %) or 100000 (100 %) and re-run; correct both docs |
| 4 | Major | src/steps/02-mpt.ts:57-73; README object table | MPT distributed to investors for no consideration while the same investors fund the vault; no cash flow to MPT holders; supply never amortizes — the asset is represented twice | README claim of a cash-flow participation; ASC 860 (no transfer for consideration) | Pick one: make the vault ShareMPT the investor instrument, or sell HTMN1 for vault asset and route LoanPay proceeds (or claw back units) as principal amortizes. Until then, state that HTMN1 is a registry token, not a cash-flow claim |
| 5 | Major | src/steps/05-servicing.ts:62-79; src/servicing/impound-scheduler.ts | Escrow locks partial balances; scheduler's `ready_to_disburse`/`deficit` ignored; initial escrow deposit never enters the ledger; no cushion/aggregate analysis; custodial-account rule unmet | 12 CFR 1024.17(c),(k); HUD 4000.1 | Seed sub-accounts with the CD initial deposit; only EscrowCreate when `ready_to_disburse`; document servicer-advance and custodial requirements |
| 6 | Major (GAAP) | docs/grant-narrative.md "Credit & Lending"; README "Compliance posture" | HTM subordination via first-loss cover defeats ASC 860 participating-interest sale; $4,500 origination fee is deferred income; CECL applies | ASC 860-10-40-6A; ASC 310-20-25-2; ASC 326 | Add an accounting note; if sale treatment matters, remove HTM subordination or use an SPV |
| 7 | Minor | data/documents/01-closing-disclosure.json loan_terms; src/domain/loan-math.ts:51-57; src/ingest/canonical.ts:94,104 | UFMIP, monthly MIP and LTV all computed on total loan ($450,000) instead of base ($442,125): $7,875 vs $7,737.19; $187.50 vs $184.22; 80.36 % vs 78.95 % | HUD ML 2023-05 | Regenerate fixture from base; tie-out on base × 1.0175 |
| 8 | Minor | src/steps/01-credentials.ts:29-44 | No `Expiration`, no revocation, self-issued "ACCREDITED" credential | XLS-70 optional Expiration; 17 CFR 230.506(c)(2)(ii) | Add Expiration and a CredentialDelete step; document the off-ledger verification behind the credential |
| 9 | Minor | src/steps/05-servicing.ts:47 | Assessor parcel number in a public memo identifies the property and, via county records, the owner | threat-model #7 ("never addresses") | Drop or hash APN |
| 10 | Minor | docs/architecture.md reserve table | Owner reserve is 0.2 XRP/object, base 1 XRP | Devnet server_info | Update table |
| 11 | Note | docs/grant-narrative.md ¶1 | "native escrow for closing funds" — not implemented | — | Reword to "impound disbursements" |
| 12 | Note | src/config.ts:20 | GracePeriod = 100 % of PaymentInterval vs Note 15/30 days | Note s.6 | Use 30 s if fidelity matters |
| 13 | Note | src/steps/05-servicing.ts:71-74 | Escrows have no CancelAfter | — | Acceptable for Devnet; add payee verification in production |
| 14 | Note | README | "32 offline tests" (36) | — | Update |
| 15 | Note | package.json | xrpl.js 5.1.0 pinned while Devnet runs LendingProtocolV1_1 (spec updated 2026-01-14) | threat-model #8 | Keep the live `feature` check; note the V1_1 amendment by name |

## 4. Plain-English explainer (for a financially literate reviewer)

**Document fingerprinting.** Every page of the closing package is hashed with SHA-256 and the sorted list of hashes is hashed again; that 64-character bundle hash is written into the token's metadata. Business problem: after a loan changes hands a few times, nobody can prove which copy of the note is the real one. What the hash gives you: proof that the token refers to exactly this set of pages and that nobody has swapped a page since. What it does not give you: proof the pages were correct in the first place, or that they are the legally operative eNote. The repo says the production path is to hash the MERS eVault copy instead; that is the right answer and it is not built yet.

**The note as a token.** One Multi-Purpose Token issuance with a fixed supply of 45,000,000 units, one unit per cent of original principal, with holder allow-listing, freeze and claw-back. Why MPT and not an NFT or a trust-line IOU: an NFT has no divisible balance and cannot sit in a vault; IOUs cannot be allow-listed per holder without freezing the whole issuer account and cost more reserve. What it provides today: a transferable, permissioned registry of who holds what share of the note. What a reader will assume it provides but it does not: a claim on the monthly cash. Nothing in the code pays MPT holders, and the supply does not shrink as principal is repaid. Until a participation agreement exists and the payment flow is wired to the token, HTMN1 is a cap-table entry, not a bond.

**Vault funding.** A private Single Asset Vault pools investor money and hands back share tokens; only wallets holding the KYC credential can deposit. Why a vault rather than a plain account: shares are issued and redeemed by the ledger, so depositor ownership is arithmetic, not bookkeeping. What it provides: a warehouse-line funding pool with membership control. What to watch: on Devnet the asset is XRP standing in for a dollar stablecoin at 1 XRP = $10,000, so every dollar figure on the ledger is a demo scale, and the same investors are both share-holders here and MPT-holders above, which double-represents the asset.

**The three-way split.** The borrower's $3,368.23 sweep is split off-ledger into $2,770.73 P&I, $285.00 tax, $312.50 insurance and refused if the three do not sum to the sweep to the cent. On-ledger, the tax and insurance legs are exact; the "P&I" leg pays whatever the ledger's own compressed schedule says is due, which on Devnet is about $1,275, not $2,770.73. The ledger is amortising a 360-payment loan whose payments are 60 seconds apart, so per-period interest is tiny. The arithmetic is correct; the label "P&I" on that leg is not, and a reviewer who clicks the LoanPay transaction will see the difference.

**Escrow-based disbursement.** Each month's tax and insurance portions land in dedicated sub-accounts, and what has accumulated is locked in a native escrow that anyone can release to the county treasurer on or after Dec 20 / Jun 20, or to the carrier on Sep 1. What it provides: a hard guarantee that reserved money cannot be spent early or redirected. What it does not provide: a guarantee the bill gets paid in full. RESPA makes the servicer pay the full bill on time and advance the shortfall; the escrow here locks $570 toward a $1,710 bill and there is no advance mechanism. The scheduler already knows this (it computes a deficit flag) but the ledger step does not consult it.

**Credential-gated access.** A KYC wallet issues an "accredited" credential to each investor, the investor accepts it, and the lending desk lists that credential type as the price of admission to the vault. Why this beats a spreadsheet of approved wallets: the ledger enforces it on every deposit, and the credential can be checked by anyone. What it does not do: prove the investor is actually accredited. The credential is only as good as the verification behind it, and here the issuer is HTM itself with no expiry and no revocation path. Securities counsel will treat this as an access control, not as the Reg D exemption.

No smart contract exists in this repo, and the docs say so; every mechanism is a native ledger primitive. That is a strength for a grant reviewer (no custom code to audit) and should be stated that way in the narrative rather than implied otherwise.

## 5. Verdict

**Grant submission (xrplgrants.org):** technically strong and honest in structure — every claimed XRPL primitive is real, every transaction reproduces on Devnet, the ledger's amortization is independently correct, and the "what is not yet true" section is unusually candid. It is not ready to submit as-is because three things a rubric-driven technical reviewer will find in under an hour are still in it: the CoverRateLiquidation unit error, the "LoanPay P&I $2,770.73" label that the explorer contradicts, and the token that is described as a cash-flow participation but pays nothing. Fix those three and the FHA late-charge figure and it is submission-ready.

**US banking regulation and GAAP for a real deployment:** not defensible yet, and the repo mostly says so. The on-ledger loan is business credit between HTM entities, so TILA does not attach to it, which is the correct design and should be stated. The consumer-facing fixture violates the FHA late-charge cap; the escrow mechanics do not meet RESPA 1024.17 (no cushion analysis, no advance, no custodial account, initial deposit missing); the participation structure fails ASC 860 sale treatment because HTM is subordinated; and the accredited-investor credential is self-attested. None of these are ledger problems — they are the legal wrapper, servicing policy and accounting memo the 12-week plan already lists. The honest framing for the grant is "a correct ledger settlement layer awaiting its legal and servicing shell", and the documents should not claim more than that.
