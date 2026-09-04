import fs from 'node:fs';
import path from 'node:path';
import { Client, Wallet, type SubmittableTransaction, type TransactionMetadata } from 'xrpl';
import { config, WALLET_ROLES, type Role } from '../config.js';

export const RIPPLE_EPOCH = 946_684_800;
export const toRippleTime = (unixSec: number) => Math.floor(unixSec) - RIPPLE_EPOCH;
export const fromRippleTime = (rippleSec: number) => rippleSec + RIPPLE_EPOCH;
export const nowRipple = () => toRippleTime(Date.now() / 1000);

export const hex = (s: string) => Buffer.from(s, 'utf8').toString('hex').toUpperCase();
export const unhex = (h: string) => Buffer.from(h, 'hex').toString('utf8');
export const xrpToDrops = (xrp: number) => String(Math.round(xrp * 1_000_000));
export const usdToDrops = (usd: number) => xrpToDrops(usd / config.usdPerXrp);

export type Wallets = Record<Role, Wallet>;

export async function connect(): Promise<Client> {
  const client = new Client(config.wss);
  await client.connect();
  return client;
}

/** Fund (or reload) one Devnet wallet per role. Seeds persist in out/wallets.json. */
export async function loadOrFundWallets(client: Client, log = console.log): Promise<Wallets> {
  fs.mkdirSync(path.dirname(config.walletsFile), { recursive: true });
  let seeds: Partial<Record<Role, string>> = {};
  if (fs.existsSync(config.walletsFile)) {
    seeds = JSON.parse(fs.readFileSync(config.walletsFile, 'utf8'));
  }
  const wallets = {} as Wallets;
  for (const role of WALLET_ROLES) {
    const seed = seeds[role];
    if (seed) {
      wallets[role] = Wallet.fromSeed(seed);
      continue;
    }
    const { wallet } = await client.fundWallet();
    wallets[role] = wallet;
    seeds[role] = wallet.seed!;
    log(`  funded ${role.padEnd(11)} ${wallet.classicAddress}`);
  }
  fs.writeFileSync(config.walletsFile, JSON.stringify(seeds, null, 2));
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
  meta?: TransactionMetadata;
}

export class TxError extends Error {
  constructor(public readonly record: TxRecord) {
    super(`${record.type} failed with ${record.result} (${record.explorer})`);
  }
}

/** Autofill, sign, submit, wait, and require tesSUCCESS. */
export async function submit<T extends SubmittableTransaction>(
  client: Client,
  wallet: Wallet,
  tx: T,
  step: string,
): Promise<TxRecord> {
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  return submitBlob(client, signed.tx_blob, step, tx.TransactionType, tx.Account);
}

export async function submitBlob(
  client: Client,
  txBlob: string,
  step: string,
  type: string,
  account: string,
): Promise<TxRecord> {
  const res = await client.submitAndWait(txBlob);
  const meta = res.result.meta as TransactionMetadata | undefined;
  const result = typeof meta === 'object' && meta ? meta.TransactionResult : 'unknown';
  const record: TxRecord = {
    step,
    type,
    account,
    hash: res.result.hash,
    result,
    explorer: `${config.explorer}/transactions/${res.result.hash}`,
    ledgerIndex: res.result.ledger_index,
    meta,
  };
  if (result !== 'tesSUCCESS') throw new TxError(record);
  return record;
}

/** LedgerIndex of the node this transaction created with the given entry type. */
export function createdNodeId(meta: TransactionMetadata | undefined, entryType: string): string {
  const node = meta?.AffectedNodes.find(
    (n) => 'CreatedNode' in n && n.CreatedNode.LedgerEntryType === entryType,
  );
  if (!node || !('CreatedNode' in node)) {
    throw new Error(`No CreatedNode of type ${entryType} in transaction metadata`);
  }
  return node.CreatedNode.LedgerIndex;
}

export async function ledgerEntry<T = Record<string, unknown>>(client: Client, index: string): Promise<T> {
  const res = await client.request({ command: 'ledger_entry', index, ledger_index: 'validated' });
  return res.result.node as unknown as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
