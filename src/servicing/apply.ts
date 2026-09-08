import { addDays, daysBetween } from './calendar.js';
import type { Cents, IsoDate, LoanTerms, Posting, Receipt, ScheduleRow } from './types.js';

/**
 * Monthly payment application (R16 12 CFR 1026.36(c)(1)): a periodic payment is credited as of the day
 * of receipt. Postings are integer cents and must conserve the amount received exactly, or the plan is
 * refused. Partial payments go to suspense; a full periodic payment is never diverted to late charges.
 */
export interface Legs { principal: Cents; interest: Cents; tax: Cents; hazard: Cents; mip: Cents; fees: Cents; suspense_in: Cents; suspense_out: Cents }

export interface ApplicationInput {
  terms: LoanTerms;
  row: ScheduleRow;
  /** Analysed monthly escrow deposit split by purpose (from the current EscrowAnalysis). */
  escrow: { tax: Cents; hazard: Cents };
  mip_cents: Cents;
  receipt: Receipt;
  suspense_balance_cents: Cents;
  fees_outstanding_cents: Cents;
}

export interface ApplicationPlan {
  ok: boolean;
  reason?: string;
  effective_date: IsoDate;
  due_date: IsoDate;
  late: boolean;
  late_charge_assessed_cents: Cents;
  legs: Legs;
  postings: Posting[];
  total_due_cents: Cents;
  received_cents: Cents;
}

export const periodicDue = (i: ApplicationInput) => i.row.interest_cents + i.row.principal_cents + i.escrow.tax + i.escrow.hazard + i.mip_cents;

export function planMonthlyApplication(i: ApplicationInput): ApplicationPlan {
  const effective = i.receipt.received_at.slice(0, 10);
  const due = i.row.due_date;
  const late = daysBetween(due, effective) > i.terms.grace_days;
  const lateCharge = late ? i.terms.late_charge_cents : 0;
  const totalDue = periodicDue(i);
  const available = i.receipt.amount_cents + i.suspense_balance_cents;
  const T = { company_id: i.terms.company_id, loan_id: i.terms.loan_id };
  const post = (account: Posting['account'], cents: Cents, leg: string): Posting => ({ ...T, account, cents, leg, period: i.row.period, effective_date: effective, bank_ref: i.receipt.bank_ref });
  const postings: Posting[] = [post('collection', i.receipt.amount_cents, 'receipt')];
  const legs: Legs = { principal: 0, interest: 0, tax: 0, hazard: 0, mip: 0, fees: 0, suspense_in: 0, suspense_out: 0 };

  if (available < totalDue) {
    // Partial payment: hold in suspense; nothing is applied to the periodic payment (1026.36(c)(1)(ii)).
    legs.suspense_in = i.receipt.amount_cents;
    postings.push(post('collection', -i.receipt.amount_cents, 'to_suspense'), post('suspense', i.receipt.amount_cents, 'partial_payment'));
    return finish(false, `partial payment ${i.receipt.amount_cents} < periodic due ${totalDue}; held in suspense`);
  }
  // Full periodic payment: the receipt first, suspense only tops up what the receipt does not cover.
  legs.suspense_out = Math.min(i.suspense_balance_cents, Math.max(0, totalDue - i.receipt.amount_cents));
  if (legs.suspense_out > 0) postings.push(post('suspense', -legs.suspense_out, 'apply_suspense'), post('collection', legs.suspense_out, 'from_suspense'));
  legs.interest = i.row.interest_cents; legs.principal = i.row.principal_cents; legs.tax = i.escrow.tax; legs.hazard = i.escrow.hazard; legs.mip = i.mip_cents;
  postings.push(
    post('collection', -(legs.interest + legs.principal), 'apply_pi'), post('note_holder', legs.interest, 'interest'), post('note_holder', legs.principal, 'principal'),
    post('collection', -legs.tax, 'apply_tax'), post('tax', legs.tax, 'escrow_deposit'),
    post('collection', -legs.hazard, 'apply_hazard'), post('hazard', legs.hazard, 'escrow_deposit'),
    post('collection', -legs.mip, 'apply_mip'), post('mip', legs.mip, 'mip_deposit'),
  );
  // Excess of the receipt over the periodic payment: fees outstanding first (incl. this period's late charge), then suspense.
  let excess = Math.max(0, i.receipt.amount_cents - totalDue);
  const feesDue = i.fees_outstanding_cents + lateCharge;
  const feePay = Math.min(excess, feesDue);
  if (feePay > 0) { legs.fees = feePay; postings.push(post('collection', -feePay, 'apply_fees'), post('fees', feePay, 'fees_paid')); excess -= feePay; }
  if (excess > 0) { legs.suspense_in = excess; postings.push(post('collection', -excess, 'to_suspense'), post('suspense', excess, 'excess')); }
  return finish(true);

  function finish(ok: boolean, reason?: string): ApplicationPlan {
    // Conservation: net collection movement equals receipt minus everything moved out; every leg accounted for.
    const net = postings.reduce((a, p) => a + p.cents, 0);
    if (net !== i.receipt.amount_cents) throw new Error(`conservation failure: postings net ${net} != receipt ${i.receipt.amount_cents}`);
    const applied = legs.principal + legs.interest + legs.tax + legs.hazard + legs.mip + legs.fees + legs.suspense_in - legs.suspense_out;
    if (ok && applied !== i.receipt.amount_cents) throw new Error(`conservation failure: legs ${applied} != receipt ${i.receipt.amount_cents}`);
    return { ok, reason, effective_date: effective, due_date: due, late, late_charge_assessed_cents: lateCharge, legs, postings, total_due_cents: totalDue, received_cents: i.receipt.amount_cents };
  }
}

/** Build the fixed-P&I schedule in cents with due dates (period 1 = first_payment_date). */
export function scheduleCents(terms: LoanTerms): ScheduleRow[] {
  const r = terms.annual_rate / 12;
  let bal = terms.note_amount_cents;
  const rows: ScheduleRow[] = [];
  for (let p = 1; p <= terms.term_months; p++) {
    const interest = Math.round(bal * r);
    let principal = terms.monthly_pi_cents - interest;
    if (p === terms.term_months) principal = bal;
    bal -= principal;
    const due = p === 1 ? terms.first_payment_date : dueDate(terms.first_payment_date, p - 1, terms.payment_due_day);
    rows.push({ period: p, due_date: due, interest_cents: interest, principal_cents: principal, balance_after_cents: Math.max(bal, 0) });
  }
  return rows;
}
function dueDate(first: IsoDate, monthsAhead: number, day: number): IsoDate {
  const d = new Date(first + 'T00:00:00Z');
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + monthsAhead, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t.toISOString().slice(0, 10);
}
export const daysOverdue = (due: IsoDate, asOf: IsoDate) => Math.max(0, daysBetween(due, asOf));
export const graceEnd = (due: IsoDate, graceDays: number) => addDays(due, graceDays);
