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

export interface RecoveryOption { kind: 'do_nothing' | 'repay_30_days' | 'equal_monthly_payments' | 'loan_document_review'; min_months?: number; cite: string }

/**
 * Elections the servicer may offer on the annual statement. `loan_document_review` is the only option when the
 * borrower is not current and the account is not balanced: 12 CFR 1024.17(f)(2)(iii) / (f)(3) / (f)(4) let the
 * servicer follow the loan documents instead of the regulatory refund/recovery menu.
 */
export type Election = 'do_nothing' | 'refund_30_days' | 'credit_next_year' | 'collect_30_days' | 'equal_monthly_payments' | 'loan_document_review';

const LOAN_DOCUMENT_REVIEW: RecoveryOption = { kind: 'loan_document_review', cite: '12 CFR 1024.17(f)(2)(iii), (f)(3), (f)(4): borrower not current, servicer may follow the loan documents' };

export interface EscrowAnalysis {
  computation_year_start: IsoDate;
  computation_year_end: IsoDate;
  annual_disbursements_cents: Cents;
  /** ceil(annual / 12); the twelfth deposit carries `final_month_adjustment_cents` so the twelve sum exactly to annual. */
  monthly_deposit_cents: Cents;
  /** Non-positive cents added to the month-12 deposit: annual - 12 * monthly_deposit_cents. */
  final_month_adjustment_cents: Cents;
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
  /** Elections permitted for this analysis (input to `resolveAnalysis`). */
  options: Election[];
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

/** Twelve deposits that sum exactly to `annual`: ceil(annual/12) each, with the rounding residue taken out of month 12. */
export function monthlyDeposits(annual: Cents): { monthly: Cents; final_month_adjustment: Cents; deposits: Cents[] } {
  const monthly = Math.ceil(annual / 12);
  const final_month_adjustment = annual - monthly * 12; // 0 or negative, never below -11
  const deposits = Array.from({ length: 12 }, (_, m) => monthly + (m === 11 ? final_month_adjustment : 0));
  return { monthly, final_month_adjustment, deposits };
}

/** Elections permitted under 1024.17(f), keyed off the classification and whether the borrower is current. */
export function permittedElections(a: Pick<EscrowAnalysis, 'classification' | 'surplus_cents' | 'shortage_cents' | 'deficiency_cents' | 'monthly_deposit_cents'>, borrowerCurrent: boolean): Election[] {
  if (a.classification === 'balanced') return ['do_nothing'];
  if (!borrowerCurrent) return ['loan_document_review'];
  const monthly = a.monthly_deposit_cents;
  if (a.classification === 'surplus') return a.surplus_cents >= 5_000 ? ['refund_30_days'] : ['refund_30_days', 'credit_next_year'];
  if (a.classification === 'deficiency') return a.deficiency_cents < monthly ? ['do_nothing', 'collect_30_days', 'equal_monthly_payments'] : ['do_nothing', 'equal_monthly_payments'];
  return a.shortage_cents < monthly ? ['do_nothing', 'collect_30_days', 'equal_monthly_payments'] : ['do_nothing', 'equal_monthly_payments'];
}

export function analyzeEscrowYear(input: AnalysisInput): EscrowAnalysis {
  for (const d of input.disbursements) {
    assertEscrowPurpose(d.purpose);
    if (!Number.isSafeInteger(d.cents) || d.cents < 0) throw new RangeError(`R02: disbursement cents must be a non-negative integer (${d.purpose} ${d.due})`);
  }
  if (!Number.isSafeInteger(input.starting_balance_cents)) throw new RangeError('R02: starting balance must be integer cents');
  const start = input.computation_year_start;
  const end = addDays(addMonths(start, 12), -1);
  const annual = input.disbursements.reduce((a, d) => a + d.cents, 0);
  const { monthly, final_month_adjustment, deposits } = monthlyDeposits(annual);
  const cushion = cushionLimit(annual, input.caps);
  // Aggregate projection from a zero opening balance (1024.17(d)(2)(i)(A)-(B)).
  const tb: TrialBalance[] = [];
  let bal = 0;
  for (let m = 0; m < 12; m++) {
    const mStart = addMonths(start, m);
    const mEnd = addDays(addMonths(start, m + 1), -1);
    bal += deposits[m];
    const disbursed = input.disbursements.filter((d) => d.due >= mStart && d.due <= mEnd).reduce((a, d) => a + d.cents, 0);
    bal -= disbursed;
    tb.push({ month: m + 1, date: mStart, deposit_cents: deposits[m], disbursed_cents: disbursed, balance_cents: bal });
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
  const delinquentUnbalanced = !input.borrower_current && classification !== 'balanced';
  const options = permittedElections({ classification, surplus_cents: surplus, shortage_cents: shortage, deficiency_cents: deficiency, monthly_deposit_cents: monthly }, input.borrower_current);
  return {
    computation_year_start: start,
    computation_year_end: end,
    annual_disbursements_cents: annual,
    monthly_deposit_cents: monthly,
    final_month_adjustment_cents: final_month_adjustment,
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
    shortage_options: delinquentUnbalanced && shortage > 0 ? [LOAN_DOCUMENT_REVIEW] : shortageOptions(shortage, monthly),
    deficiency_options: delinquentUnbalanced && deficiency > 0 ? [LOAN_DOCUMENT_REVIEW] : deficiencyOptions(deficiency, monthly),
    options,
    new_monthly_escrow_cents: monthly,
    california_interest_cents: california,
    annual_statement_due: addDays(end, 30),
  };
}

export interface Installment { month: number; due: IsoDate; amount_cents: Cents }

/** Equal installments that conserve cents: floor share each, the one-cent residue on the earliest installments. */
export function equalInstallments(totalCents: Cents, months: number, firstDue: IsoDate): Installment[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new RangeError('installments: total must be non-negative integer cents');
  if (!Number.isInteger(months) || months < 1) throw new RangeError('installments: months must be a positive integer');
  const base = Math.floor(totalCents / months), remainder = totalCents % months;
  return Array.from({ length: months }, (_, i) => ({ month: i + 1, due: addMonths(firstDue, i), amount_cents: base + (i < remainder ? 1 : 0) }));
}

export type AnalysisResolution =
  | { status: 'unchanged'; election: 'do_nothing'; new_monthly_escrow_cents: Cents; cite: string }
  | { status: 'manual_review'; election: 'loan_document_review'; cite: string }
  | { status: 'scheduled'; election: 'refund_30_days' | 'collect_30_days'; direction: 'refund' | 'collect'; amount_cents: Cents; due_by: IsoDate; cite: string }
  | { status: 'scheduled'; election: 'credit_next_year'; direction: 'credit'; amount_cents: Cents; installments: Installment[]; new_monthly_escrow_cents: Cents; cite: string }
  | {
      status: 'scheduled'; election: 'equal_monthly_payments'; direction: 'collect'; basis: 'shortage' | 'deficiency'; amount_cents: Cents; months: number;
      installments: Installment[];
      /** In a deficiency case the shortage (to the target balance) is recovered separately over at least 12 months (1024.17(f)(3)). */
      shortage_installments?: Installment[];
      /** Base deposit plus the first installment(s): what the borrower pays from the next cycle. */
      new_monthly_escrow_cents: Cents;
      rounding: string; cite: string;
    };

/**
 * Apply an election to an analysis. Installment schedules conserve cents exactly (sum === amount); the 30-day
 * options carry a due date; `months` is the recovery term for equal monthly payments (min 12 shortage / 2 deficiency).
 */
export function resolveAnalysis(analysis: EscrowAnalysis, election: Election, on: IsoDate, months?: number): AnalysisResolution {
  if (!analysis.options.includes(election)) throw new Error(`R07/R08/R09: election '${election}' is not permitted for this analysis (allowed: ${analysis.options.join(', ')})`);
  const nextCycle = addMonths(on, 1);
  switch (election) {
    case 'loan_document_review':
      return { status: 'manual_review', election, cite: LOAN_DOCUMENT_REVIEW.cite };
    case 'do_nothing':
      return { status: 'unchanged', election, new_monthly_escrow_cents: analysis.new_monthly_escrow_cents, cite: analysis.classification === 'balanced' ? '12 CFR 1024.17(f)(1)' : '12 CFR 1024.17(f)(3)/(f)(4): servicer may do nothing to recover' };
    case 'refund_30_days':
      return { status: 'scheduled', election, direction: 'refund', amount_cents: analysis.surplus_cents, due_by: addDays(on, 30), cite: '12 CFR 1024.17(f)(2)(i): refund within 30 days' };
    case 'collect_30_days': {
      const amount = analysis.classification === 'deficiency' ? analysis.deficiency_cents : analysis.shortage_cents;
      return { status: 'scheduled', election, direction: 'collect', amount_cents: amount, due_by: addDays(on, 30), cite: analysis.classification === 'deficiency' ? '12 CFR 1024.17(f)(4)(i)' : '12 CFR 1024.17(f)(3)(i)' };
    }
    case 'credit_next_year': {
      const installments = equalInstallments(analysis.surplus_cents, 12, nextCycle);
      return { status: 'scheduled', election, direction: 'credit', amount_cents: analysis.surplus_cents, installments, new_monthly_escrow_cents: analysis.new_monthly_escrow_cents - installments[0].amount_cents, cite: '12 CFR 1024.17(f)(2)(ii): surplus under $50 credited against next year' };
    }
    case 'equal_monthly_payments': {
      const basis = analysis.classification === 'deficiency' ? 'deficiency' : 'shortage';
      const min = basis === 'deficiency' ? 2 : 12;
      const m = months ?? min;
      if (!Number.isInteger(m) || m < min) throw new RangeError(`${basis === 'deficiency' ? 'R09' : 'R08'}: ${basis} recovery must be at least ${min} months`);
      const amount = basis === 'deficiency' ? analysis.deficiency_cents : analysis.shortage_cents;
      const installments = equalInstallments(amount, m, nextCycle);
      let shortage_installments: Installment[] | undefined;
      if (basis === 'deficiency' && analysis.shortage_cents > 0) shortage_installments = equalInstallments(analysis.shortage_cents, Math.max(m, 12), nextCycle);
      return {
        status: 'scheduled', election, direction: 'collect', basis, amount_cents: amount, months: m, installments, shortage_installments,
        new_monthly_escrow_cents: analysis.new_monthly_escrow_cents + installments[0].amount_cents + (shortage_installments?.[0].amount_cents ?? 0),
        rounding: 'floor(amount / months) each; the one-cent residue is added to the earliest installments so the total is conserved',
        cite: basis === 'deficiency' ? '12 CFR 1024.17(f)(4): two or more equal monthly payments' : '12 CFR 1024.17(f)(3): equal monthly payments over at least 12 months',
      };
    }
  }
}

/** Monthly escrow deposit after choosing a recovery option (equal monthly payments over `months`). */
export function escrowDepositWithRecovery(a: EscrowAnalysis, choice: { shortage_months?: number; deficiency_months?: number }): Cents {
  let dep = a.new_monthly_escrow_cents;
  if (a.shortage_cents > 0 && choice.shortage_months) {
    const eq = a.shortage_options.filter((o) => o.kind === 'equal_monthly_payments');
    if (eq.length === 0) throw new Error('R08: equal monthly payments not offered for this analysis (borrower not current: loan document review)');
    const min = Math.max(...eq.map((o) => o.min_months ?? 1));
    if (choice.shortage_months < min) throw new RangeError(`R08: shortage recovery must be at least ${min} months`);
    dep += Math.ceil(a.shortage_cents / choice.shortage_months);
  }
  if (a.deficiency_cents > 0 && choice.deficiency_months) {
    const eq = a.deficiency_options.filter((o) => o.kind === 'equal_monthly_payments');
    if (eq.length === 0) throw new Error('R09: equal monthly payments not offered for this analysis (borrower not current: loan document review)');
    const min = Math.max(...eq.map((o) => o.min_months ?? 1));
    if (choice.deficiency_months < min) throw new RangeError(`R09: deficiency recovery must be at least ${min} months`);
    dep += Math.ceil(a.deficiency_cents / choice.deficiency_months);
  }
  return dep;
}
