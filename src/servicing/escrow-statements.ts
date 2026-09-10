import { analyzeEscrowYear, resolveAnalysis, type AnalysisInput, type AnalysisResolution, type Election, type EscrowAnalysis, type ProjectedDisbursement, type TrialBalance } from './analysis.js';
import { addDays, addMonths } from './calendar.js';
import { deadlineStatus } from './statements.js';
import type { Cents, EscrowPurpose, IsoDate, Tenant } from './types.js';

/**
 * Escrow account statements with their full regulatory content (R05, R06), separate from the deadline wrappers
 * in statements.ts. Generation and delivery are distinct: a statement is not furnished until
 * `recordStatementDelivery` records evidence of the mailing or of the consented electronic delivery.
 */

const isIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
function assertDate(d: string, what: string): void { if (!isIsoDate(d)) throw new RangeError(`${what}: '${d}' is not an ISO date`); }
function assertCents(c: number, what: string, allowNegative = false): void {
  if (!Number.isSafeInteger(c) || (!allowNegative && c < 0)) throw new RangeError(`${what}: ${c} is not ${allowNegative ? '' : 'non-negative '}integer cents`);
}

export interface StatementScope extends Tenant { principal_interest_cents: Cents }
function assertScope(s: StatementScope): void {
  if (!s.company_id || !s.loan_id) throw new Error('statement scope: company_id and loan_id are required');
  assertCents(s.principal_interest_cents, 'principal_interest_cents');
}

/** Month-by-month projection starting from an actual opening balance (the account as the borrower will see it). */
export interface ProjectionRow extends TrialBalance { disbursements: Array<{ purpose: EscrowPurpose; due: IsoDate; cents: Cents; description: string }> }

export interface AnticipatedDisbursement { purpose: EscrowPurpose; due: IsoDate; cents: Cents; description: string }

function anticipated(a: EscrowAnalysis, input: AnalysisInput): AnticipatedDisbursement[] {
  return [...input.disbursements]
    .map((d) => {
      assertDate(d.due, 'disbursement due');
      if (d.due < a.computation_year_start || d.due > a.computation_year_end) throw new RangeError(`disbursement ${d.purpose} ${d.due} is outside the computation year ${a.computation_year_start}..${a.computation_year_end}`);
      const description = d.description?.trim();
      if (!description) throw new Error(`1024.17(g)(1)(i)/(h): anticipated disbursement ${d.purpose} ${d.due} needs a description (payee/purpose)`);
      return { purpose: d.purpose, due: d.due, cents: d.cents, description };
    })
    .sort((x, y) => x.due.localeCompare(y.due) || x.purpose.localeCompare(y.purpose));
}

function projectFrom(opening: Cents, a: EscrowAnalysis, disb: AnticipatedDisbursement[]): ProjectionRow[] {
  let bal = opening;
  return a.trial_balances.map((t, m) => {
    const mStart = addMonths(a.computation_year_start, m);
    const mEnd = addDays(addMonths(a.computation_year_start, m + 1), -1);
    const items = disb.filter((d) => d.due >= mStart && d.due <= mEnd);
    bal += t.deposit_cents - t.disbursed_cents;
    return { ...t, balance_cents: bal, disbursements: items };
  });
}

/** Common delivery envelope for both statements. */
export interface DeliverableStatement { kind: string; company_id: string; loan_id: string; generated_on: IsoDate; due_by: IsoDate }

/** R05 12 CFR 1024.17(g)(1) and (h): content of the initial escrow account statement. */
export interface InitialEscrowStatementDocument extends DeliverableStatement {
  kind: 'initial_escrow_statement';
  settlement_date: IsoDate;
  computation_year_start: IsoDate;
  computation_year_end: IsoDate;
  /** (g)(1)(i): amount of the monthly mortgage payment = principal & interest + escrow. */
  monthly_mortgage_payment_cents: Cents;
  monthly_principal_interest_cents: Cents;
  /** (g)(1)(i): portion of the monthly payment going into escrow (ceil(annual/12); month 12 carries the adjustment). */
  monthly_escrow_cents: Cents;
  final_month_adjustment_cents: Cents;
  /** (g)(1)(ii): initial deposit collected at settlement. */
  initial_deposit_cents: Cents;
  /** (g)(1)(iii)/(h): cushion selected by the servicer, within 1024.17(c). */
  cushion_cents: Cents;
  /** (h)(1): itemised estimated taxes, insurance premiums and other charges with anticipated disbursement dates. */
  anticipated_disbursements: AnticipatedDisbursement[];
  annual_disbursements_cents: Cents;
  /** (h)(1): projected month-by-month activity from the initial deposit, running balance after each month. */
  projection: ProjectionRow[];
  /** (h)(2): the aggregate trial run from a zero balance that produced the target. */
  trial_balances: TrialBalance[];
  target_starting_balance_cents: Cents;
  classification: EscrowAnalysis['classification'];
  analysis: EscrowAnalysis;
  cite: string;
}

export function buildInitialEscrowStatement(input: StatementScope & { settlement_date: IsoDate; generated_on: IsoDate; analysis_input: AnalysisInput }): InitialEscrowStatementDocument {
  assertScope(input);
  assertDate(input.settlement_date, 'settlement_date'); assertDate(input.generated_on, 'generated_on');
  if (input.generated_on < input.settlement_date) throw new RangeError('R05: initial statement cannot be generated before settlement');
  const a = analyzeEscrowYear(input.analysis_input);
  const disb = anticipated(a, input.analysis_input);
  const opening = input.analysis_input.starting_balance_cents;
  assertCents(opening, 'initial deposit');
  return {
    kind: 'initial_escrow_statement',
    company_id: input.company_id, loan_id: input.loan_id,
    settlement_date: input.settlement_date, generated_on: input.generated_on, due_by: addDays(input.settlement_date, 45),
    computation_year_start: a.computation_year_start, computation_year_end: a.computation_year_end,
    monthly_mortgage_payment_cents: input.principal_interest_cents + a.monthly_deposit_cents,
    monthly_principal_interest_cents: input.principal_interest_cents,
    monthly_escrow_cents: a.monthly_deposit_cents,
    final_month_adjustment_cents: a.final_month_adjustment_cents,
    initial_deposit_cents: opening,
    cushion_cents: a.cushion_cents,
    anticipated_disbursements: disb,
    annual_disbursements_cents: a.annual_disbursements_cents,
    projection: projectFrom(opening, a, disb),
    trial_balances: a.trial_balances,
    target_starting_balance_cents: a.target_starting_balance_cents,
    classification: a.classification,
    analysis: a,
    cite: '12 CFR 1024.17(g)(1), (h): initial escrow account statement at settlement or within 45 calendar days',
  };
}

/** Prior-year account activity. Deposits and interest are positive; disbursements and refunds are negative. */
export type ActivityKind = 'deposit' | 'tax' | 'hazard' | 'interest' | 'refund' | 'adjustment';
export interface ActivityEntry { on: IsoDate; kind: ActivityKind; cents: Cents; reference: string; description?: string }
export interface ActivityRow extends ActivityEntry { balance_after_cents: Cents }

/** R06 12 CFR 1024.17(i)(1): content of the annual escrow account statement. */
export interface AnnualEscrowStatementDocument extends DeliverableStatement {
  kind: 'annual_escrow_statement';
  prior_year_start: IsoDate;
  prior_year_end: IsoDate;
  /** (i)(1)(i)-(ii): current and prior monthly payment and escrow portion. */
  prior_monthly_mortgage_payment_cents: Cents;
  prior_monthly_escrow_cents: Cents;
  new_monthly_mortgage_payment_cents: Cents;
  new_monthly_escrow_cents: Cents;
  /** (i)(1)(iii)-(v): total deposited, total disbursed by purpose, interest credited, refunds. */
  totals: { deposits_cents: Cents; interest_cents: Cents; disbursed_tax_cents: Cents; disbursed_hazard_cents: Cents; refunds_cents: Cents; adjustments_cents: Cents };
  /** (i)(1)(vi)-(vii): opening and closing balance with the running balance after each item. */
  opening_balance_cents: Cents;
  closing_balance_cents: Cents;
  activity: ActivityRow[];
  /** (i)(1)(viii): reference to the previous projection and an explanation of the differences. */
  prior_projection_evidence_id: string;
  difference_explanation: string;
  /** (i)(1)(ix)/(f): next-year projection, its classification and the elected resolution. */
  anticipated_disbursements: AnticipatedDisbursement[];
  projection: ProjectionRow[];
  analysis: EscrowAnalysis;
  election: Election;
  resolution: AnalysisResolution;
  cite: string;
}

export function buildAnnualEscrowStatement(input: StatementScope & {
  generated_on: IsoDate;
  prior_year_start: IsoDate; prior_year_end: IsoDate;
  prior_monthly_escrow_cents: Cents;
  prior_projection_evidence_id: string;
  opening_balance_cents: Cents; closing_balance_cents: Cents;
  activity: ActivityEntry[];
  next: AnalysisInput;
  election: Election; recovery_months?: number;
  difference_explanation: string;
}): AnnualEscrowStatementDocument {
  assertScope(input);
  for (const [k, v] of [['generated_on', input.generated_on], ['prior_year_start', input.prior_year_start], ['prior_year_end', input.prior_year_end]] as const) assertDate(v, k);
  assertCents(input.opening_balance_cents, 'opening_balance_cents', true);
  assertCents(input.closing_balance_cents, 'closing_balance_cents', true);
  assertCents(input.prior_monthly_escrow_cents, 'prior_monthly_escrow_cents');
  if (!input.prior_projection_evidence_id?.trim()) throw new Error('R06 1024.17(i)(1)(viii): prior projection evidence id is required');
  if (!input.difference_explanation?.trim()) throw new Error('R06 1024.17(i)(1)(viii): difference_explanation is required (why actual activity differed from the prior projection)');
  if (input.prior_year_start > input.prior_year_end) throw new RangeError('R06: prior year start is after its end');
  if (input.next.computation_year_start !== addDays(input.prior_year_end, 1)) throw new RangeError(`R06: next computation year must start the day after ${input.prior_year_end} (got ${input.next.computation_year_start})`);

  // Tie-out: opening + every item, in date order, must land exactly on the closing balance.
  const refs = new Set<string>();
  let bal = input.opening_balance_cents;
  const activity: ActivityRow[] = [...input.activity].sort((x, y) => x.on.localeCompare(y.on)).map((e) => {
    assertDate(e.on, 'activity date'); assertCents(e.cents, `activity ${e.reference}`, true);
    if (e.on < input.prior_year_start || e.on > input.prior_year_end) throw new RangeError(`R06: activity ${e.reference} on ${e.on} is outside ${input.prior_year_start}..${input.prior_year_end}`);
    if (!e.reference || refs.has(e.reference)) throw new Error(`R06: activity reference '${e.reference}' missing or duplicated`);
    if ((e.kind === 'deposit' || e.kind === 'interest') && e.cents < 0) throw new RangeError(`R06: ${e.kind} ${e.reference} must be non-negative`);
    if ((e.kind === 'tax' || e.kind === 'hazard' || e.kind === 'refund') && e.cents > 0) throw new RangeError(`R06: ${e.kind} ${e.reference} must be non-positive (money leaving the account)`);
    refs.add(e.reference);
    bal += e.cents;
    return { ...e, balance_after_cents: bal };
  });
  if (bal !== input.closing_balance_cents) throw new Error(`R06: account activity does not reconcile: opening ${input.opening_balance_cents} + activity = ${bal}, closing stated ${input.closing_balance_cents}`);
  if (input.next.starting_balance_cents !== bal) throw new Error(`R06: next-year starting balance ${input.next.starting_balance_cents} must equal the closing balance ${bal}`);

  const a = analyzeEscrowYear(input.next);
  const disb = anticipated(a, input.next);
  const resolution = resolveAnalysis(a, input.election, input.generated_on, input.recovery_months);
  const newMonthly = 'new_monthly_escrow_cents' in resolution ? resolution.new_monthly_escrow_cents : a.new_monthly_escrow_cents;
  const sum = (k: ActivityKind) => activity.filter((e) => e.kind === k).reduce((t, e) => t + e.cents, 0);
  return {
    kind: 'annual_escrow_statement',
    company_id: input.company_id, loan_id: input.loan_id,
    generated_on: input.generated_on, due_by: addDays(input.prior_year_end, 30),
    prior_year_start: input.prior_year_start, prior_year_end: input.prior_year_end,
    prior_monthly_mortgage_payment_cents: input.principal_interest_cents + input.prior_monthly_escrow_cents,
    prior_monthly_escrow_cents: input.prior_monthly_escrow_cents,
    new_monthly_mortgage_payment_cents: input.principal_interest_cents + newMonthly,
    new_monthly_escrow_cents: newMonthly,
    totals: { deposits_cents: sum('deposit'), interest_cents: sum('interest'), disbursed_tax_cents: 0 - sum('tax'), disbursed_hazard_cents: 0 - sum('hazard'), refunds_cents: 0 - sum('refund'), adjustments_cents: sum('adjustment') },
    opening_balance_cents: input.opening_balance_cents,
    closing_balance_cents: bal,
    activity,
    prior_projection_evidence_id: input.prior_projection_evidence_id,
    difference_explanation: input.difference_explanation.trim(),
    anticipated_disbursements: disb,
    projection: projectFrom(bal, a, disb),
    analysis: a,
    election: input.election,
    resolution,
    cite: '12 CFR 1024.17(i)(1): annual escrow account statement within 30 days of the end of the computation year',
  };
}

/** Delivery evidence. Electronic delivery needs E-SIGN consent evidence (15 U.S.C. 7001(c)); late delivery is flagged, not hidden. */
export interface StatementDelivery {
  statement_kind: string; company_id: string; loan_id: string;
  delivered_on: IsoDate; method: 'mail' | 'electronic'; evidence_id: string; electronic_consent_evidence_id?: string;
  due_by: IsoDate; status: 'on_time' | 'late'; days_late: number; late: boolean;
}

export function recordStatementDelivery(statement: DeliverableStatement, input: { on: IsoDate; method: 'mail' | 'electronic'; evidenceId: string; electronicConsentEvidenceId?: string }): StatementDelivery {
  assertDate(input.on, 'delivery date');
  if (!input.evidenceId?.trim()) throw new Error('delivery: evidenceId (mailing log / transmission record) is required');
  if (input.on < statement.generated_on) throw new RangeError(`delivery: ${input.on} precedes generation on ${statement.generated_on}`);
  if (input.method === 'electronic' && !input.electronicConsentEvidenceId?.trim()) throw new Error('delivery: electronic delivery requires borrower E-SIGN consent evidence (15 U.S.C. 7001(c))');
  const d = deadlineStatus(statement.due_by, input.on);
  return {
    statement_kind: statement.kind, company_id: statement.company_id, loan_id: statement.loan_id,
    delivered_on: input.on, method: input.method, evidence_id: input.evidenceId,
    ...(input.method === 'electronic' ? { electronic_consent_evidence_id: input.electronicConsentEvidenceId } : {}),
    due_by: statement.due_by, status: d.status, days_late: d.days_late, late: d.status === 'late',
  };
}
