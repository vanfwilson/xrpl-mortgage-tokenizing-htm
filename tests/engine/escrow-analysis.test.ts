import { describe, expect, it } from 'vitest';
import { analyzeEscrowYear, assertEscrowPurpose, californiaInterest, cushionLimit, deficiencyOptions, escrowDepositWithRecovery, resolveSurplus, shortageOptions, type ProjectedDisbursement } from '../../src/servicing/analysis.js';

/** Idaho fixture year starting with the first payment: tax $1,710 on Dec 20 and Jun 20, hazard $1,500 on Sep 1. */
const disbursements: ProjectedDisbursement[] = [
  { purpose: 'tax', due: '2026-12-20', cents: 171_000 },
  { purpose: 'tax', due: '2027-06-20', cents: 171_000 },
  { purpose: 'hazard', due: '2027-09-01', cents: 150_000 },
];
const base = { computation_year_start: '2026-11-01', disbursements, borrower_current: true, state: 'ID' as const };

describe('12 CFR 1024.17 escrow analysis', () => {
  it('R01_escrow_purpose: closing escrow is not a servicing purpose', () => {
    expect(() => assertEscrowPurpose('closing_escrow')).toThrow(/R01/);
    expect(() => assertEscrowPurpose('tax')).not.toThrow();
  });

  it('R02_aggregate_trial_balances: month-by-month projection from a zero opening balance', () => {
    const a = analyzeEscrowYear({ ...base, starting_balance_cents: 0 });
    expect(a.annual_disbursements_cents).toBe(492_000);
    expect(a.monthly_deposit_cents).toBe(41_000);
    expect(a.trial_balances.map((t) => t.balance_cents)).toEqual([41_000, -89_000, -48_000, -7_000, 34_000, 75_000, 116_000, -14_000, 27_000, 68_000, -41_000, 0]);
    expect(a.lowest_balance_cents).toBe(-89_000);
    expect(a.lowest_month).toBe(2);
    expect(a.cushion_cents).toBe(82_000);
    expect(a.target_starting_balance_cents).toBe(171_000);
  });

  it('R03_cushion_cap: never exceeds min(1/6 annual, state cap, contract cap) (property)', () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648; return seed / 2_147_483_648; };
    for (let k = 0; k < 500; k++) {
      const annual = Math.floor(rnd() * 2_000_000);
      const stateCap = rnd() < 0.5 ? undefined : Math.floor(rnd() * 3);
      const contractCap = rnd() < 0.5 ? undefined : Math.floor(rnd() * 3);
      const c = cushionLimit(annual, { state_cap_months: stateCap, contract_cap_months: contractCap });
      expect(c).toBeLessThanOrEqual(Math.floor(annual / 6));
      if (stateCap !== undefined) expect(c).toBeLessThanOrEqual(Math.floor(Math.floor(annual / 12) * stateCap));
      if (contractCap !== undefined) expect(c).toBeLessThanOrEqual(Math.floor(Math.floor(annual / 12) * contractCap));
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });

  it('R07_surplus_options: $50.00 vs $49.99 and current vs delinquent', () => {
    expect(resolveSurplus(5_000, true)?.action).toBe('refund');
    expect(resolveSurplus(4_999, true)?.action).toBe('refund_or_credit');
    expect(resolveSurplus(5_000, false)?.action).toBe('refund_or_credit');
    expect(resolveSurplus(0, true)).toBeUndefined();
    const a = analyzeEscrowYear({ ...base, starting_balance_cents: 177_000 });
    expect(a.classification).toBe('surplus');
    expect(a.surplus_cents).toBe(6_000);
    expect(a.surplus_action?.deadline_days).toBe(30);
  });

  it('R08_shortage_options: 30-day option only under one month; at least 12 months otherwise', () => {
    const monthly = 41_000;
    expect(shortageOptions(40_999, monthly).map((o) => o.kind)).toEqual(['do_nothing', 'repay_30_days', 'equal_monthly_payments']);
    expect(shortageOptions(41_000, monthly).map((o) => o.kind)).toEqual(['do_nothing', 'equal_monthly_payments']);
    expect(shortageOptions(41_000, monthly).at(-1)?.min_months).toBe(12);
    const a = analyzeEscrowYear({ ...base, starting_balance_cents: 123_050 }); // the CD initial deposit
    expect(a.classification).toBe('shortage');
    expect(a.shortage_cents).toBe(47_950);
    expect(() => escrowDepositWithRecovery(a, { shortage_months: 6 })).toThrow(/R08/);
    expect(escrowDepositWithRecovery(a, { shortage_months: 12 })).toBe(41_000 + Math.ceil(47_950 / 12));
  });

  it('R09_deficiency_options: 30 days or 2+ payments under one month; 2+ payments otherwise (not 12)', () => {
    const monthly = 41_000;
    expect(deficiencyOptions(40_999, monthly).map((o) => o.kind)).toEqual(['do_nothing', 'repay_30_days', 'equal_monthly_payments']);
    expect(deficiencyOptions(40_999, monthly).at(-1)?.min_months).toBe(2);
    expect(deficiencyOptions(41_000, monthly).map((o) => o.kind)).toEqual(['do_nothing', 'equal_monthly_payments']);
    const a = analyzeEscrowYear({ ...base, starting_balance_cents: -10_000 });
    expect(a.classification).toBe('deficiency');
    expect(a.deficiency_cents).toBe(10_000);
    expect(a.shortage_cents).toBe(171_000);
    expect(() => escrowDepositWithRecovery(a, { deficiency_months: 1 })).toThrow(/R09/);
    expect(escrowDepositWithRecovery(a, { deficiency_months: 2 })).toBe(41_000 + 5_000);
  });

  it('R23_ca_interest: 2% simple interest on the daily balance, credited annually; none for Idaho', () => {
    const flat = [{ date: '2026-01-01', balance_cents: 100_000 }];
    expect(californiaInterest(flat, 'CA', '2026-12-31')).toBe(2_000);
    expect(californiaInterest(flat, 'ID', '2026-12-31')).toBe(0);
    // leap year and mid-year change
    const mixed = [{ date: '2028-01-01', balance_cents: 100_000 }, { date: '2028-07-01', balance_cents: 0 }];
    expect(californiaInterest(mixed, 'CA', '2028-12-31')).toBe(Math.round((100_000 * 182 * 0.02) / 366));
    const a = analyzeEscrowYear({ ...base, state: 'CA', starting_balance_cents: 171_000, prior_year_balances: flat, computation_year_start: '2027-01-01' });
    expect(a.california_interest_cents).toBe(2_000);
  });

  it('balanced: actual equals target -> no surplus, shortage or deficiency', () => {
    const a = analyzeEscrowYear({ ...base, starting_balance_cents: 171_000 });
    expect(a.classification).toBe('balanced');
    expect(a.annual_statement_due).toBe('2027-11-30');
  });
});
