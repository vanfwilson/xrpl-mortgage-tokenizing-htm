import { describe, expect, it } from 'vitest';
import { DROPS_PER_XRP, FIXTURE_FOOTPRINT, loanYearCost, PRODUCTION_FOOTPRINT, REFERENCE_FEE_DROPS, scaleNote } from '../../src/servicing/cost-model.js';
import { OWNER_RESERVE_DROPS_PER_OBJECT } from '../../src/xrpl/escrow.js';

describe('RS3 cost model (T14)', () => {
  it('T14_cost_model_fixture_loan_year: fees are burned per transaction, reserves are parked per object', () => {
    const c = loanYearCost({ ...FIXTURE_FOOTPRINT, xrp_usd: 2 });
    // 6 legs x 12 months + 2 boarding + 2 escrows x 2 + 8 other = 86 transactions
    expect(c.transactions).toBe(86);
    expect(c.fee_drops).toBe(86 * REFERENCE_FEE_DROPS);
    // 11 trust lines + 1 NFToken + 2 escrows = 14 objects x 0.2 XRP
    expect(c.reserve_drops_peak).toBe(14 * OWNER_RESERVE_DROPS_PER_OBJECT);
    expect(c.fee_usd).toBe((860 / DROPS_PER_XRP) * 2);
    expect(c.reserve_usd_peak).toBe((2_800_000 / DROPS_PER_XRP) * 2);
    expect(c.fee_usd_per_loan_month).toBeCloseTo(c.fee_usd / 12, 6);
    expect(c.all_in_usd_per_loan_month).toBeCloseTo((c.fee_usd + c.reserve_usd_peak) / 12, 6);
    // The operating cost per loan-month is far below the $0.50 floor of the stated price band.
    expect(c.fee_usd_per_loan_month).toBeLessThan(0.01);
    expect(c.all_in_usd_per_loan_month).toBeLessThan(0.5);
    // Production shares the role accounts: 4 objects per loan, 0.8 XRP parked, and the all-in stays under the price floor at $5/XRP.
    const prod = loanYearCost({ ...PRODUCTION_FOOTPRINT, xrp_usd: 5 });
    expect(prod.reserve_drops_peak).toBe(4 * OWNER_RESERVE_DROPS_PER_OBJECT);
    expect(prod.all_in_usd_per_loan_month).toBeLessThan(0.5);
  });

  it('T14_cost_model_price_is_an_input: doubling the XRP price doubles dollars and leaves drops unchanged', () => {
    const a = loanYearCost({ ...FIXTURE_FOOTPRINT, xrp_usd: 1 });
    const b = loanYearCost({ ...FIXTURE_FOOTPRINT, xrp_usd: 2 });
    expect(b.fee_drops).toBe(a.fee_drops);
    expect(b.fee_usd).toBeCloseTo(a.fee_usd * 2, 9);
    expect(loanYearCost({ ...FIXTURE_FOOTPRINT, xrp_usd: 1, fee_drops: 20 }).fee_drops).toBe(a.fee_drops * 2);
    expect(() => loanYearCost({ ...FIXTURE_FOOTPRINT, xrp_usd: 0 })).toThrow(/xrp_usd/);
    expect(() => loanYearCost({ ...FIXTURE_FOOTPRINT, xrp_usd: 1, months: 0 })).toThrow(/months/);
    expect(() => loanYearCost({ ...FIXTURE_FOOTPRINT, xrp_usd: 1, escrows: -1 })).toThrow(/escrows/);
  });

  it('T14_scale_note: linear in loans; batching across accounts collapses wall-clock time', () => {
    const one = scaleNote(1);
    const thousand = scaleNote(1_000);
    expect(one.transactions_per_month).toBe(6); // 6 legs + 4/12 escrow txs rounds to 6
    expect(thousand.transactions_per_month).toBe(Math.round(1_000 * (6 + 4 / 12)));
    expect(thousand.reserve_xrp_peak).toBeCloseTo(one.reserve_xrp_peak * 1_000, 6);
    expect(thousand.serial_hours_per_month).toBeGreaterThan(thousand.batched_hours_per_month * 10);
    expect(scaleNote(10_000).batched_hours_per_month).toBeLessThan(2);
    expect(() => scaleNote(0)).toThrow(/loans/);
    expect(() => scaleNote(1, 0)).toThrow(/per_ledger/);
  });
});
