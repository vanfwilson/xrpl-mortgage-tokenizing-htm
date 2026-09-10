import type { Cents } from './apply.js';
import { parseDay } from './dates.js';
export interface VerifiedBill { id: string; purpose: 'tax' | 'hazard'; amountCents: Cents; dueDate: string; payeeId: string; verifiedAt: string }
export interface DisbursementInput { bill: VerifiedBill; availableCents: Cents; borrowerDaysOverdue: number; allowlistedPayeeIds: readonly string[]; asOf?: string; cancelAfterDays?: number }
/** R10/S7 — create a full escrow request; advance first when timely-payment rule applies. */
export function ensureDisbursement(input: DisbursementInput) {
  if (!input.bill.verifiedAt || !input.allowlistedPayeeIds.includes(input.bill.payeeId)) throw new Error('verified allowlisted payee required');
  const due = parseDay(input.bill.dueDate), on = parseDay(input.asOf ?? input.bill.dueDate);
  if (!Number.isSafeInteger(input.bill.amountCents) || input.bill.amountCents <= 0 || !Number.isSafeInteger(input.availableCents) || input.availableCents < 0 || !Number.isInteger(input.borrowerDaysOverdue) || input.borrowerDaysOverdue < 0) throw new RangeError('invalid disbursement inputs');
  if (Number.isNaN(Date.parse(input.bill.verifiedAt)) || Date.parse(input.bill.verifiedAt) > on + 86400000 - 1) throw new Error('bill not yet verified');
  if (due - on > 5 * 86400000) return { status: 'forecast_only', advance: undefined, escrow: undefined } as const;
  const shortfallCents = Math.max(0, input.bill.amountCents - input.availableCents);
  if (shortfallCents && input.borrowerDaysOverdue > 30) return { status: 'manual_review', shortfallCents } as const;
  const advance = shortfallCents ? { amountCents: shortfallCents, reason: 'timely_disbursement' as const } : null;
  if (advance) return { status: 'advance_required', advance, escrow: undefined } as const;
  return { status: 'ready', advance, escrow: { billId: input.bill.id, purpose: input.bill.purpose, amountCents: input.bill.amountCents, finishAfter: input.bill.dueDate, cancelAfter: addDays(input.bill.dueDate, input.cancelAfterDays ?? 45), payeeId: input.bill.payeeId } } as const;
}
/** S7 — immutable escrow amounts require a separately approved adjustment. */
export function correctedBill(original: VerifiedBill, corrected: VerifiedBill) {
  if (original.id !== corrected.id) throw new Error('bill identity mismatch');
  const deltaCents = corrected.amountCents - original.amountCents;
  return deltaCents > 0 ? { action: 'adjustment_escrow_or_advance', deltaCents } : deltaCents < 0 ? { action: 'refund_excess', deltaCents: -deltaCents } : { action: 'none', deltaCents: 0 };
}
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
