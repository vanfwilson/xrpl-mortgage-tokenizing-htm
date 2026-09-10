import { describe, expect, it } from 'vitest';
import { buildCanonicalFromDocuments, validateCanonical } from '../src/ingest/canonical.js';

describe('canonical loan record (4-document package)', () => {
  const loan = buildCanonicalFromDocuments('data/documents');
  it('passes every cross-document tie-out', () => {
    expect(validateCanonical(loan)).toEqual([]);
  });
  it('R19 carries four separately accounted servicing legs that sum to the sweep', () => {
    const s = loan.servicing;
    expect(s.principal_and_interest).toBe(2770.73);
    expect(s.property_tax_impound).toBe(285);
    expect(s.hazard_insurance_impound).toBe(125);
    expect(s.fha_mip_payable).toBe(184.28);
    expect(s.monthly_total_sweep).toBe(3365.01);
    expect(loan.loan.credit_purpose).toBe('consumer');
  });
  it('carries the Note rules the sweep loop needs', () => {
    expect(loan.note_terms).toMatchObject({ payment_due_day_of_month: 1, grace_period_days: 15, late_charge_percent_of_pi: 0.04, late_charge_amount: 110.83 });
    expect(loan.security_instrument.form).toContain('FHA');
    expect(loan.security_instrument.recording_number).toBe('2026-0099483A');
    expect(loan.vesting_deed.recording_number).toBe('2026-0099482A');
    expect(loan.closing.cash_to_close).toBe(91_400);
  });
  it('flags a broken tie-out', () => {
    const bad = structuredClone(loan);
    bad.closing.cash_to_close = 99_400;
    bad.servicing.hazard_insurance_impound = 443.75;
    const fields = validateCanonical(bad).map((i) => i.field);
    expect(fields).toContain('closing.cash_to_close');
    expect(fields).toContain('servicing.monthly_total_sweep');
  });
});
