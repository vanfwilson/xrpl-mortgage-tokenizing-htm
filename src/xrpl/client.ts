import fs from 'node:fs';
import path from 'node:path';
import { Client, Wallet, type IssuedCurrencyAmount, type SubmittableTransaction, type TransactionMetadata } from 'xrpl';
import { config, WALLET_ROLES, type Role } from '../config.js';

export const RIPPLE_EPOCH = 946_684_800;
export const toRippleTime = (unixSec: number) => Math.floor(unixSec) - RIPPLE_EPOCH;
export const fromRippleTime = (rippleSec: number) => rippleSec + RIPPLE_EPOCH;
export const nowRipple = () => toRippleTime(Date.now() / 1000);

export const hex = (s: string) => Buffer.from(s, 'utf8').toString('hex').toUpperCase();
export const unhex = (h: string) => Buffer.from(h, 'hex').toString('utf8');
export const xrpToDrops = (xrp: number) => String(Math.round(xrp * 1_000_000));

/** Exact-cent issued-currency amount. Never XRP for servicing money (S5). */
export const usdAmount = (issuer: string, cents: number): IssuedCurrencyAmount => {
  if (!Number.isInteger(cents) || cents <= 0) throw new RangeError(`amount must be positive integer cents, got ${cents}`);
  return { currency: config.settlement.currency, issuer, value: (cents / 100).toFixed(2) };
};

export type Wallets = Record<Role, Wallet>;

export async function connect(): Promise<Client> {
  const client = new Client(config.wss);
  await client.connect();
  return client;
}

/** Fund (or reload) one test-network wallet per role. Seeds persist in out/wallets.<network>.json (gitignored). */
export async function loadOrFundWallets(client: Client, log = console.log): Promise<Wallets> {
  fs.mkdirSync(path.dirname(config.walletsFile), { recursive: true });
  let seeds: Partial<Record<Role, string>> = {};
  if (fs.existsSync(config.walletsFile)) seeds = JSON.parse(fs.readFileSync(config.walletsFile, 'utf8'));
  const wallets = {} as Wallets;
  for (const role of WALLET_ROLES) {
    const seed = seeds[role];
    if (seed) { wallets[role] = Wallet.fromSeed(seed); continue; }
    const { wallet } = await client.fundWallet();
    wallets[role] = wallet;
    seeds[role] = wallet.seed!;
    log(`  funded ${role.padEnd(18)} ${wallet.classicAddress}`);
    fs.writeFileSync(config.walletsFile, JSON.stringify(seeds, null, 2));
  }
  // Reused wallets drain over repeated runs (reserves, fees); top up below 40 XRP.
  for (const role of WALLET_ROLES) {
    let drops = 0;
    try { drops = Math.round(Number(await client.getXrpBalance(wallets[role].classicAddress)) * 1_000_000); } catch { /* unfunded */ }
    if (drops < 40_000_000) {
      try { await client.fundWallet(wallets[role]); log(`  topped up ${role.padEnd(15)} ${wallets[role].classicAddress}`); }
      catch { if (drops < 15_000_000) throw new Error(`${role} has ${drops / 1e6} XRP and the faucet refused a top-up; retry later`); log(`  faucet busy; ${role} continues with ${drops / 1e6} XRP`); }
    }
  }
  return wallets;
}

export interface TxRecord {
  step: string;
  type: string;
  account: string;
  hash: string;
  result: string;
  explorer: string;
  ledgerIndex?: number;
  sequence?: number;
  meta?: TransactionMetadata;
}

export class TxError extends Error {
  constructor(public readonly record: TxRecord) { super(`${record.type} failed with ${record.result} (${record.explorer})`); }
}

/** Autofill, sign, submit, wait, and require tesSUCCESS. */
export async function submit<T extends SubmittableTransaction>(client: Client, wallet: Wallet, tx: T, step: string): Promise<TxRecord> {
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const rec = await submitBlob(client, signed.tx_blob, step, tx.TransactionType, tx.Account);
  rec.sequence = (prepared as { Sequence?: number }).Sequence;
  return rec;
}

export async function submitBlob(client: Client, txBlob: string, step: string, type: string, account: string): Promise<TxRecord> {
  const res = await client.submitAndWait(txBlob);
  const meta = res.result.meta as TransactionMetadata | undefined;
  const result = typeof meta === 'object' && meta ? meta.TransactionResult : 'unknown';
  const record: TxRecord = { step, type, account, hash: res.result.hash, result, explorer: `${config.explorer}/transactions/${res.result.hash}`, ledgerIndex: res.result.ledger_index, meta };
  if (result !== 'tesSUCCESS') throw new TxError(record);
  return record;
}

/** Submit expecting a specific failure (used by the key drill and the early-finish proof). */
export async function submitExpectingFailure<T extends SubmittableTransaction>(client: Client, wallet: Wallet, tx: T, step: string): Promise<TxRecord> {
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  try {
    const res = await client.submitAndWait(signed.tx_blob);
    const meta = res.result.meta as TransactionMetadata | undefined;
    const result = typeof meta === 'object' && meta ? meta.TransactionResult : 'unknown';
    return { step, type: tx.TransactionType, account: tx.Account, hash: res.result.hash, result, explorer: `${config.explorer}/transactions/${res.result.hash}`, ledgerIndex: res.result.ledger_index, meta };
  } catch (e) {
    // Non-tes results that never reach a validated ledger surface as thrown errors in xrpl.js.
    const msg = e instanceof Error ? e.message : String(e);
    const m = msg.match(/\b(te[cfmls][A-Z_]+)\b/);
    return { step, type: tx.TransactionType, account: tx.Account, hash: '', result: m ? m[1] : `rejected: ${msg.slice(0, 80)}`, explorer: '' };
  }
}

export function createdNodeId(meta: TransactionMetadata | undefined, entryType: string): string {
  const node = meta?.AffectedNodes.find((n) => 'CreatedNode' in n && n.CreatedNode.LedgerEntryType === entryType);
  if (!node || !('CreatedNode' in node)) throw new Error(`No CreatedNode of type ${entryType} in transaction metadata`);
  return node.CreatedNode.LedgerIndex;
}

export async function ledgerEntry<T = Record<string, unknown>>(client: Client, index: string): Promise<T> {
  const res = await client.request({ command: 'ledger_entry', index, ledger_index: 'validated' });
  return res.result.node as unknown as T;
}

export async function accountFlags(client: Client, address: string): Promise<Record<string, boolean>> {
  const res = await client.request({ command: 'account_info', account: address, ledger_index: 'validated' });
  return ((res.result as { account_flags?: Record<string, boolean> }).account_flags) ?? {};
}

export async function usdBalance(client: Client, address: string, issuer: string): Promise<number> {
  const res = await client.request({ command: 'account_lines', account: address, peer: issuer, ledger_index: 'validated' });
  const line = res.result.lines.find((l) => l.currency === config.settlement.currency);
  return line ? Math.round(Number(line.balance) * 100) : 0;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait until the validated ledger's close time is safely past a Ripple-epoch instant. rippled compares the
 * parent ledger's close time STRICTLY against FinishAfter/CancelAfter, and close times are rounded to a
 * 10-second resolution, so a margin is required before an EscrowFinish or EscrowCancel is submitted.
 */
export const LEDGER_TIME_MARGIN = 12;
export async function waitForLedgerTime(client: Client, rippleTime: number, log?: (m: string) => void): Promise<void> {
  for (;;) {
    const res = await client.request({ command: 'ledger', ledger_index: 'validated' });
    const close = (res.result.ledger as { close_time: number }).close_time;
    if (close >= rippleTime + LEDGER_TIME_MARGIN) return;
    log?.(`    waiting for ledger time ${rippleTime - close}s`);
    await sleep(Math.min(10_000, Math.max(2_000, (rippleTime - close) * 1000)));
  }
}
