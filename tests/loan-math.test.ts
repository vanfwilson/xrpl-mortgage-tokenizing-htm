import { describe, expect, it } from 'vitest';
import { amortizationSchedule, FHA_LATE_CHARGE_MAX, fhaAnnualMipRate, fhaBaseFromNote, fhaLateCharge, fhaPremiums, monthlyPayment, toCents } from '../src/domain/loan-math.js';

describe('loan math', () => {
  it('computes the level P&I for the demo note ($450,000 @ 6.25% / 360)', () => {
    expect(monthlyPayment(450_000, 0.0625, 360)).toBe(2770.73);
  });
  it('schedule fully amortizes and interest declines', () => {
    const rows = amortizationSchedule(450_000, 0.0625, 360);
    expect(rows).toHaveLength(360);
    expect(rows.at(-1)!.balance).toBe(0);
    expect(rows[0].interest).toBe(2343.75);
    expect(rows[0].interest).toBeGreaterThan(rows[359].interest);
    const principalPaid = rows.reduce((s, r) => s + toCents(r.principal), 0);
    expect(principalPaid).toBe(toCents(450_000));
  });
});

describe('R21 FHA premiums on the BASE loan (HUD ML 2023-05)', () => {
  it('re-bases a $450,000 note to base + 1.75% UFMIP', () => {
    const base = fhaBaseFromNote(450_000);
    expect(base).toBe(442_260.44);
    const p = fhaPremiums(base, 560_000, 565_000, 360);
    expect(p).toEqual({ base_loan_amount: 442_260.44, ufmip: 7739.56, note_amount: 450_000, ltv: 0.7898, annual_mip_rate: 0.005, monthly_mip: 184.28 });
  });
  it('LTV uses the lesser of price and appraisal', () => {
    expect(fhaPremiums(442_260.44, 565_000, 560_000, 360).ltv).toBe(0.7898);
  });
  it('applies the ML 2023-05 table boundaries', () => {
    expect(fhaAnnualMipRate(0.95, 500_000, 360)).toBe(0.005);
    expect(fhaAnnualMipRate(0.9501, 500_000, 360)).toBe(0.0055);
    expect(fhaAnnualMipRate(0.9, 800_000, 360)).toBe(0.007);
    expect(fhaAnnualMipRate(0.96, 800_000, 360)).toBe(0.0075);
    expect(fhaAnnualMipRate(0.9, 500_000, 180)).toBe(0.0015);
    expect(fhaAnnualMipRate(0.91, 500_000, 180)).toBe(0.004);
  });
});

describe('R20 FHA late charge (24 CFR 203.25)', () => {
  it('is 4% of P&I: $2,770.73 -> $110.83', () => {
    expect(fhaLateCharge(2770.73)).toBe(110.83);
    expect(FHA_LATE_CHARGE_MAX).toBe(0.04);
  });
  it('refuses a note percentage above the cap', () => {
    expect(() => fhaLateCharge(2770.73, 0.05)).toThrow(RangeError);
  });
});
