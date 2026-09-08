import type { Memo, Payment } from 'xrpl';
import type { Role } from '../config.js';
import { record, type Ctx } from '../steps/context.js';
import { hex, submit, usdAmount } from './client.js';

/**
 * S10/S11: exact-cent issued-USD settlement events with a versioned memo (≤ 256 bytes, no PII) and an
 * idempotency key. Legs are independent transactions; they are never described as atomic.
 */
export type Leg = 'receipt' | 'pi' | 'tax' | 'hazard' | 'mip' | 'mip_remit' | 'advance' | 'refund' | 'initial_deposit';
export interface LegMemo { v: 1; loan: string; period: string; leg: Leg; cents: number; run: string }

export const MAX_MEMO_BYTES = 256;
export const FORBIDDEN_MEMO_KEYS = ['name', 'address', 'street', 'city', 'zip', 'ssn', 'apn', 'parcel', 'policy', 'case', 'fha', 'borrower', 'email', 'phone', 'legal_description', 'county_account'];
const ALLOWED_KEYS = new Set(['v', 'loan', 'period', 'leg', 'cents', 'run']);

/** Recursive PII guard for anything that becomes a memo, URI or Data field. */
export function assertNoPii(obj: unknown, path = ''): void {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = k.toLowerCase();
      if (FORBIDDEN_MEMO_KEYS.some((f) => key === f || key.includes(f))) throw new Error(`S10: field '${path}${k}' may not reach the ledger`);
      assertNoPii(v, `${path}${k}.`);
    }
  }
}

export function buildMemo(m: LegMemo): Memo[] {
  for (const k of Object.keys(m)) if (!ALLOWED_KEYS.has(k)) throw new Error(`S10: memo key '${k}' not allowed`);
  assertNoPii(m);
  if (!Number.isInteger(m.cents) || m.cents < 0) throw new RangeError('memo cents must be a non-negative integer');
  if (!/^\d{4}-\d{2}$/.test(m.period) && m.period !== 'boarding') throw new RangeError('period must be YYYY-MM or boarding');
  const json = JSON.stringify({ v: 1, loan: m.loan, period: m.period, leg: m.leg, cents: m.cents, run: m.run });
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > MAX_MEMO_BYTES) throw new RangeError(`memo is ${bytes} bytes; limit ${MAX_MEMO_BYTES}`);
  return [{ Memo: { MemoType: hex('htm/servicing'), MemoData: hex(json) } }];
}

/** One exact-cent Payment leg. Re-submitting the same idempotency key returns the first hash without a new transaction. */
export async function settlePayment(ctx: Ctx, from: Role, to: Role, cents: number, memo: LegMemo, idempotencyKey: string): Promise<string> {
  ctx.settled ??= new Map<string, string>();
  const prior = ctx.settled.get(idempotencyKey);
  if (prior) { ctx.log(`    ${memo.leg.padEnd(12)} idempotent replay ${idempotencyKey} -> ${prior.slice(0, 12)}…`); return prior; }
  const { client, wallets } = ctx;
  const tx: Payment = { TransactionType: 'Payment', Account: wallets[from].classicAddress, Destination: wallets[to].classicAddress, Amount: usdAmount(wallets.issuer.classicAddress, cents), Memos: buildMemo(memo) };
  const r = record(ctx, await submit(client, wallets[from], tx, `servicing:${memo.leg}`));
  ctx.settled.set(idempotencyKey, r.hash);
  return r.hash;
}
