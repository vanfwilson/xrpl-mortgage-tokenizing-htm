// Deploy the MortgageOS firewall Hook to Xahau Testnet and, with --test, prove it: below-schedule payment rejected,
// scheduled payment accepted, frozen account rejects, unfrozen accepts. Standalone sidecar; not part of the v3 demo.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import xahau from "xahau";

const { Client, Wallet, encode } = xahau;
const WSS = process.env.XAHAU_WSS ?? "wss://xahau-test.net";
const FAUCET = process.env.XAHAU_FAUCET ?? "https://xahau-test.net/newcreds";
const NETWORK_ID = 21338;
const WASM = process.env.HOOK_WASM ?? "build/mortgage_firewall.wasm";
const WALLETS = process.env.XAHAU_WALLETS_FILE ?? "out/xahau-wallets.json";
const OUT_DIR = process.env.XAHAU_OUT_DIR ?? "out";
// Fire on Payment only (bit 0 clear); bit 22 (SetHook) is conventionally set so the hook never blocks its own administration.
const HOOK_ON_PAYMENT = "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFBFFFFE";
const NAMESPACE = createHash("sha256").update("mortgageos/firewall/v1").digest("hex").toUpperCase();
const hex = (s) => Buffer.from(s, "utf8").toString("hex").toUpperCase();
const u64hex = (n) => BigInt(n).toString(16).padStart(16, "0").toUpperCase();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function faucet(role) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(FAUCET, { method: "POST" });
    if (!r.ok) throw new Error(`faucet ${r.status} for ${role}`);
    const j = await r.json();
    const wait = /wait (\d+) seconds/.exec(j.error ?? "");
    if (wait) { console.log(`faucet rate limit for ${role}: waiting ${wait[1]}s`); await sleep((Number(wait[1]) + 2) * 1000); continue; }
    const secret = j.secret ?? j.seed ?? j.master_seed;
    const address = j.address ?? j.account ?? j.classic_address;
    if (!secret || !address) throw new Error(`faucet shape unexpected: ${JSON.stringify(j).slice(0, 200)}`);
    return { address, secret };
  }
  throw new Error(`faucet gave up for ${role}`);
}

async function loadWallets(client) {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(WALLETS), { recursive: true });
  const stored = existsSync(WALLETS) ? JSON.parse(readFileSync(WALLETS, "utf8")) : {};
  for (const role of ["servicer", "borrower"]) {
    if (!stored[role]) { stored[role] = await faucet(role); writeFileSync(WALLETS, JSON.stringify(stored, null, 2)); }
  }
  // Xahau faucet seeds are secp256k1; xrpl.js defaults to ed25519 unless told otherwise
  const wallets = Object.fromEntries(Object.entries(stored).map(([k, v]) => [k, Wallet.fromSeed(v.secret, { algorithm: "secp256k1" })]));
  for (const [role, w] of Object.entries(wallets)) {
    for (let i = 0; i < 30; i++) {
      try { await client.request({ command: "account_info", account: w.classicAddress, ledger_index: "validated" }); break; }
      catch { if (i === 29) throw new Error(`${role} never funded`); await sleep(4000); }
    }
  }
  return wallets;
}

async function submit(client, wallet, tx, label) {
  const prepared = await client.autofill({ ...tx, NetworkID: NETWORK_ID });
  const feeReq = await client.request({ command: "fee", tx_blob: encode({ ...prepared, Fee: "0", SigningPubKey: "" }) });
  prepared.Fee = feeReq.result.drops.base_fee;
  const { tx_blob } = wallet.sign(prepared);
  let result, hash, meta = null;
  try {
    const res = await client.submitAndWait(tx_blob);
    hash = res.result.hash; meta = res.result.meta; result = meta?.TransactionResult ?? res.result.engine_result;
  } catch (e) {
    const m = /(te[cfmlr][A-Z_]+)/.exec(String(e.message ?? e));
    result = m ? m[1] : `error:${e.message}`; hash = e.data?.tx_json?.hash ?? null;
  }
  const hookReturn = meta?.HookExecutions?.map((h) => Buffer.from(h.HookExecution?.HookReturnString ?? "", "hex").toString()) ?? [];
  console.log(`${label.padEnd(44)} ${result.padEnd(20)} ${hash ?? "-"} ${hookReturn.join(" | ")}`);
  return { label, result, hash, hookReturn };
}

function setHookTx(account, wasmHex, expDrops, frozen) {
  return {
    TransactionType: "SetHook", Account: account,
    Hooks: [{ Hook: {
      CreateCode: wasmHex, HookOn: HOOK_ON_PAYMENT, HookNamespace: NAMESPACE, HookApiVersion: 0, Flags: 1,
      HookParameters: [
        { HookParameter: { HookParameterName: hex("EXP"), HookParameterValue: u64hex(expDrops) } },
        { HookParameter: { HookParameterName: hex("FRZ"), HookParameterValue: frozen ? "01" : "00" } },
      ],
    } }],
  };
}

function setParamsTx(account, expDrops, frozen) {
  return {
    TransactionType: "SetHook", Account: account,
    Hooks: [{ Hook: { HookParameters: [
      { HookParameter: { HookParameterName: hex("EXP"), HookParameterValue: u64hex(expDrops) } },
      { HookParameter: { HookParameterName: hex("FRZ"), HookParameterValue: frozen ? "01" : "00" } },
    ] } }],
  };
}

const payment = (from, to, drops) => ({ TransactionType: "Payment", Account: from, Destination: to, Amount: String(drops) });

async function main() {
  const test = process.argv.includes("--test");
  const wasmHex = readFileSync(WASM).toString("hex").toUpperCase();
  const client = new Client(WSS);
  await client.connect();
  const info = await client.request({ command: "server_info" });
  if (info.result.info.network_id !== NETWORK_ID) throw new Error(`refusing network ${info.result.info.network_id}`);
  const w = await loadWallets(client);
  const S = w.servicer.classicAddress, B = w.borrower.classicAddress;
  console.log(`servicer ${S}  borrower ${B}  wasm ${wasmHex.length / 2} bytes  namespace ${NAMESPACE}`);
  const EXP = 1_000_000; // 1 XAH scheduled amount for the proof
  const steps = [];
  const expect = async (label, want, p) => { const r = await p; r.want = want; r.pass = r.result === want; steps.push(r); return r; };

  await expect("install hook (EXP=1 XAH, FRZ=0)", "tesSUCCESS", submit(client, w.servicer, setHookTx(S, wasmHex, EXP, false), "SetHook install"));
  if (test) {
    await expect("payment 0.5 XAH below schedule", "tecHOOK_REJECTED", submit(client, w.borrower, payment(B, S, 500_000), "Payment 0.5"));
    await expect("payment 1 XAH on schedule", "tesSUCCESS", submit(client, w.borrower, payment(B, S, EXP), "Payment 1.0"));
    await expect("freeze (FRZ=1)", "tesSUCCESS", submit(client, w.servicer, setParamsTx(S, EXP, true), "SetHook FRZ=1"));
    await expect("payment 1 XAH while frozen", "tecHOOK_REJECTED", submit(client, w.borrower, payment(B, S, EXP), "Payment frozen"));
    await expect("unfreeze (FRZ=0)", "tesSUCCESS", submit(client, w.servicer, setParamsTx(S, EXP, false), "SetHook FRZ=0"));
    await expect("payment 1 XAH after unfreeze", "tesSUCCESS", submit(client, w.borrower, payment(B, S, EXP), "Payment unfrozen"));
  }
  await client.disconnect();
  const pass = steps.every((s) => s.pass);
  const out = `${OUT_DIR}/xahau-test-${Date.now()}.json`;
  const wasmSha = createHash("sha256").update(readFileSync(WASM)).digest("hex");
  writeFileSync(out, JSON.stringify({ network: WSS, network_id: NETWORK_ID, commit: process.env.GIT_SHA ?? null, wasm_sha256: wasmSha,
    servicer: S, borrower: B, namespace: NAMESPACE, ran_at: new Date().toISOString(), steps, pass }, null, 2));
  console.log(`\n${steps.filter((s) => s.pass).length}/${steps.length} expectations met -> ${out}`);
  console.log(pass ? "XAHAU HOOK FIREWALL PROOF PASSES" : "XAHAU HOOK FIREWALL PROOF FAILED");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error("HALT:", e.message ?? e); process.exit(2); });
