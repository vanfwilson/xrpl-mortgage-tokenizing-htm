# MortgageOS Hooks sidecar (Xahau Testnet)

**Not part of the v3 demo, the test suite or CI.** Hooks are not enabled on the XRP Ledger Mainnet or Testnet
(verified on the Amendments ledger object 2026-09-11); they run on the Xahau network, which has neither Multi-Purpose
Tokens nor TokenEscrow. This directory keeps the payment-firewall Hook from the v3 design notes as **working, deployed,
tested C code** so it is ready as a later test stage if the grant is awarded and Hooks reach a network that also carries
the v3 record and settlement primitives.

## What the hook does

`src/mortgage_firewall.c`, installed on the servicer's custodial account, runs on every transaction that touches the
account and:

| Case | Result |
|---|---|
| Not a Payment | accept — the servicer can always administer the hook |
| `FRZ` parameter = `0x01` | rollback every payment, in or out (`tecHOOK_REJECTED`) |
| Outgoing payment | accept |
| Incoming non-XRP amount | accept — checked by the off-chain engine |
| Incoming XRP below the `EXP` parameter (8-byte big-endian drops) | rollback (`tecHOOK_REJECTED`) |
| Incoming XRP at or above `EXP` | accept |

`EXP` and `FRZ` are **HookParameters** set at install and updated with a parameters-only `SetHook`, which is how the v3
notes' `MortgageHookStateManager` worked: on-chain hook state can only be written from inside a hook, so the off-chain
engine pushes its decisions as parameters.

## Build, deploy, prove

```bash
cd hooks
npm install                       # xahau 4.1.1 (xrpl.js fork with SetHook and NetworkID 21338)
bash build.sh                     # clang + wasm-ld from ghcr.io/webassembly/wasi-sdk (Docker); writes build/mortgage_firewall.wasm
node deploy.mjs --test            # faucet-funds two Xahau Testnet accounts (cached in out/), installs the hook, runs the proof
```

The proof submits, in order: install (`tesSUCCESS`), a 0.5 XAH payment (`tecHOOK_REJECTED`), a 1 XAH payment
(`tesSUCCESS`), freeze (`tesSUCCESS`), a 1 XAH payment while frozen (`tecHOOK_REJECTED`), unfreeze, a 1 XAH payment
(`tesSUCCESS`). It prints `XAHAU HOOK FIREWALL PROOF PASSES` and exits 0 only if every expectation is met, and writes
the step-by-step results with transaction hashes to `out/xahau-test-<ts>.json`. The last committed proof is in
`evidence/`.

Headers are vendored unmodified from `XRPLF/hook-macros` (`vendor/hook-macros/PIN`). Fees for `SetHook` are taken from
the node's `fee` RPC with the transaction blob, as Xahau requires for hook transactions.

## Why this is a sidecar and not the engine

The v3 engine delivers the firewall's three guarantees on the XRP Ledger with Mainnet-live primitives: only pre-authorized
counterparties can pay (`DepositAuth` + `DepositPreauth`), the amount is checked against the schedule before an escrow is
finished (off-chain engine), and the record can be frozen (`MPTokenIssuanceSet` lock). This hook is the same policy
expressed on-ledger for a network that can run it.
