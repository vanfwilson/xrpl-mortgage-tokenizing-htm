import { describe, expect, it } from 'vitest';
import { calculateAutomatedPaymentSplit, scannedCdFromLoan } from '../src/servicing/split.js';
import { ADA_COUNTY_TAX_INSTALLMENTS, evaluateImpound, finishAfterForDeadline } from '../src/servicing/impound-scheduler.js';
import { buildCanonicalFromDocuments } from '../src/ingest/canonical.js';

const loan = buildCanonicalFromDocuments('data/documents');

describe('three-way payment split', () => {
  it('splits the sweep into P&I, tax impound, insurance impound and balances to the cent', () => {
    expect(calculateAutomatedPaymentSplit(scannedCdFromLoan(loan))).toEqual({ lender_p_i_vault: 2770.73, tax_impound_vault: 285, insurance_impound_vault: 312.5 });
  });
  it('refuses an unbalanced ledger row set', () => {
    expect(() => calculateAutomatedPaymentSplit({ monthly_piti: 3499.27, base_principal_and_interest: 2770.52, monthly_property_tax_impound: 285, monthly_hazard_insurance: 400 })).toThrow(/Audit Failure/);
  });
});

describe('impound scheduler', () => {
  const plan = { kind: 'tax' as const, payee: 'Ada County Treasurer', monthly_impound: 285, annual_total: 3420, installments: ADA_COUNTY_TAX_INSTALLMENTS };
  it('projects the next Ada County installment and flags sufficiency', () => {
    const [next] = evaluateImpound(plan, 1425, new Date('2026-09-04T00:00:00Z'));
    expect(next.deadline).toBe('2026-12-20');
    expect(next.amount_due).toBe(1710);
    expect(next.status).toBe('sufficient');
    expect(next.inside_execution_window).toBe(false);
  });
  it('opens the execution window within 5 days and requires cash on hand', () => {
    const [next] = evaluateImpound(plan, 1710, new Date('2026-12-17T00:00:00Z'));
    expect(next.inside_execution_window).toBe(true);
    expect(next.ready_to_disburse).toBe(true);
    expect(evaluateImpound(plan, 900, new Date('2026-12-17T00:00:00Z'))[0].ready_to_disburse).toBe(false);
  });
  it('rolls a passed deadline into next year', () => {
    const [next] = evaluateImpound(plan, 0, new Date('2026-12-25T00:00:00Z'));
    expect(next.deadline).toBe('2027-06-20');
  });
  it('converts a deadline to a Ripple-epoch FinishAfter', () => {
    expect(finishAfterForDeadline('2026-12-20')).toBe(Math.floor(Date.parse('2026-12-20T17:00:00Z') / 1000) - 946_684_800);
  });
});
