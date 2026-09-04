import { describe, expect, it } from 'vitest';
import { amortizationSchedule, fhaAnnualMipRate, monthlyPayment, toTenthBps, usdToMptUnits } from '../src/domain/loan-math.js';

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
    const principalPaid = rows.reduce((s, r) => s + r.principal, 0);
    expect(Math.round(principalPaid)).toBe(450_000);
  });
  it('converts rates to XLS-66 tenth-basis-points', () => {
    expect(toTenthBps(0.0625)).toBe(6250);
    expect(toTenthBps(1)).toBe(100_000);
    expect(() => toTenthBps(1.01)).toThrow(RangeError);
  });
  it('USD to MPT units at AssetScale 2', () => {
    expect(usdToMptUnits(450_000)).toBe('45000000');
    expect(usdToMptUnits(0.01)).toBe('1');
  });
  it('FHA annual MIP for an 80% LTV 30-year loan is 0.50%', () => {
    expect(fhaAnnualMipRate(0.8036)).toBe(0.005);
  });
});
