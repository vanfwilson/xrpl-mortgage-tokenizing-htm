import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { Writer, pens, stampPages } from '../pdf/common.js';
import { addDays, daysBetween } from './calendar.js';
import type { EscrowAnalysis, ProjectedDisbursement } from './analysis.js';
import type { Cents, IsoDate, LoanTerms, ScheduleRow } from './types.js';

const usd = (c: Cents) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** R05 12 CFR 1024.17(g): initial escrow statement at settlement or within 45 calendar days. */
export interface InitialEscrowStatement {
  kind: 'initial_escrow_statement';
  settlement_date: IsoDate;
  due_by: IsoDate;
  opening_balance_cents: Cents;
  monthly_escrow_cents: Cents;
  disbursements: ProjectedDisbursement[];
  cite: string;
}
export function initialEscrowStatement(i: { settlement_date: IsoDate; opening_balance_cents: Cents; monthly_escrow_cents: Cents; disbursements: ProjectedDisbursement[] }): InitialEscrowStatement {
  return { kind: 'initial_escrow_statement', settlement_date: i.settlement_date, due_by: addDays(i.settlement_date, 45), opening_balance_cents: i.opening_balance_cents, monthly_escrow_cents: i.monthly_escrow_cents, disbursements: i.disbursements, cite: '12 CFR 1024.17(g)(1): at settlement or within 45 calendar days of settlement' };
}

/** R06 12 CFR 1024.17(i): annual statement within 30 days of the end of the computation year. */
export interface AnnualEscrowStatement { kind: 'annual_escrow_statement'; computation_year_end: IsoDate; due_by: IsoDate; analysis: EscrowAnalysis; cite: string }
export function annualEscrowStatement(a: EscrowAnalysis): AnnualEscrowStatement {
  return { kind: 'annual_escrow_statement', computation_year_end: a.computation_year_end, due_by: addDays(a.computation_year_end, 30), analysis: a, cite: '12 CFR 1024.17(i)(1): within 30 days of the completion of the escrow account computation year' };
}

/** Deadline check used by both statements: delivered on or before due_by is on time; after is an alert. */
export function deadlineStatus(due_by: IsoDate, delivered_on: IsoDate): { status: 'on_time' | 'late'; days_late: number } {
  const d = daysBetween(due_by, delivered_on);
  return d <= 0 ? { status: 'on_time', days_late: 0 } : { status: 'late', days_late: d };
}

/** R17 12 CFR 1026.41(d): periodic statement content. */
export interface PeriodicStatement {
  kind: 'periodic_statement';
  loan_id: string;
  statement_date: IsoDate;
  due_date: IsoDate;
  amount_due_cents: Cents;
  explanation: { principal: Cents; interest: Cents; escrow: Cents; mip: Cents; fees: Cents };
  past_payment_breakdown: { since_last: { principal: Cents; interest: Cents; escrow: Cents; mip: Cents; fees: Cents; suspense: Cents }; year_to_date: { principal: Cents; interest: Cents; escrow: Cents; mip: Cents; fees: Cents } };
  transaction_activity: Array<{ date: IsoDate; description: string; cents: Cents }>;
  partial_payment_information?: string;
  account_information: { outstanding_principal_cents: Cents; interest_rate: number; prepayment_penalty: boolean; late_charge_cents: Cents; late_charge_after: IsoDate };
  delinquency_information?: { days_delinquent: number; risks: string; history: string; total_to_bring_current_cents: Cents };
  contact: string;
  cite: string;
}
export function periodicStatement(i: {
  terms: LoanTerms; row: ScheduleRow; escrow_cents: Cents; mip_cents: Cents; fees_due_cents: Cents; statement_date: IsoDate;
  since_last: PeriodicStatement['past_payment_breakdown']['since_last']; ytd: PeriodicStatement['past_payment_breakdown']['year_to_date'];
  activity: PeriodicStatement['transaction_activity']; suspense_balance_cents: Cents; days_delinquent: number; amount_to_cure_cents?: Cents; contact: string;
}): PeriodicStatement {
  const amountDue = i.row.principal_cents + i.row.interest_cents + i.escrow_cents + i.mip_cents + i.fees_due_cents;
  const s: PeriodicStatement = {
    kind: 'periodic_statement', loan_id: i.terms.loan_id, statement_date: i.statement_date, due_date: i.row.due_date, amount_due_cents: amountDue,
    explanation: { principal: i.row.principal_cents, interest: i.row.interest_cents, escrow: i.escrow_cents, mip: i.mip_cents, fees: i.fees_due_cents },
    past_payment_breakdown: { since_last: i.since_last, year_to_date: i.ytd },
    transaction_activity: i.activity,
    account_information: { outstanding_principal_cents: i.row.balance_after_cents + i.row.principal_cents, interest_rate: i.terms.annual_rate, prepayment_penalty: false, late_charge_cents: i.terms.late_charge_cents, late_charge_after: addDays(i.row.due_date, i.terms.grace_days) },
    contact: i.contact,
    cite: '12 CFR 1026.41(d)',
  };
  if (i.suspense_balance_cents > 0) s.partial_payment_information = `${usd(i.suspense_balance_cents)} is held in suspense and will be applied when a full periodic payment is available (12 CFR 1026.41(d)(5)).`;
  if (i.days_delinquent >= 45) s.delinquency_information = { days_delinquent: i.days_delinquent, risks: 'Late fees, negative credit reporting and, if the loan is not brought current, foreclosure (12 CFR 1026.41(d)(8)).', history: 'See transaction activity for the last six months.', total_to_bring_current_cents: i.amount_to_cure_cents ?? amountDue };
  return s;
}

/** Simple PDF rendering for borrower statements (JSON is the system record; the PDF is the delivered copy). */
export async function renderStatementPdf(title: string, rows: Array<[string, string]>, out: string, anchor: string): Promise<void> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const { font, bold } = await pens(doc);
  const w = new Writer(page, font, bold, 54, 738);
  w.h(title, 13);
  for (const [k, v] of rows) w.kv(k, v);
  stampPages(doc, font, anchor);
  fs.writeFileSync(out, await doc.save());
}

export const annualStatementRows = (a: EscrowAnalysis): Array<[string, string]> => [
  ['Computation year', `${a.computation_year_start} to ${a.computation_year_end}`],
  ['Annual disbursements', usd(a.annual_disbursements_cents)],
  ['Monthly escrow deposit', usd(a.monthly_deposit_cents)],
  ['Cushion (≤ 1/6 of annual)', usd(a.cushion_cents)],
  ['Lowest projected balance', `${usd(a.lowest_balance_cents)} in month ${a.lowest_month}`],
  ['Target starting balance', usd(a.target_starting_balance_cents)],
  ['Actual starting balance', usd(a.starting_balance_cents)],
  ['Result', `${a.classification} ${usd(a.surplus_cents || a.shortage_cents || a.deficiency_cents)}`],
  ['New monthly escrow', usd(a.new_monthly_escrow_cents)],
  ['California interest credited', usd(a.california_interest_cents)],
  ['Statement due by', a.annual_statement_due],
];
