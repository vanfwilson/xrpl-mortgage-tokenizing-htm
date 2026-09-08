import { describe, expect, it } from 'vitest';
import { correctedBill, ensureDisbursement } from '../../src/servicing/disburse.js';

const bill = { company_id: 'c1', loan_id: 'L1', purpose: 'tax' as const, payee_id: 'ada-county-treasurer', cents: 171_000, due_date: '2026-12-20', verified: true, source_ref: 'tax-bill-2026-1' };
const base = { bill, borrower_days_overdue: 0, escrows_in_flight: 0, max_in_flight: 3, today: '2026-12-01', cancel_after_days: 45 };

describe('R10 timely disbursement gate (12 CFR 1024.17(k)(1)) and S7 escrow policy', () => {
  it('T2_no_escrow_after_two_receipts: short balance -> advance first, then a fully funded escrow', () => {
    const d = ensureDisbursement({ ...base, purpose_balance_cents: 57_000 });
    expect(d.action).toBe('advance_then_escrow');
    expect(d.advance_cents).toBe(114_000);
    expect(d.escrow_cents).toBe(171_000);
    expect(d.finish_after_date).toBe('2026-12-20');
    expect(d.cancel_after_date).toBe('2027-02-03');
    expect(d.finish_after).toBe(Math.floor(Date.parse('2026-12-20T17:00:00Z') / 1000) - 946_684_800);
  });
  it('R10_advance_when_short: funded balance -> escrow without advance', () => {
    const d = ensureDisbursement({ ...base, purpose_balance_cents: 171_000 });
    expect(d.action).toBe('escrow');
    expect(d.advance_cents).toBe(0);
  });
  it('borrower more than 30 days overdue: advance becomes optional', () => {
    expect(ensureDisbursement({ ...base, purpose_balance_cents: 0, borrower_days_overdue: 31 }).action).toBe('advance_optional');
    expect(ensureDisbursement({ ...base, purpose_balance_cents: 0, borrower_days_overdue: 30 }).action).toBe('advance_then_escrow');
  });
  it('refuses forecasts, far-out bills and too many objects in flight', () => {
    expect(ensureDisbursement({ ...base, purpose_balance_cents: 171_000, bill: { ...bill, verified: false } }).action).toBe('refuse');
    expect(ensureDisbursement({ ...base, purpose_balance_cents: 171_000, today: '2026-06-01' }).action).toBe('forecast_only');
    expect(ensureDisbursement({ ...base, purpose_balance_cents: 171_000, escrows_in_flight: 3 }).action).toBe('refuse');
  });
  it('S7 corrected bill after creation: increase -> adjustment escrow; decrease -> finish and refund', () => {
    expect(correctedBill(171_000, 180_000)).toMatchObject({ action: 'adjustment_escrow', delta_cents: 9_000 });
    expect(correctedBill(171_000, 160_000)).toMatchObject({ action: 'finish_and_refund', delta_cents: -11_000 });
    expect(correctedBill(171_000, 171_000).action).toBe('none');
  });
});
