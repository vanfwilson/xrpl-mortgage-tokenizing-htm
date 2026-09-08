import { describe, expect, it } from 'vitest';
import { analyzeEscrowYear } from '../../src/servicing/analysis.js';
import { scheduleCents } from '../../src/servicing/apply.js';
import { boardLoan, type Authority } from '../../src/servicing/boarding.js';
import { annualEscrowStatement, deadlineStatus, initialEscrowStatement, periodicStatement } from '../../src/servicing/statements.js';
import { buildCanonicalFromDocuments } from '../../src/ingest/canonical.js';

const loan = buildCanonicalFromDocuments('data/documents');
const registry: Authority[] = [
  { holder_id: 'bank-sub', state: 'ID', kind: 'ID_mortgage_servicer', valid_from: '2026-01-01', valid_to: '2030-12-31' },
  { holder_id: 'bank-sub', state: 'ID', kind: 'HUD_mortgagee', valid_from: '2026-01-01', valid_to: '2030-12-31' },
];
const { terms } = boardLoan({ loan, company_id: 'c1', loan_id: 'L1', legal_owner_id: 'b', servicer_of_record_id: 'bank-sub', settlement_date: '2026-09-01', annual_tax_cents: 342_000, annual_hazard_cents: 150_000, registry, profile: 'test' });
const schedule = scheduleCents(terms);

describe('borrower statements', () => {
  it('R05_initial_statement_deadline: at settlement or within 45 days; day 45 on time, day 46 late', () => {
    const s = initialEscrowStatement({ settlement_date: '2026-09-01', opening_balance_cents: 123_050, monthly_escrow_cents: 41_000, disbursements: [] });
    expect(s.due_by).toBe('2026-10-16');
    expect(deadlineStatus(s.due_by, '2026-10-16').status).toBe('on_time');
    expect(deadlineStatus(s.due_by, '2026-10-17')).toEqual({ status: 'late', days_late: 1 });
  });
  it('R06_annual_statement_deadline: within 30 days of the computation year end; day 30 on time, day 31 late', () => {
    const a = analyzeEscrowYear({ computation_year_start: '2026-11-01', starting_balance_cents: 171_000, disbursements: [{ purpose: 'tax', due: '2026-12-20', cents: 171_000 }], borrower_current: true, state: 'ID' });
    const s = annualEscrowStatement(a);
    expect(s.computation_year_end).toBe('2027-10-31');
    expect(s.due_by).toBe('2027-11-30');
    expect(deadlineStatus(s.due_by, '2027-11-30').status).toBe('on_time');
    expect(deadlineStatus(s.due_by, '2027-12-01').status).toBe('late');
  });
  it('R17_periodic_statement: 1026.41(d) content, partial-payment and delinquency blocks', () => {
    const zero = { principal: 0, interest: 0, escrow: 0, mip: 0, fees: 0 };
    const s = periodicStatement({ terms, row: schedule[0], escrow_cents: 41_000, mip_cents: 18_428, fees_due_cents: 0, statement_date: '2026-10-15', since_last: { ...zero, suspense: 0 }, ytd: zero, activity: [], suspense_balance_cents: 0, days_delinquent: 0, contact: 'servicer@example.test' });
    expect(s.amount_due_cents).toBe(336_501);
    expect(s.due_date).toBe('2026-11-01');
    expect(s.explanation).toEqual({ principal: 42_698, interest: 234_375, escrow: 41_000, mip: 18_428, fees: 0 });
    expect(s.account_information.outstanding_principal_cents).toBe(45_000_000);
    expect(s.account_information.late_charge_after).toBe('2026-11-16');
    expect(s.partial_payment_information).toBeUndefined();
    expect(s.delinquency_information).toBeUndefined();
    const d = periodicStatement({ terms, row: schedule[2], escrow_cents: 41_000, mip_cents: 18_428, fees_due_cents: 11_083, statement_date: '2027-01-15', since_last: { ...zero, suspense: 50_000 }, ytd: zero, activity: [], suspense_balance_cents: 50_000, days_delinquent: 45, amount_to_cure_cents: 700_000, contact: 'x' });
    expect(d.partial_payment_information).toMatch(/suspense/);
    expect(d.delinquency_information?.days_delinquent).toBe(45);
    expect(d.delinquency_information?.total_to_bring_current_cents).toBe(700_000);
  });
});
