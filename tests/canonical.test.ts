import { describe, expect, it } from 'vitest';
import { buildCanonicalFromDocuments, validateCanonical } from '../src/ingest/canonical.js';

describe('canonical loan record (4-document package)', () => {
  const loan = buildCanonicalFromDocuments('data/documents');
  it('passes every cross-document tie-out', () => {
    expect(validateCanonical(loan)).toEqual([]);
  });
  it('carries exactly three servicing buckets that sum to the sweep', () => {
    const s = loan.servicing;
    expect(s.principal_and_interest).toBe(2770.73);
    expect(s.property_tax_impound).toBe(285);
    expect(s.insurance_impound).toBe(312.5);
    expect(s.insurance_detail).toEqual({ hazard_homeowners: 125, fha_mip: 187.5 });
    expect(s.monthly_total_sweep).toBe(3368.23);
    expect(Object.keys(s)).toEqual(['principal_and_interest', 'property_tax_impound', 'insurance_impound', 'insurance_detail', 'monthly_total_sweep']);
  });
  it('carries the Note rules the sweep loop needs', () => {
    expect(loan.note_terms).toMatchObject({ payment_due_day_of_month: 1, grace_period_days: 15, late_charge_percent_of_pi: 0.05, late_charge_amount: 138.54 });
    expect(loan.security_instrument.form).toContain('3013');
    expect(loan.security_instrument.recording_number).toBe('2026-0099483A');
    expect(loan.vesting_deed.recording_number).toBe('2026-0099482A');
    expect(loan.closing.cash_to_close).toBe(91_400);
  });
  it('flags a broken tie-out', () => {
    const bad = structuredClone(loan);
    bad.closing.cash_to_close = 99_400;
    bad.servicing.insurance_impound = 443.75;
    const fields = validateCanonical(bad).map((i) => i.field);
    expect(fields).toContain('closing.cash_to_close');
    expect(fields).toContain('servicing.insurance_impound');
  });
});
