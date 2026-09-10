import { describe, expect, it } from 'vitest';
import { analyzeEscrowYear, assertEscrowPurpose, californiaInterest, cushionLimit, deficiencyOptions, equalInstallments, escrowDepositWithRecovery, monthlyDeposits, resolveAnalysis, resolveSurplus, shortageOptions, type ProjectedDisbursement } from '../../src/servicing/analysis.js';

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

  it('R03_cushion_cap T3_cushion_cap: never exceeds min(1/6 annual, state cap, contract cap) (property)', () => {
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

  it('R07_surplus_options T4_surplus_boundary: $50.00 vs $49.99 and current vs delinquent', () => {
    expect(resolveSurplus(5_000, true)?.action).toBe('refund');
    expect(resolveSurplus(4_999, true)?.action).toBe('refund_or_credit');
    expect(resolveSurplus(5_000, false)?.action).toBe('refund_or_credit');
    expect(resolveSurplus(0, true)).toBeUndefined();
    const a = analyzeEscrowYear({ ...base, starting_balance_cents: 177_000 });
    expect(a.classification).toBe('surplus');
    expect(a.surplus_cents).toBe(6_000);
    expect(a.surplus_action?.deadline_days).toBe(30);
  });

  it('R08_shortage_options T5_shortage_boundary: 30-day option only under one month; at least 12 months otherwise', () => {
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

  it('R09_deficiency_options T5_deficiency_boundary: 30 days or 2+ payments under one month; 2+ payments otherwise (not 12)', () => {
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

  it('R02_annual_conservation: ceil(annual/12) deposits with a final-month adjustment sum exactly to annual', () => {
    // 492,000 divides evenly: no adjustment.
    const even = analyzeEscrowYear({ ...base, starting_balance_cents: 0 });
    expect(even.final_month_adjustment_cents).toBe(0);
    expect(even.trial_balances.reduce((t, r) => t + r.deposit_cents, 0)).toBe(492_000);
    // 492,007 does not: monthly = ceil = 41,001; month 12 gives back 5 cents.
    const odd = analyzeEscrowYear({ ...base, starting_balance_cents: 0, disbursements: [...disbursements.slice(0, 2), { purpose: 'hazard', due: '2027-09-01', cents: 150_007 }] });
    expect(odd.annual_disbursements_cents).toBe(492_007);
    expect(odd.monthly_deposit_cents).toBe(41_001);
    expect(odd.final_month_adjustment_cents).toBe(-5);
    expect(odd.trial_balances.map((t) => t.deposit_cents)).toEqual([...Array(11).fill(41_001), 40_996]);
    expect(odd.trial_balances.reduce((t, r) => t + r.deposit_cents, 0)).toBe(492_007);
    expect(odd.trial_balances[11].balance_cents).toBe(0); // zero-opening trial returns to zero after the last disbursement
    // property: every annual in [0, 5000) conserves and the adjustment stays within (-12, 0]
    for (let annual = 0; annual < 5_000; annual++) {
      const m = monthlyDeposits(annual);
      expect(m.deposits.reduce((a, b) => a + b, 0)).toBe(annual);
      expect(m.final_month_adjustment).toBeLessThanOrEqual(0);
      expect(m.final_month_adjustment).toBeGreaterThan(-12);
    }
  });

  it('R07_delinquent_loan_document_review: not current and not balanced -> only loan_document_review; current keeps the $50 rule', () => {
    const surplusDelinquent = analyzeEscrowYear({ ...base, starting_balance_cents: 177_000, borrower_current: false });
    expect(surplusDelinquent.classification).toBe('surplus');
    expect(surplusDelinquent.options).toEqual(['loan_document_review']);
    expect(surplusDelinquent.surplus_action?.action).toBe('refund_or_credit'); // resolveSurplus semantics retained
    expect(resolveAnalysis(surplusDelinquent, 'loan_document_review', '2027-11-05')).toMatchObject({ status: 'manual_review' });
    expect(() => resolveAnalysis(surplusDelinquent, 'refund_30_days', '2027-11-05')).toThrow(/not permitted/);
    const shortDelinquent = analyzeEscrowYear({ ...base, starting_balance_cents: 123_050, borrower_current: false });
    expect(shortDelinquent.options).toEqual(['loan_document_review']);
    expect(shortDelinquent.shortage_options.map((o) => o.kind)).toEqual(['loan_document_review']);
    expect(() => escrowDepositWithRecovery(shortDelinquent, { shortage_months: 12 })).toThrow(/R08/);
    const balancedDelinquent = analyzeEscrowYear({ ...base, starting_balance_cents: 171_000, borrower_current: false });
    expect(balancedDelinquent.options).toEqual(['do_nothing']);
    // current borrower: $50.00 refund only, $49.99 refund or credit
    expect(analyzeEscrowYear({ ...base, starting_balance_cents: 176_000 }).options).toEqual(['refund_30_days']);
    expect(analyzeEscrowYear({ ...base, starting_balance_cents: 175_999 }).options).toEqual(['refund_30_days', 'credit_next_year']);
    const r = resolveAnalysis(analyzeEscrowYear({ ...base, starting_balance_cents: 176_000 }), 'refund_30_days', '2027-11-05');
    expect(r).toMatchObject({ status: 'scheduled', direction: 'refund', amount_cents: 5_000, due_by: '2027-12-05' });
  });

  it('R08_installments_conserve_cents: shortage over >= 12 equal monthly payments, residual cents on the earliest installments', () => {
    const a = analyzeEscrowYear({ ...base, starting_balance_cents: 123_050 }); // shortage 47,950 (one month or more)
    expect(a.options).toEqual(['do_nothing', 'equal_monthly_payments']);
    expect(() => resolveAnalysis(a, 'equal_monthly_payments', '2027-11-05', 11)).toThrow(/R08/);
    expect(() => resolveAnalysis(a, 'collect_30_days', '2027-11-05')).toThrow(/not permitted/);
    const r = resolveAnalysis(a, 'equal_monthly_payments', '2027-11-05', 12);
    if (r.status !== 'scheduled' || r.election !== 'equal_monthly_payments') throw new Error('expected installment schedule');
    expect(r.installments).toHaveLength(12);
    expect(r.installments.reduce((t, i) => t + i.amount_cents, 0)).toBe(47_950);
    // 47,950 / 12 = 3,995 r 10: first ten installments carry the extra cent
    expect(r.installments.map((i) => i.amount_cents)).toEqual([...Array(10).fill(3_996), 3_995, 3_995]);
    expect(r.installments[0].due).toBe('2027-12-05');
    expect(r.new_monthly_escrow_cents).toBe(41_000 + 3_996);
    // under one month: 30-day collection is also allowed
    const small = analyzeEscrowYear({ ...base, starting_balance_cents: 170_999 });
    expect(small.options).toEqual(['do_nothing', 'collect_30_days', 'equal_monthly_payments']);
    expect(resolveAnalysis(small, 'collect_30_days', '2027-11-05')).toMatchObject({ direction: 'collect', amount_cents: 1, due_by: '2027-12-05' });
    for (const [total, months] of [[1, 12], [47_950, 13], [123_457, 24], [0, 12]] as const) {
      const inst = equalInstallments(total, months, '2027-12-01');
      expect(inst.reduce((t, i) => t + i.amount_cents, 0)).toBe(total);
      expect(Math.max(...inst.map((i) => i.amount_cents)) - Math.min(...inst.map((i) => i.amount_cents))).toBeLessThanOrEqual(1);
    }
  });

  it('R09_installments_conserve_cents: deficiency over >= 2 equal payments (not 12); shortage component separately over >= 12', () => {
    const a = analyzeEscrowYear({ ...base, starting_balance_cents: -10_001 });
    expect(a.classification).toBe('deficiency');
    expect(a.options).toEqual(['do_nothing', 'collect_30_days', 'equal_monthly_payments']);
    expect(() => resolveAnalysis(a, 'equal_monthly_payments', '2027-11-05', 1)).toThrow(/R09/);
    const r = resolveAnalysis(a, 'equal_monthly_payments', '2027-11-05', 3);
    if (r.status !== 'scheduled' || r.election !== 'equal_monthly_payments') throw new Error('expected installment schedule');
    expect(r.basis).toBe('deficiency');
    expect(r.installments.map((i) => i.amount_cents)).toEqual([3_334, 3_334, 3_333]);
    expect(r.installments.reduce((t, i) => t + i.amount_cents, 0)).toBe(10_001);
    expect(r.shortage_installments).toHaveLength(12);
    expect(r.shortage_installments!.reduce((t, i) => t + i.amount_cents, 0)).toBe(171_000);
    expect(r.new_monthly_escrow_cents).toBe(41_000 + 3_334 + 14_250);
    // one month or more: no 30-day option, still 2+ payments
    const big = analyzeEscrowYear({ ...base, starting_balance_cents: -41_000 });
    expect(big.options).toEqual(['do_nothing', 'equal_monthly_payments']);
    const r2 = resolveAnalysis(big, 'equal_monthly_payments', '2027-11-05', 2);
    if (r2.status !== 'scheduled' || r2.election !== 'equal_monthly_payments') throw new Error('expected installment schedule');
    expect(r2.installments.map((i) => i.amount_cents)).toEqual([20_500, 20_500]);
  });

  it('balanced: actual equals target -> no surplus, shortage or deficiency', () => {
    const a = analyzeEscrowYear({ ...base, starting_balance_cents: 171_000 });
    expect(a.classification).toBe('balanced');
    expect(a.annual_statement_due).toBe('2027-11-30');
  });
});
