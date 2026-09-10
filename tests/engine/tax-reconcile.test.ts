import { describe, expect, it } from 'vitest';
import { scheduleCents } from '../../src/servicing/apply.js';
import { boardLoan, type Authority } from '../../src/servicing/boarding.js';
import { build1098, build1099INT, filingCalendar, taxHandoffs } from '../../src/servicing/tax.js';
import { appendReconciliationEvent, assertReconciled, threeWayMatch, verifyChain } from '../../src/servicing/reconcile.js';
import { buildCanonicalFromDocuments } from '../../src/ingest/canonical.js';

const loan = buildCanonicalFromDocuments('data/documents');
const registry: Authority[] = [
  { holder_id: 'bank-sub', state: 'ID', kind: 'ID_mortgage_servicer', valid_from: '2026-01-01', valid_to: '2030-12-31' },
  { holder_id: 'bank-sub', state: 'ID', kind: 'HUD_mortgagee', valid_from: '2026-01-01', valid_to: '2030-12-31' },
];
const { terms } = boardLoan({ loan, company_id: 'c1', loan_id: 'L1', legal_owner_id: 'b', servicer_of_record_id: 'bank-sub', settlement_date: '2026-09-01', annual_tax_cents: 342_000, annual_hazard_cents: 150_000, registry, profile: 'test' });
const schedule = scheduleCents(terms);
const y2027 = schedule.filter((r) => r.due_date.startsWith('2027'));

describe('R29 Form 1098', () => {
  const base = {
    year: 2027, terms,
    interest_received_cents: y2027.reduce((a, r) => a + r.interest_cents, 0),
    principal_jan1_cents: schedule.find((r) => r.due_date === '2026-12-01')!.balance_after_cents,
    refund_of_prior_year_interest_cents: 0, mip_received_cents: 18_428 * 12, points_paid_cents: 0,
    taxes_paid_from_escrow_cents: 342_000, insurance_paid_from_escrow_cents: 150_000,
    filer: { name: 'Bank Subservicer', is_first_recipient: true }, mip_reportable: () => true,
    property_address_same_as_mailing: true, properties_secured: 1,
  };
  it('R29_form_1098 T8_form_1098_boxes: box 1 equals posted interest, box 2 the Jan 1 principal, box 5 by rule, box 11 only in-year', () => {
    const f = build1098(base);
    expect(f.required).toBe(true);
    expect(y2027).toHaveLength(12);
    expect(f.boxes[1]).toBe(y2027.reduce((a, r) => a + r.interest_cents, 0));
    expect(f.boxes[2]).toBe(schedule[1].balance_after_cents);
    expect(f.boxes[3]).toBe('2026-09-01');
    expect(f.boxes[5]).toBe(221_136);
    expect(f.boxes[10]).toBe(492_000);
    expect(f.boxes[11]).toBeNull();
    expect(build1098({ ...base, mip_reportable: () => false }).boxes[5]).toBe(0);
    expect(build1098({ ...base, acquisition_date: '2027-06-01' }).boxes[11]).toBe('2027-06-01');
    expect(build1098({ ...base, acquisition_date: '2026-06-01' }).boxes[11]).toBeNull();
    expect(() => build1098({ ...base, filer: { name: 'x', is_first_recipient: false } })).toThrow(/first receives/);
    expect(build1098({ ...base, interest_received_cents: 59_999, mip_received_cents: 0 }).required).toBe(false);
  });
  it('filing calendar rolls to the next business day', () => {
    expect(filingCalendar(2027)).toMatchObject({ furnish_to_borrower_by: '2028-01-31', paper_file_by: '2028-02-29', efile_by: '2028-03-31' });
    expect(filingCalendar(2025).furnish_to_borrower_by).toBe('2026-02-02'); // 2026-01-31 is a Saturday
  });
});

describe('R30 Form 1099-INT and handoffs', () => {
  it('R30_1099int_threshold: $9.99 no, $10.00 yes', () => {
    expect(build1099INT(2027, 999, 'Bank Subservicer').required).toBe(false);
    expect(build1099INT(2027, 1_000, 'Bank Subservicer').required).toBe(true);
    expect(taxHandoffs(['foreclosure', 'cancellation']).map((h) => h.form)).toEqual(['1099-A', '1099-C']);
  });
});

describe('R14 / R22 reconciliation', () => {
  const bank = [{ ref: 'p1', cents: 336_501 }, { ref: 'p2', cents: 336_501 }];
  it('R14_three_way_match: matched when bank, subledger and ledger agree; differences raise', () => {
    const ok = threeWayMatch({ bank, subledger: bank, ledger: bank });
    expect(ok.reconciled).toBe(true);
    expect(() => assertReconciled(ok)).not.toThrow();
    const bad = threeWayMatch({ bank, subledger: bank, ledger: [bank[0], { ref: 'p2', cents: 336_500 }] });
    expect(bad.reconciled).toBe(false);
    expect(bad.unmatched).toEqual([{ ref: 'p2', bank: 336_501, subledger: 336_501, ledger: 336_500 }]);
    expect(() => assertReconciled(bad)).toThrow(/R14/);
  });
  it('R22_bank_balance_authoritative: the bank total is the authoritative balance and the event chain verifies', () => {
    const r = threeWayMatch({ bank, subledger: bank, ledger: [] });
    expect(r.authoritative_balance_cents).toBe(673_002);
    const e1 = appendReconciliationEvent(undefined, { company_id: 'c1', loan_id: 'L1' }, '2027-01-01T00:00:00Z', r);
    const e2 = appendReconciliationEvent(e1, { company_id: 'c1', loan_id: 'L1' }, '2027-02-01T00:00:00Z', r);
    expect(verifyChain([e1, e2])).toBe(true);
    expect(verifyChain([e1, { ...e2, at: '2027-02-02T00:00:00Z' }])).toBe(false);
  });
});
