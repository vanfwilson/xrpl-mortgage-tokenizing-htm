# Threat model

Scope: the reference implementation and the production design it implies. Devnet has no value at
risk; this is about what must be true before any real capital touches the design.

| # | Threat | Where | Mitigation in repo | Production requirement |
|---|---|---|---|---|
| 1 | **Servicer misreports** the homeowner payment stream | 05-servicing | Sweep is a real on-ledger `Payment` from the homeowner wallet before any split; split audited to the cent; every leg memo carries loan id + period | Independent servicing oracle or trustee co-signs LoanPay; monthly investor reporting reconciled to the servicing system of record |
| 2 | **Wrong or tampered paper** behind the token | 00-ingest | Canonical tie-outs fail closed; bundle sha256 in XLS-89 metadata | Hash the MERS eNote / eVault copy, not a scan; custodian attestation credential |
| 3 | **Unauthorised holder** acquires participations | 02-mpt | `tfMPTRequireAuth` + explicit `MPTokenAuthorize(Holder)` | Domain-gated issuance; credential expiry and revocation; transfer-agent role holds issuer keys |
| 4 | **Issuer key compromise** (mint, lock, claw back) | 02-mpt | none (single faucet key) | Multisig `SignerList` on issuer/broker accounts, `lsfDisableMaster`, HSM custody |
| 5 | **Borrower (HTM Loan Servicing) default** wipes vault depositors | 04-lending | First-loss cover 10 % via `LoanBrokerCoverDeposit`; `tfLoanDefault` path exercised in `--full-lifecycle` | Cover sized to expected loss; participation agreement subordinating HTM; legal claim on the recorded lien via SPV |
| 6 | **Vault run** (depositors withdraw faster than loans amortise) | 03-vault | FCFS withdrawal policy | Lock-up terms in the participation agreement; `AssetsMaximum`; term-matched vault |
| 7 | **Privacy**: borrower PII on a public ledger | all memos | Fixtures are fictitious; memos carry aggregates only | Never write names, SSNs, addresses; use `tfMPTCanHoldConfidentialBalance` where available |
| 8 | **Amendment risk**: XLS-65/66 change before Mainnet | everywhere | Pinned xrpl.js 5.1.0; live `feature` check in `tests/devnet` | Track amendment votes; Mainnet plan gated on activation |
| 9 | **Regulatory**: participations are securities; deposits may be deposit-taking | design | README states no live claims | Counsel opinion; Reg D/Reg S or HK PI exemption; licensed transfer agent; no retail |
| 10 | **Replay / double-fund** of a run | demo | `out/wallets.json` reuses accounts; each run creates new objects | Idempotency keys keyed on loan id in the orchestrator DB |
| 11 | **Impound shortfall** (tax bill exceeds reserve) | impound-scheduler | Projection to each deadline; `deficit` flag | Servicer advance + escrow analysis (12 CFR 1024.17) |
| 12 | **OCR misread** pushes a wrong LoanPay | scan/compare | Four gates (loan no., amount due = CD sweep, received ≥ due, period present) must all pass | Dual-read (two engines) + human review queue on any MISS |
