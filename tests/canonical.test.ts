import { describe, expect, it } from 'vitest';
import { buildCanonicalFromDocuments, validateCanonical } from '../src/ingest/canonical.js';

describe('canonical loan record (4-document package)', () => {
  const loan = buildCanonicalFromDocuments('data/documents');
  it('passes every cross-document tie-out', () => {
    expect(validateCanonical(loan)).toEqual([]);
  });
  it('carries exactly four servicing legs that sum to the payment', () => {
    const s = loan.servicing;
    expect(s.principal_and_interest).toBe(2770.73);
    expect(s.property_tax_impound).toBe(285);
    expect(s.hazard_insurance_impound).toBe(125);
    expect(s.fha_mip).toBe(184.28);
    expect(s.monthly_total_sweep).toBe(3365.01);
    expect(Object.keys(s)).toEqual(['principal_and_interest', 'property_tax_impound', 'hazard_insurance_impound', 'fha_mip', 'monthly_total_sweep']);
  });
  it('R21: note = base + UFMIP on the base; LTV on the base', () => {
    expect(loan.loan.base_loan_amount).toBe(442_260.44);
    expect(loan.loan.financed_ufmip).toBe(7739.56);
    expect(loan.loan.principal_amount).toBe(450_000);
    expect(loan.property.ltv).toBe(0.7898);
  });
  it('R20: FHA note terms', () => {
    expect(loan.note_terms).toMatchObject({ payment_due_day_of_month: 1, grace_period_days: 15, late_charge_percent_of_pi: 0.04, late_charge_amount: 110.83 });
    expect(loan.loan.note_form).toContain('FHA');
    expect(loan.security_instrument.form).toContain('FHA');
    expect(loan.security_instrument.recording_number).toBe('2026-0099483A');
    expect(loan.vesting_deed.recording_number).toBe('2026-0099482A');
    expect(loan.closing.cash_to_close).toBe(91_400);
  });
  it('R19: consumer purpose only', () => {
    expect(loan.loan.credit_purpose).toBe('consumer');
    const bad = structuredClone(loan) as any;
    bad.loan.credit_purpose = 'business';
    expect(validateCanonical(bad).map((i) => i.field)).toContain('loan.credit_purpose');
  });
  it('R20/R21: flags a 5% late charge and a UFMIP computed on the total', () => {
    const bad = structuredClone(loan);
    bad.note_terms.late_charge_percent_of_pi = 0.05;
    bad.note_terms.late_charge_amount = 138.54;
    bad.loan.financed_ufmip = 7875;
    bad.loan.base_loan_amount = 442_125;
    const fields = validateCanonical(bad).map((i) => i.field);
    expect(fields).toContain('note_terms.late_charge_percent_of_pi');
    expect(fields).toContain('loan.financed_ufmip');
    expect(fields).toContain('property.ltv');
    expect(fields).toContain('servicing.fha_mip');
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
