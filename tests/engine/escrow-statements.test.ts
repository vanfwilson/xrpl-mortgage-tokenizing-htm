import { describe, expect, it } from 'vitest';
import type { AnalysisInput, ProjectedDisbursement } from '../../src/servicing/analysis.js';
import { buildAnnualEscrowStatement, buildInitialEscrowStatement, recordStatementDelivery, type ActivityEntry } from '../../src/servicing/escrow-statements.js';
import { renderStatementPdf, annualStatementRows } from '../../src/servicing/statements.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Idaho fixture: tax $1,710 on Dec 20 and Jun 20, hazard $1,500 on Sep 1; P&I $2,770.73. */
const scope = { company_id: 'c1', loan_id: 'L1', principal_interest_cents: 277_073 };
const disb = (y: number): ProjectedDisbursement[] => [
  { purpose: 'tax', due: `${y}-12-20`, cents: 171_000, description: 'First half property tax (Idaho Code 63-903)' },
  { purpose: 'tax', due: `${y + 1}-06-20`, cents: 171_000, description: 'Second half property tax (Idaho Code 63-903)' },
  { purpose: 'hazard', due: `${y + 1}-09-01`, cents: 150_000, description: 'Hazard policy renewal' },
];
const year1: AnalysisInput = { computation_year_start: '2026-11-01', starting_balance_cents: 123_050, disbursements: disb(2026), borrower_current: true, state: 'ID' };

describe('R05 initial escrow account statement (1024.17(g)/(h))', () => {
  it('R05_initial_statement_content: payment split, initial deposit, cushion, dated disbursements and month-by-month projection', async () => {
    const s = buildInitialEscrowStatement({ ...scope, settlement_date: '2026-09-01', generated_on: '2026-09-01', analysis_input: year1 });
    expect(s.kind).toBe('initial_escrow_statement');
    expect(s.due_by).toBe('2026-10-16');
    expect(s.monthly_escrow_cents).toBe(41_000);
    expect(s.monthly_principal_interest_cents).toBe(277_073);
    expect(s.monthly_mortgage_payment_cents).toBe(318_073);
    expect(s.initial_deposit_cents).toBe(123_050);
    expect(s.cushion_cents).toBe(82_000);
    expect(s.final_month_adjustment_cents).toBe(0);
    expect(s.annual_disbursements_cents).toBe(492_000);
    expect(s.anticipated_disbursements.map((d) => [d.due, d.cents, d.description])).toEqual([
      ['2026-12-20', 171_000, 'First half property tax (Idaho Code 63-903)'],
      ['2027-06-20', 171_000, 'Second half property tax (Idaho Code 63-903)'],
      ['2027-09-01', 150_000, 'Hazard policy renewal'],
    ]);
    expect(s.projection).toHaveLength(12);
    // projection from the actual initial deposit: 123,050 + 41,000 per month, less each disbursement
    expect(s.projection.map((r) => r.balance_cents)).toEqual([164_050, 34_050, 75_050, 116_050, 157_050, 198_050, 239_050, 109_050, 150_050, 191_050, 82_050, 123_050]);
    expect(s.projection[1].disbursements[0]).toMatchObject({ purpose: 'tax', due: '2026-12-20' });
    expect(s.trial_balances[1].balance_cents).toBe(-89_000);
    expect(s.target_starting_balance_cents).toBe(171_000);
    expect(s.classification).toBe('shortage');
    // refuses when a disbursement has no description, falls outside the year, or the statement predates settlement
    expect(() => buildInitialEscrowStatement({ ...scope, settlement_date: '2026-09-01', generated_on: '2026-09-01', analysis_input: { ...year1, disbursements: [{ purpose: 'tax', due: '2026-12-20', cents: 1 }] } })).toThrow(/description/);
    expect(() => buildInitialEscrowStatement({ ...scope, settlement_date: '2026-09-01', generated_on: '2026-09-01', analysis_input: { ...year1, disbursements: [{ ...year1.disbursements[0], due: '2027-11-20' }] } })).toThrow(/outside the computation year/);
    expect(() => buildInitialEscrowStatement({ ...scope, settlement_date: '2026-09-01', generated_on: '2026-08-31', analysis_input: year1 })).toThrow(/before settlement/);
    // rendered copy
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'escrow-stmt-')), 'initial.pdf');
    await renderStatementPdf('Initial Escrow Account Statement', [['Monthly payment', String(s.monthly_mortgage_payment_cents)], ...annualStatementRows(s.analysis)], out, 'L1');
    expect(fs.readFileSync(out).subarray(0, 4).toString()).toBe('%PDF');
  });
});

const activity: ActivityEntry[] = [
  ...Array.from({ length: 12 }, (_, m) => ({ on: `${m < 2 ? 2026 : 2027}-${String(((10 + m) % 12) + 1).padStart(2, '0')}-01`, kind: 'deposit' as const, cents: 41_000, reference: `dep-${m + 1}` })),
  { on: '2026-12-20', kind: 'tax', cents: -171_000, reference: 'tax-1' },
  { on: '2027-06-20', kind: 'tax', cents: -171_000, reference: 'tax-2' },
  { on: '2027-09-01', kind: 'hazard', cents: -150_000, reference: 'haz-1' },
];
const closing = 123_050 + 12 * 41_000 - 492_000; // 123,050
const year2: AnalysisInput = { computation_year_start: '2027-11-01', starting_balance_cents: closing, disbursements: disb(2027), borrower_current: true, state: 'ID' };
const annual = { ...scope, generated_on: '2027-11-05', prior_year_start: '2026-11-01', prior_year_end: '2027-10-31', prior_monthly_escrow_cents: 41_000, prior_projection_evidence_id: 'initial-statement-2026-09-01', opening_balance_cents: 123_050, closing_balance_cents: closing, activity, next: year2, election: 'equal_monthly_payments' as const, recovery_months: 12, difference_explanation: 'Actual disbursements matched the projection; the opening shortage was not recovered in year 1 (do nothing elected).' };

describe('R06 annual escrow account statement (1024.17(i))', () => {
  it('R06_annual_statement_activity_tieout: running balances, totals, tie-out, prior projection reference and elected resolution', () => {
    const s = buildAnnualEscrowStatement(annual);
    expect(s.kind).toBe('annual_escrow_statement');
    expect(s.due_by).toBe('2027-11-30');
    expect(s.opening_balance_cents).toBe(123_050);
    expect(s.closing_balance_cents).toBe(123_050);
    expect(s.totals).toEqual({ deposits_cents: 492_000, interest_cents: 0, disbursed_tax_cents: 342_000, disbursed_hazard_cents: 150_000, refunds_cents: 0, adjustments_cents: 0 });
    expect(s.activity).toHaveLength(15);
    expect(s.activity.map((a) => a.on)).toEqual([...s.activity.map((a) => a.on)].sort());
    expect(s.activity.at(-1)?.balance_after_cents).toBe(123_050);
    expect(s.activity.find((a) => a.reference === 'tax-1')?.balance_after_cents).toBe(123_050 + 2 * 41_000 - 171_000);
    expect(s.prior_projection_evidence_id).toBe('initial-statement-2026-09-01');
    expect(s.prior_monthly_mortgage_payment_cents).toBe(318_073);
    expect(s.analysis.classification).toBe('shortage');
    expect(s.analysis.shortage_cents).toBe(47_950);
    expect(s.resolution).toMatchObject({ status: 'scheduled', election: 'equal_monthly_payments', months: 12 });
    expect(s.new_monthly_escrow_cents).toBe(41_000 + 3_996);
    expect(s.new_monthly_mortgage_payment_cents).toBe(277_073 + 41_000 + 3_996);
    expect(s.projection).toHaveLength(12);
    expect(s.anticipated_disbursements[0]).toMatchObject({ due: '2027-12-20', cents: 171_000 });
    // refusals: activity that does not reconcile to the stated closing balance, next-year opening != closing,
    // missing explanation / evidence id, non-contiguous years, wrong sign, duplicate reference, item outside the year
    expect(() => buildAnnualEscrowStatement({ ...annual, closing_balance_cents: closing + 1 })).toThrow(/does not reconcile/);
    expect(() => buildAnnualEscrowStatement({ ...annual, activity: activity.slice(1) })).toThrow(/does not reconcile/);
    expect(() => buildAnnualEscrowStatement({ ...annual, next: { ...year2, starting_balance_cents: closing - 1 } })).toThrow(/must equal the closing balance/);
    expect(() => buildAnnualEscrowStatement({ ...annual, difference_explanation: '  ' })).toThrow(/difference_explanation/);
    expect(() => buildAnnualEscrowStatement({ ...annual, prior_projection_evidence_id: '' })).toThrow(/prior projection evidence/);
    expect(() => buildAnnualEscrowStatement({ ...annual, next: { ...year2, computation_year_start: '2027-11-02' } })).toThrow(/day after/);
    expect(() => buildAnnualEscrowStatement({ ...annual, activity: activity.map((a) => (a.reference === 'tax-1' ? { ...a, cents: 171_000 } : a)) })).toThrow(/non-positive/);
    expect(() => buildAnnualEscrowStatement({ ...annual, activity: [...activity, { ...activity[0], on: '2027-01-15' }] })).toThrow(/duplicated/);
    expect(() => buildAnnualEscrowStatement({ ...annual, activity: activity.map((a) => (a.reference === 'haz-1' ? { ...a, on: '2027-11-01' } : a)) })).toThrow(/outside/);
    // an election the analysis does not permit is refused
    expect(() => buildAnnualEscrowStatement({ ...annual, election: 'refund_30_days' })).toThrow(/not permitted/);
  });

  it('R06_delivery_evidence: generation is not furnishing; electronic needs consent; late delivery is flagged', () => {
    const s = buildAnnualEscrowStatement(annual);
    expect(recordStatementDelivery(s, { on: '2027-11-30', method: 'mail', evidenceId: 'mail-log-77' })).toMatchObject({ statement_kind: 'annual_escrow_statement', loan_id: 'L1', status: 'on_time', late: false, days_late: 0, due_by: '2027-11-30' });
    expect(recordStatementDelivery(s, { on: '2027-12-01', method: 'mail', evidenceId: 'mail-log-78' })).toMatchObject({ status: 'late', late: true, days_late: 1 });
    expect(() => recordStatementDelivery(s, { on: '2027-11-20', method: 'electronic', evidenceId: 'smtp-1' })).toThrow(/consent/);
    expect(recordStatementDelivery(s, { on: '2027-11-20', method: 'electronic', evidenceId: 'smtp-1', electronicConsentEvidenceId: 'esign-2026-09-01' })).toMatchObject({ method: 'electronic', electronic_consent_evidence_id: 'esign-2026-09-01', late: false });
    expect(() => recordStatementDelivery(s, { on: '2027-11-20', method: 'mail', evidenceId: '' })).toThrow(/evidenceId/);
    expect(() => recordStatementDelivery(s, { on: '2027-11-04', method: 'mail', evidenceId: 'x' })).toThrow(/precedes generation/);
    const initial = buildInitialEscrowStatement({ ...scope, settlement_date: '2026-09-01', generated_on: '2026-09-01', analysis_input: year1 });
    expect(recordStatementDelivery(initial, { on: '2026-10-17', method: 'mail', evidenceId: 'mail-log-1' })).toMatchObject({ statement_kind: 'initial_escrow_statement', late: true, days_late: 1 });
  });
});
