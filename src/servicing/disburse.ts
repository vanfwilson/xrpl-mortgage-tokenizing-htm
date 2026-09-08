import { addDays, rippleTimeAt } from './calendar.js';
import type { Cents, IsoDate, VerifiedBill } from './types.js';

/**
 * Impound disbursement gate (R10 12 CFR 1024.17(k)(1); S7 escrow economics).
 * A ledger escrow is built only for a verified, fully funded, near-term bill. If the purpose balance is
 * short and the borrower is not more than 30 days overdue, the servicer advances the shortfall first.
 */
export interface DisbursementInput {
  bill: VerifiedBill;
  purpose_balance_cents: Cents;
  borrower_days_overdue: number;
  escrows_in_flight: number;
  max_in_flight: number;
  today: IsoDate;
  cancel_after_days: number;
  /** Bills further out than this are forecast only; no object is created. */
  near_term_days?: number;
}

export type DisbursementAction = 'escrow' | 'advance_then_escrow' | 'advance_optional' | 'forecast_only' | 'refuse';

export interface DisbursementDecision {
  action: DisbursementAction;
  reason: string;
  cite: string;
  advance_cents: Cents;
  escrow_cents: Cents;
  finish_after?: number;
  cancel_after?: number;
  finish_after_date?: IsoDate;
  cancel_after_date?: IsoDate;
}

export function ensureDisbursement(i: DisbursementInput): DisbursementDecision {
  const near = i.near_term_days ?? 120;
  const base = { advance_cents: 0, escrow_cents: 0 };
  if (!i.bill.verified) return { action: 'refuse', reason: 'bill is a forecast, not a verified payee document', cite: 'S7: forecasts alone cannot create a production escrow', ...base };
  if (i.bill.cents <= 0) return { action: 'refuse', reason: 'non-positive bill', cite: 'S7', ...base };
  const daysToDue = Math.round((Date.parse(i.bill.due_date) - Date.parse(i.today)) / 86_400_000);
  if (daysToDue > near) return { action: 'forecast_only', reason: `due in ${daysToDue} days; outside the ${near}-day near-term window`, cite: 'S7: rolling forecast, objects only for near-term bills', ...base };
  if (i.escrows_in_flight >= i.max_in_flight) return { action: 'refuse', reason: `${i.escrows_in_flight} escrows already in flight (max ${i.max_in_flight})`, cite: 'S7', ...base };
  const shortfall = Math.max(0, i.bill.cents - i.purpose_balance_cents);
  const finish_after_date = i.bill.due_date;
  const cancel_after_date = addDays(i.bill.due_date, i.cancel_after_days);
  const times = { finish_after: rippleTimeAt(finish_after_date), cancel_after: rippleTimeAt(cancel_after_date), finish_after_date, cancel_after_date };
  if (shortfall === 0) return { action: 'escrow', reason: 'purpose balance covers the verified bill', cite: '12 CFR 1024.17(k)(1)', advance_cents: 0, escrow_cents: i.bill.cents, ...times };
  if (i.borrower_days_overdue <= 30) {
    return { action: 'advance_then_escrow', reason: `balance short by ${shortfall}; borrower ${i.borrower_days_overdue} days overdue (≤ 30) so the servicer must pay on time`, cite: '12 CFR 1024.17(k)(1): pay disbursements timely as long as the borrower is not more than 30 days overdue; deficiency recovery per (f)(4)', advance_cents: shortfall, escrow_cents: i.bill.cents, ...times };
  }
  return { action: 'advance_optional', reason: `balance short by ${shortfall}; borrower ${i.borrower_days_overdue} days overdue (> 30): timely-payment duty does not apply, servicer policy decides`, cite: '12 CFR 1024.17(k)(1)', advance_cents: shortfall, escrow_cents: i.bill.cents, ...times };
}

/** S7: FinishAfter is immutable, so a corrected bill after creation is handled by a second object or a refund. */
export function correctedBill(existingEscrowCents: Cents, correctedCents: Cents): { action: 'none' | 'adjustment_escrow' | 'finish_and_refund'; delta_cents: Cents; cite: string } {
  const delta = correctedCents - existingEscrowCents;
  if (delta === 0) return { action: 'none', delta_cents: 0, cite: 'S7' };
  if (delta > 0) return { action: 'adjustment_escrow', delta_cents: delta, cite: 'S7: increase -> second escrow or advance; the original FinishAfter cannot be amended' };
  return { action: 'finish_and_refund', delta_cents: delta, cite: 'S7: decrease -> finish the original, refund the excess through the refund payable' };
}
