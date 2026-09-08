import { ESCROW_INTEREST, addDays, addMonths, daysBetween } from './calendar.js';
import { ESCROW_PURPOSES, type Cents, type EscrowPurpose, type IsoDate, type UsState } from './types.js';

/**
 * Annual escrow account analysis, 12 CFR 1024.17 (R01, R02, R03, R07, R08, R09, R23).
 * Aggregate method: project the account as a whole, month by month, with deposits of one-twelfth of the
 * estimated annual disbursements; the lowest projected balance plus the permitted cushion sets the
 * target starting balance; the difference to the actual starting balance is a surplus, shortage or deficiency.
 */

/** R01: only servicing impound purposes exist. Anything else is refused before it can be booked. */
export function assertEscrowPurpose(p: string): asserts p is EscrowPurpose {
  if (!(ESCROW_PURPOSES as readonly string[]).includes(p)) throw new Error(`R01: '${p}' is not a servicing escrow purpose (12 CFR 1024.17(b)); closing escrow is out of scope`);
}

export interface CushionCaps { state_cap_months?: number; contract_cap_months?: number }

/** R03: cushion may not exceed one-sixth of annual disbursements, or a lower state/contract limit. */
export function cushionLimit(annualDisbursementsCents: Cents, caps: CushionCaps = {}): Cents {
  const monthly = Math.floor(annualDisbursementsCents / 12);
  const candidates = [Math.floor(annualDisbursementsCents / 6)];
  if (caps.state_cap_months !== undefined) candidates.push(Math.floor(monthly * caps.state_cap_months));
  if (caps.contract_cap_months !== undefined) candidates.push(Math.floor(monthly * caps.contract_cap_months));
  return Math.max(0, Math.min(...candidates));
}

export interface ProjectedDisbursement { purpose: EscrowPurpose; due: IsoDate; cents: Cents; description?: string }

export interface AnalysisInput {
  computation_year_start: IsoDate;
  /** Actual escrow balance (tax + hazard) at the start of the computation year; may be negative (deficiency). */
  starting_balance_cents: Cents;
  /** Disbursements expected in the computation year, verified bills preferred, prior-year actuals otherwise. */
  disbursements: ProjectedDisbursement[];
  caps?: CushionCaps;
  borrower_current: boolean;
  state: UsState;
  /** Prior-year daily balances for the California interest credit (date -> balance cents), optional. */
  prior_year_balances?: Array<{ date: IsoDate; balance_cents: Cents }>;
}

export interface TrialBalance { month: number; date: IsoDate; deposit_cents: Cents; disbursed_cents: Cents; balance_cents: Cents }

export type Classification = 'balanced' | 'surplus' | 'shortage' | 'deficiency';

export interface RecoveryOption { kind: 'do_nothing' | 'repay_30_days' | 'equal_monthly_payments'; min_months?: number; cite: string }

export interface EscrowAnalysis {
  computation_year_start: IsoDate;
  computation_year_end: IsoDate;
  annual_disbursements_cents: Cents;
  monthly_deposit_cents: Cents;
  cushion_cents: Cents;
  trial_balances: TrialBalance[];
  lowest_balance_cents: Cents;
  lowest_month: number;
  target_starting_balance_cents: Cents;
  starting_balance_cents: Cents;
  classification: Classification;
  surplus_cents: Cents;
  shortage_cents: Cents;
  deficiency_cents: Cents;
  surplus_action?: { action: 'refund' | 'refund_or_credit'; deadline_days: 30; cite: string };
  shortage_options: RecoveryOption[];
  deficiency_options: RecoveryOption[];
  /** New monthly escrow deposit from the next cycle: 1/12 of disbursements plus any chosen recovery installment. */
  new_monthly_escrow_cents: Cents;
  california_interest_cents: Cents;
  annual_statement_due: IsoDate;
}

/** R07 12 CFR 1024.17(f)(2). */
export function resolveSurplus(surplusCents: Cents, borrowerCurrent: boolean): EscrowAnalysis['surplus_action'] {
  if (surplusCents <= 0) return undefined;
  if (surplusCents >= 5_000 && borrowerCurrent) return { action: 'refund', deadline_days: 30, cite: '12 CFR 1024.17(f)(2)(i): surplus of $50 or more refunded within 30 days' };
  return { action: 'refund_or_credit', deadline_days: 30, cite: '12 CFR 1024.17(f)(2)(ii)/(iii): surplus under $50, or borrower not current, refund or credit against next year' };
}

/** R08 12 CFR 1024.17(f)(3). */
export function shortageOptions(shortageCents: Cents, monthlyEscrowCents: Cents): RecoveryOption[] {
  if (shortageCents <= 0) return [];
  const lessThanOneMonth = shortageCents < monthlyEscrowCents;
  const opts: RecoveryOption[] = [{ kind: 'do_nothing', cite: '12 CFR 1024.17(f)(3)' }];
  if (lessThanOneMonth) opts.push({ kind: 'repay_30_days', cite: '12 CFR 1024.17(f)(3)(i): shortage under one month may be repaid within 30 days' });
  opts.push({ kind: 'equal_monthly_payments', min_months: 12, cite: lessThanOneMonth ? '12 CFR 1024.17(f)(3)(i): or in equal monthly payments over at least 12 months' : '12 CFR 1024.17(f)(3)(ii): shortage of one month or more, equal monthly payments over at least 12 months' });
  return opts;
}

/** R09 12 CFR 1024.17(f)(4). Note: NOT twelve months; two or more equal payments. */
export function deficiencyOptions(deficiencyCents: Cents, monthlyEscrowCents: Cents): RecoveryOption[] {
  if (deficiencyCents <= 0) return [];
  const lessThanOneMonth = deficiencyCents < monthlyEscrowCents;
  const opts: RecoveryOption[] = [{ kind: 'do_nothing', cite: '12 CFR 1024.17(f)(4)' }];
  if (lessThanOneMonth) opts.push({ kind: 'repay_30_days', cite: '12 CFR 1024.17(f)(4)(i): deficiency under one month may be repaid within 30 days' });
  opts.push({ kind: 'equal_monthly_payments', min_months: 2, cite: lessThanOneMonth ? '12 CFR 1024.17(f)(4)(i): or in 2 or more equal monthly payments' : '12 CFR 1024.17(f)(4)(ii): deficiency of one month or more, 2 or more equal monthly payments' });
  return opts;
}

/** R23 Cal. Civ. Code 2954.8: 2 % simple interest per year on the impound balance, credited at least annually. */
export function californiaInterest(balances: Array<{ date: IsoDate; balance_cents: Cents }>, state: UsState, yearEnd: IsoDate): Cents {
  const rule = ESCROW_INTEREST[state];
  if (rule.status !== 'statutory' || rule.annual_rate === 0 || balances.length === 0) return 0;
  const sorted = [...balances].sort((a, b) => a.date.localeCompare(b.date));
  let acc = 0; // cents × days
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i].date;
    const to = i + 1 < sorted.length ? sorted[i + 1].date : addDays(yearEnd, 1);
    const days = Math.max(0, daysBetween(from, to));
    acc += Math.max(0, sorted[i].balance_cents) * days;
  }
  const y = Number(yearEnd.slice(0, 4));
  const yearDays = daysBetween(`${y}-01-01`, `${y + 1}-01-01`);
  return Math.round((acc * rule.annual_rate) / yearDays);
}

export function analyzeEscrowYear(input: AnalysisInput): EscrowAnalysis {
  for (const d of input.disbursements) assertEscrowPurpose(d.purpose);
  const start = input.computation_year_start;
  const end = addDays(addMonths(start, 12), -1);
  const annual = input.disbursements.reduce((a, d) => a + d.cents, 0);
  const monthly = Math.round(annual / 12);
  const cushion = cushionLimit(annual, input.caps);
  // Aggregate projection from a zero opening balance (1024.17(d)(2)(i)(A)-(B)).
  const tb: TrialBalance[] = [];
  let bal = 0;
  for (let m = 0; m < 12; m++) {
    const mStart = addMonths(start, m);
    const mEnd = addDays(addMonths(start, m + 1), -1);
    bal += monthly;
    const disbursed = input.disbursements.filter((d) => d.due >= mStart && d.due <= mEnd).reduce((a, d) => a + d.cents, 0);
    bal -= disbursed;
    tb.push({ month: m + 1, date: mStart, deposit_cents: monthly, disbursed_cents: disbursed, balance_cents: bal });
  }
  const lowest = tb.reduce((min, t) => (t.balance_cents < min.balance_cents ? t : min), tb[0]);
  // 1024.17(d)(2)(i)(C)-(D): raise the opening balance so the lowest month is zero, then add the cushion.
  const target = Math.max(0, -lowest.balance_cents) + cushion;
  const actual = input.starting_balance_cents;
  let classification: Classification = 'balanced';
  let surplus = 0, shortage = 0, deficiency = 0;
  if (actual < 0) { classification = 'deficiency'; deficiency = -actual; shortage = target; }
  else if (actual > target) { classification = 'surplus'; surplus = actual - target; }
  else if (actual < target) { classification = 'shortage'; shortage = target - actual; }
  const california = californiaInterest(input.prior_year_balances ?? [], input.state, addDays(start, -1));
  return {
    computation_year_start: start,
    computation_year_end: end,
    annual_disbursements_cents: annual,
    monthly_deposit_cents: monthly,
    cushion_cents: cushion,
    trial_balances: tb,
    lowest_balance_cents: lowest.balance_cents,
    lowest_month: lowest.month,
    target_starting_balance_cents: target,
    starting_balance_cents: actual,
    classification,
    surplus_cents: surplus,
    shortage_cents: shortage,
    deficiency_cents: deficiency,
    surplus_action: resolveSurplus(surplus, input.borrower_current),
    shortage_options: shortageOptions(shortage, monthly),
    deficiency_options: deficiencyOptions(deficiency, monthly),
    new_monthly_escrow_cents: monthly,
    california_interest_cents: california,
    annual_statement_due: addDays(end, 30),
  };
}

/** Monthly escrow deposit after choosing a recovery option (equal monthly payments over `months`). */
export function escrowDepositWithRecovery(a: EscrowAnalysis, choice: { shortage_months?: number; deficiency_months?: number }): Cents {
  let dep = a.new_monthly_escrow_cents;
  if (a.shortage_cents > 0 && choice.shortage_months) {
    const min = Math.max(...a.shortage_options.filter((o) => o.kind === 'equal_monthly_payments').map((o) => o.min_months ?? 1));
    if (choice.shortage_months < min) throw new RangeError(`R08: shortage recovery must be at least ${min} months`);
    dep += Math.ceil(a.shortage_cents / choice.shortage_months);
  }
  if (a.deficiency_cents > 0 && choice.deficiency_months) {
    const min = Math.max(...a.deficiency_options.filter((o) => o.kind === 'equal_monthly_payments').map((o) => o.min_months ?? 1));
    if (choice.deficiency_months < min) throw new RangeError(`R09: deficiency recovery must be at least ${min} months`);
    dep += Math.ceil(a.deficiency_cents / choice.deficiency_months);
  }
  return dep;
}
