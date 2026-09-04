import { describe, expect, it } from 'vitest';
import { buildCanonicalFromDocuments, validateCanonical } from '../src/ingest/canonical.js';

describe('canonical loan record', () => {
  const loan = buildCanonicalFromDocuments('data/documents');
  it('passes every cross-document tie-out', () => {
    expect(validateCanonical(loan)).toEqual([]);
  });
  it('carries the fields the ledger steps need', () => {
    expect(loan.loan.principal_amount).toBe(450_000);
    expect(loan.loan.fha_case_number).toBe('411-9928340-703');
    expect(loan.security_instrument.type).toBe('Deed of Trust'); // Idaho is a deed-of-trust state
    expect(loan.security_instrument.lien_position).toBe(1);
    expect(loan.closing.cash_to_close).toBe(91_400);
    expect(loan.recurring_monthly.total_piti).toBe(3368.23);
  });
  it('flags a broken tie-out', () => {
    const bad = structuredClone(loan);
    bad.closing.cash_to_close = 99_400;
    bad.recurring_monthly.fha_mip = 318.75;
    const fields = validateCanonical(bad).map((i) => i.field);
    expect(fields).toContain('closing.cash_to_close');
    expect(fields).toContain('recurring_monthly.total_piti');
  });
});
