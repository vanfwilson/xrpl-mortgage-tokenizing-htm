import type { Cents } from './apply.js';
import { addDays } from './dates.js';

export type EscrowPurpose = 'tax' | 'hazard' | 'mip';
export interface ScheduledDisbursement { readonly month: number; readonly purpose: EscrowPurpose; readonly amountCents: Cents }
export interface EscrowAnalysisInput {
  readonly startingBalanceCents: Cents;
  readonly currentBalanceCents: Cents;
  readonly currentMonthlyDepositCents: Cents;
  readonly disbursements: readonly ScheduledDisbursement[];
  readonly stateCushionCapCents?: Cents;
  readonly contractCushionCapCents?: Cents;
  readonly borrowerCurrent: boolean;
}
export type ResolutionOption = 'do_nothing' | 'refund_30_days' | 'credit_next_year' | 'collect_30_days' | 'collect_12_or_more' | 'collect_2_or_more' | 'loan_document_review';

function cents(value: number, negative = false) {
  if (!Number.isSafeInteger(value) || (!negative && value < 0)) throw new RangeError('invalid integer cents');
}

/** R01 — title-company closing escrow is never a servicing purpose. */
export function assertServicingPurpose(purpose: string): asserts purpose is EscrowPurpose {
  if (!['tax', 'hazard', 'mip'].includes(purpose)) throw new RangeError(`unsupported servicing escrow purpose: ${purpose}`);
}

/** R03 — maximum cushion is the lowest of federal, state and contract caps. */
export function cushionLimit(annualCents: Cents, state?: Cents, contract?: Cents): Cents {
  cents(annualCents); if (state !== undefined) cents(state); if (contract !== undefined) cents(contract);
  const caps = [Math.floor(annualCents / 6), state, contract].filter((v): v is number => v !== undefined);
  return Math.max(0, Math.min(...caps));
}

function project(input: EscrowAnalysisInput, monthly: Cents, finalAdjustment = 0) {
  let balance = input.startingBalanceCents;
  const rows = [];
  for (let month = 1; month <= 12; month++) {
    const depositCents = monthly - (month > 12 + finalAdjustment ? 1 : 0);
    balance += depositCents;
    const disbursedCents = input.disbursements.filter((d) => d.month === month).reduce((a, d) => a + d.amountCents, 0);
    balance -= disbursedCents;
    rows.push({ month, depositCents, disbursedCents, endingBalanceCents: balance });
  }
  return rows;
}

/** R02/R03/R07-R09 — aggregate analysis with only regulation-permitted options. */
export function analyzeEscrowYear(input: EscrowAnalysisInput) {
  cents(input.startingBalanceCents, true); cents(input.currentBalanceCents, true); cents(input.currentMonthlyDepositCents);
  for (const d of input.disbursements) { assertServicingPurpose(d.purpose); if (!Number.isInteger(d.month) || d.month < 1 || d.month > 12 || !Number.isSafeInteger(d.amountCents) || d.amountCents < 0) throw new RangeError('invalid disbursement'); }
  const annual = input.disbursements.reduce((a, d) => a + d.amountCents, 0);
  const cushionCents = cushionLimit(annual, input.stateCushionCapCents, input.contractCushionCapCents);
  // Appendix E: annual / 12 first, then shift the zero-opening trial by its
  // lowest balance and the permitted cushion. Never inflate the base monthly
  // deposit to recover a shortage; recovery is a separate elected schedule.
  const monthly = Math.ceil(annual / 12);
  const finalRoundingAdjustmentCents = annual - monthly * 12;
  const zeroTrial = project({ ...input, startingBalanceCents: 0 }, monthly, finalRoundingAdjustmentCents);
  const targetOpeningCents = cushionCents - Math.min(0, ...zeroTrial.map(r => r.endingBalanceCents));
  const trialBalances = project({ ...input, startingBalanceCents: targetOpeningCents }, monthly, finalRoundingAdjustmentCents);
  const actualProjection = project(input, monthly, finalRoundingAdjustmentCents);
  const delta = input.currentBalanceCents - targetOpeningCents;
  const month = input.currentMonthlyDepositCents;
  let classification: 'surplus' | 'shortage' | 'deficiency' | 'balanced';
  let amountCents: number;
  let options: ResolutionOption[];
  if (input.currentBalanceCents < 0) { classification = 'deficiency'; amountCents = -input.currentBalanceCents; options = amountCents < month ? ['do_nothing', 'collect_30_days', 'collect_2_or_more'] : ['do_nothing', 'collect_2_or_more']; }
  else if (delta > 0) { classification = 'surplus'; amountCents = delta; options = input.borrowerCurrent && amountCents >= 5_000 ? ['refund_30_days'] : ['refund_30_days', 'credit_next_year']; }
  else if (delta < 0) { classification = 'shortage'; amountCents = -delta; options = amountCents < month ? ['do_nothing', 'collect_30_days', 'collect_12_or_more'] : ['do_nothing', 'collect_12_or_more']; }
  else { classification = 'balanced'; amountCents = 0; options = ['do_nothing']; }
  if (!input.borrowerCurrent && classification !== 'balanced') options = ['loan_document_review'];
  return { annualDisbursementsCents: annual, cushionCents, newMonthlyDepositCents: monthly, finalRoundingAdjustmentCents, targetOpeningCents, trialBalances, actualProjection, classification, amountCents, options } as const;
}

/** R23 — California 2% simple interest, rounded once to cents for the analysis year. */
export function californiaInterest(dailyBalancesCents: readonly Cents[], daysInYear = 365): Cents {
  if (![365, 366].includes(daysInYear) || dailyBalancesCents.length > daysInYear) throw new RangeError('invalid accrual period');
  dailyBalancesCents.forEach(v => cents(v));
  return Math.round(dailyBalancesCents.reduce((a, b) => a + b, 0) * 0.02 / daysInYear);
}

/** Separate recovery/refund election; the base annual deposit is unchanged. */
export function resolveAnalysis(analysis: ReturnType<typeof analyzeEscrowYear>, election: ResolutionOption, on: string, months = 12) {
  if (!analysis.options.includes(election)) throw new Error('election not permitted');
  if (election === 'loan_document_review') return { status: 'manual_review' as const };
  if (election === 'refund_30_days' || election === 'collect_30_days') return { status: 'scheduled' as const, direction: election === 'refund_30_days' ? 'refund' : 'collect', dueOn: addDays(on, 30), amountCents: analysis.amountCents };
  if (election === 'do_nothing') return { status: 'unchanged' as const };
  const minimum = election === 'collect_2_or_more' ? 2 : 12;
  if (!Number.isInteger(months) || months < minimum) throw new Error('repayment term below required minimum');
  const base = Math.floor(analysis.amountCents / months), remainder = analysis.amountCents % months;
  return { status: 'scheduled' as const, direction: election === 'credit_next_year' ? 'credit' : 'collect', baseDepositCents: analysis.newMonthlyDepositCents, installments: Array.from({length:months},(_,i)=>({month:i+1,amountCents:base+(i<remainder?1:0)})), rounding: 'One-cent residual is allocated to the earliest installments; total conserved.' };
}
