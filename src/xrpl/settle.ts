import type { Memo, Payment } from 'xrpl';
import { hex } from './client.js';
export type SettlementLeg = 'pi' | 'tax' | 'hazard' | 'mip' | 'advance' | 'refund';
export interface SettlementMemo { v: 1; loan: string; period: string; leg: SettlementLeg; cents: number; run: string }
export function buildSettlementMemo(m: SettlementMemo): Memo {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(m.loan) || !/^\d{4}-\d{2}$/.test(m.period) || !Number.isSafeInteger(m.cents) || m.cents < 0 || !/^[A-Za-z0-9_-]{1,64}$/.test(m.run)) throw new Error('invalid non-PII settlement memo');
  if (m.v !== 1 || !['pi','tax','hazard','mip','advance','refund'].includes(m.leg)) throw new Error('unsupported memo version/leg');
  // Explicit projection prevents extra runtime JSON keys from leaking PII.
  const json = JSON.stringify({ v: 1, loan: m.loan, period: m.period, leg: m.leg, cents: m.cents, run: m.run }); if (Buffer.byteLength(json) > 256) throw new RangeError('memo exceeds 256 bytes');
  return { Memo: { MemoType: hex('htm/settlement'), MemoFormat: hex('application/json'), MemoData: hex(json) } };
}
/** S10/S11 — each exact-cent leg is independent and shares the run id. */
export function buildIssuedUsdPayment(account: string, destination: string, issuer: string, memo: SettlementMemo): Payment {
  return { TransactionType: 'Payment', Account: account, Destination: destination, Amount: { currency: 'USD', issuer, value: (memo.cents / 100).toFixed(2) }, Memos: [buildSettlementMemo(memo)] };
}
export interface LegSubmission { leg: SettlementLeg; txHash?: string; status: 'planned' | 'validated' | 'failed' }
export function compensationPlan(legs: readonly LegSubmission[]) { return legs.filter((l) => l.status !== 'validated').map((l) => ({ leg: l.leg, action: 'retry_with_same_run_id' as const })); }
