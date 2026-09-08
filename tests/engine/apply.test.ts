import { describe, expect, it } from 'vitest';
import { planMonthlyApplication, scheduleCents } from '../../src/servicing/apply.js';
import { boardLoan, type Authority } from '../../src/servicing/boarding.js';
import { buildCanonicalFromDocuments } from '../../src/ingest/canonical.js';

const loan = buildCanonicalFromDocuments('data/documents');
const registry: Authority[] = [
  { holder_id: 'bank-sub', state: 'ID', kind: 'ID_mortgage_servicer', valid_from: '2026-01-01', valid_to: '2030-12-31' },
  { holder_id: 'bank-sub', state: 'ID', kind: 'HUD_mortgagee', valid_from: '2026-01-01', valid_to: '2030-12-31' },
];
const { terms } = boardLoan({ loan, company_id: 'c1', loan_id: 'L1', legal_owner_id: 'bank-owner', servicer_of_record_id: 'bank-sub', settlement_date: '2026-09-01', annual_tax_cents: 342_000, annual_hazard_cents: 150_000, registry, profile: 'test' });
const schedule = scheduleCents(terms);
const escrow = { tax: 28_500, hazard: 12_500 };
const MIP = 18_428;
const PITI = 277_073 + 28_500 + 12_500 + 18_428; // 336,501

const receipt = (date: string, cents: number, ref = 'ach-1') => ({ company_id: 'c1', loan_id: 'L1', received_at: `${date}T15:00:00Z`, amount_cents: cents, bank_ref: ref });

describe('R16 payment application (12 CFR 1026.36(c)(1))', () => {
  it('R16_receipt_date_credit: full payment on the due date applies to the cent with the receipt date as effective date', () => {
    const p = planMonthlyApplication({ terms, row: schedule[0], escrow, mip_cents: MIP, receipt: receipt('2026-11-01', PITI), suspense_balance_cents: 0, fees_outstanding_cents: 0 });
    expect(p.ok).toBe(true);
    expect(p.effective_date).toBe('2026-11-01');
    expect(p.late).toBe(false);
    expect(p.legs).toEqual({ principal: 42_698, interest: 234_375, tax: 28_500, hazard: 12_500, mip: 18_428, fees: 0, suspense_in: 0, suspense_out: 0 });
    expect(p.postings.reduce((a, x) => a + x.cents, 0)).toBe(PITI);
  });
  it('T1_four_legs_equal_receipt: 360 periods conserve the receipt to the cent', () => {
    for (const row of schedule) {
      const due = row.interest_cents + row.principal_cents + escrow.tax + escrow.hazard + MIP; // final period is the payoff amount
      const p = planMonthlyApplication({ terms, row, escrow, mip_cents: MIP, receipt: receipt(row.due_date, due), suspense_balance_cents: 0, fees_outstanding_cents: 0 });
      expect(p.ok).toBe(true);
      const sum = p.legs.principal + p.legs.interest + p.legs.tax + p.legs.hazard + p.legs.mip;
      expect(sum).toBe(due);
      if (row.period < 360) expect(due).toBe(PITI);
    }
    expect(schedule.at(-1)!.balance_after_cents).toBe(0);
    expect(schedule.reduce((a, r) => a + r.principal_cents, 0)).toBe(terms.note_amount_cents);
  });
  it('late payment: full periodic payment still applies; the late charge is assessed and paid only from excess', () => {
    const late = planMonthlyApplication({ terms, row: schedule[0], escrow, mip_cents: MIP, receipt: receipt('2026-11-17', PITI), suspense_balance_cents: 0, fees_outstanding_cents: 0 });
    expect(late.late).toBe(true);
    expect(late.late_charge_assessed_cents).toBe(11_083);
    expect(late.legs.fees).toBe(0);
    expect(late.legs.principal + late.legs.interest).toBe(277_073);
    const withExcess = planMonthlyApplication({ terms, row: schedule[0], escrow, mip_cents: MIP, receipt: receipt('2026-11-17', PITI + 20_000), suspense_balance_cents: 0, fees_outstanding_cents: 0 });
    expect(withExcess.legs.fees).toBe(11_083);
    expect(withExcess.legs.suspense_in).toBe(20_000 - 11_083);
    const onGraceDay = planMonthlyApplication({ terms, row: schedule[0], escrow, mip_cents: MIP, receipt: receipt('2026-11-16', PITI), suspense_balance_cents: 0, fees_outstanding_cents: 0 });
    expect(onGraceDay.late).toBe(false);
  });
  it('partial payment goes to suspense; suspense tops up the next full payment', () => {
    const part = planMonthlyApplication({ terms, row: schedule[0], escrow, mip_cents: MIP, receipt: receipt('2026-11-01', 200_000), suspense_balance_cents: 0, fees_outstanding_cents: 0 });
    expect(part.ok).toBe(false);
    expect(part.legs.suspense_in).toBe(200_000);
    expect(part.legs.principal).toBe(0);
    const top = planMonthlyApplication({ terms, row: schedule[0], escrow, mip_cents: MIP, receipt: receipt('2026-11-05', 136_501), suspense_balance_cents: 200_000, fees_outstanding_cents: 0 });
    expect(top.ok).toBe(true);
    expect(top.legs.suspense_out).toBe(200_000);
    expect(top.legs.suspense_in).toBe(0);
  });
  it('R19_consumer_purpose: boarding refuses anything but consumer credit', () => {
    const bad = structuredClone(loan) as any; bad.loan.credit_purpose = 'business';
    expect(() => boardLoan({ loan: bad, company_id: 'c1', loan_id: 'L1', legal_owner_id: 'b', servicer_of_record_id: 'bank-sub', settlement_date: '2026-09-01', annual_tax_cents: 1, annual_hazard_cents: 1, registry, profile: 'test' })).toThrow(/R19/);
  });
});
