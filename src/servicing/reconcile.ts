import { sha256Hex } from '../domain/hash.js';
import type { Cents, IsoInstant, Tenant } from './types.js';

/**
 * R14 12 CFR 1024.38(b)(1)(i): records that reconcile. R22 HUD 4000.1: bank custodial balances are the
 * legally operative cash; the subledger and the ledger must agree with them, never the other way round.
 */
export interface Entry { ref: string; cents: Cents }
export interface ThreeWayInput { bank: Entry[]; subledger: Entry[]; ledger: Entry[] }
export interface ThreeWayResult {
  matched: Array<{ ref: string; cents: Cents }>;
  unmatched: Array<{ ref: string; bank?: Cents; subledger?: Cents; ledger?: Cents }>;
  totals: { bank: Cents; subledger: Cents; ledger: Cents };
  authoritative_balance_cents: Cents; // bank
  reconciled: boolean;
}

export function threeWayMatch(i: ThreeWayInput): ThreeWayResult {
  const idx = (es: Entry[]) => new Map(es.map((e) => [e.ref, e.cents] as const));
  const b = idx(i.bank), s = idx(i.subledger), l = idx(i.ledger);
  const refs = new Set([...b.keys(), ...s.keys(), ...l.keys()]);
  const matched: ThreeWayResult['matched'] = [];
  const unmatched: ThreeWayResult['unmatched'] = [];
  for (const ref of refs) {
    const bv = b.get(ref), sv = s.get(ref), lv = l.get(ref);
    if (bv !== undefined && sv !== undefined && lv !== undefined && bv === sv && sv === lv) matched.push({ ref, cents: bv });
    else unmatched.push({ ref, bank: bv, subledger: sv, ledger: lv });
  }
  const sum = (es: Entry[]) => es.reduce((a, e) => a + e.cents, 0);
  const totals = { bank: sum(i.bank), subledger: sum(i.subledger), ledger: sum(i.ledger) };
  return { matched, unmatched, totals, authoritative_balance_cents: totals.bank, reconciled: unmatched.length === 0 };
}

export function assertReconciled(r: ThreeWayResult): void {
  if (!r.reconciled) throw new Error(`R14: ${r.unmatched.length} unreconciled item(s): ${r.unmatched.map((u) => `${u.ref} bank=${u.bank ?? '-'} sub=${u.subledger ?? '-'} ledger=${u.ledger ?? '-'}`).join('; ')}`);
}

/** Append-only, hash-chained reconciliation event. */
export interface ReconciliationEvent extends Tenant { at: IsoInstant; result: ThreeWayResult; prev_hash: string; hash: string }
export function appendReconciliationEvent(prev: ReconciliationEvent | undefined, t: Tenant, at: IsoInstant, result: ThreeWayResult): ReconciliationEvent {
  const prev_hash = prev?.hash ?? '0'.repeat(64);
  const hash = sha256Hex(prev_hash + JSON.stringify({ ...t, at, result }));
  return { ...t, at, result, prev_hash, hash };
}
export function verifyChain(events: ReconciliationEvent[]): boolean {
  let prev = '0'.repeat(64);
  for (const e of events) {
    if (e.prev_hash !== prev) return false;
    const { hash, prev_hash, ...rest } = e; void prev_hash;
    if (sha256Hex(prev + JSON.stringify(rest)) !== hash) return false;
    prev = hash;
  }
  return true;
}
