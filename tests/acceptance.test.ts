import { describe, expect, it } from 'vitest';
import { buildCanonicalFromDocuments } from '../src/ingest/canonical.js';
import { amortizationSchedule, fhaLateCharge, fhaPremiums } from '../src/domain/loan-math.js';
import { planMonthlyApplication } from '../src/servicing/apply.js';
import { analyzeEscrowYear, californiaInterest, cushionLimit } from '../src/servicing/analysis.js';
import { ensureDisbursement, type VerifiedBill } from '../src/servicing/disburse.js';
import { annualEscrowStatement, initialEscrowStatement } from '../src/servicing/statements.js';
import { build1098, build1099INT } from '../src/servicing/tax.js';
import { buildTokenEscrow } from '../src/xrpl/escrow.js';
import { encodeLoanRecordUri } from '../src/xrpl/record.js';
import { buildSettlementMemo } from '../src/xrpl/settle.js';

const loan = buildCanonicalFromDocuments('data/documents');
const due = { principal: 34280, interest: 242793, tax: 28500, hazard: 12500, mip: 18428, fees: 0 };
const analysis = (balance: number, monthly = 10000, current = true) => analyzeEscrowYear({
  startingBalanceCents: 0, currentBalanceCents: balance, currentMonthlyDepositCents: monthly,
  disbursements: [{ month: 12, purpose: 'tax', amountCents: 120000 }], borrowerCurrent: current,
});

describe('T1-T12 build acceptance', () => {
  it('T1 conserves every cent for 12 fixture periods and a 360-period property run', () => {
    for (const periods of [12, 360]) for (let n = 1; n <= periods; n++) {
      const varied = { ...due, principal: due.principal + n, interest: due.interest - n };
      const receivedCents = Object.values(varied).reduce((a, b) => a + b, 0);
      expect(planMonthlyApplication({ companyId: 'bank', loanId: 'loan', period: `p${n}`, receivedAt: '2026-01-01T00:00:00Z', receivedCents, due: varied }).conservationCents).toBe(receivedCents);
    }
  });
  it('T2 creates no premature escrow request and advances a verified due bill before a fully funded request', () => {
    const bill: VerifiedBill = { id: 'tax', purpose: 'tax', amountCents: 171000, dueDate: '2026-12-20', payeeId: 'county', verifiedAt: '2026-12-01T00:00:00Z' };
    const twoReceipts = 57000;
    expect(twoReceipts).toBeLessThan(bill.amountCents);
    expect(ensureDisbursement({ bill, asOf: '2026-12-01', availableCents: twoReceipts, borrowerDaysOverdue: 0, allowlistedPayeeIds: ['county'] }).status).toBe('forecast_only');
    const dueShort = ensureDisbursement({ bill, availableCents: twoReceipts, borrowerDaysOverdue: 0, allowlistedPayeeIds: ['county'] });
    expect(dueShort.advance?.amountCents).toBe(114000);
    expect(dueShort.status).toBe('advance_required');
    expect(dueShort.escrow).toBeUndefined();
    expect(ensureDisbursement({ bill, availableCents: 171000, borrowerDaysOverdue: 0, allowlistedPayeeIds: ['county'] }).advance).toBeNull();
  });
  it('T3 never exceeds the lowest cushion cap across deterministic property cases', () => {
    for (let annual = 1; annual <= 250000; annual += 7919) {
      const federal = Math.floor(annual / 6), state = Math.floor(annual / 8), contract = Math.floor(annual / 10);
      expect(cushionLimit(annual, state, contract)).toBeLessThanOrEqual(Math.min(federal, state, contract));
    }
  });
  it('T4 handles $49.99/$50.00 surplus and current/delinquent borrowers', () => {
    const target = analysis(0).targetOpeningCents;
    expect(analysis(target + 4999, 10000, true).options).toContain('credit_next_year');
    expect(analysis(target + 5000, 10000, true).options).toEqual(['refund_30_days']);
    expect(analysis(target + 5000, 10000, false).options).toEqual(['loan_document_review']);
  });
  it('T5 matches shortage and deficiency options at the one-month boundary', () => {
    const target = analysis(0).targetOpeningCents;
    expect(analysis(target - 9999).options).toEqual(['do_nothing', 'collect_30_days', 'collect_12_or_more']);
    expect(analysis(target - 10000).options).toEqual(['do_nothing', 'collect_12_or_more']);
    expect(analysis(-9999).options).toEqual(['do_nothing', 'collect_30_days', 'collect_2_or_more']);
    expect(analysis(-10000).options).toEqual(['do_nothing', 'collect_2_or_more']);
  });
  it('T6 enforces day 45/46 and day 30/31 statement boundaries', () => {
    expect(initialEscrowStatement('2026-01-01', '2026-02-15', {})).toBeTruthy();
    expect(() => initialEscrowStatement('2026-01-01', '2026-02-16', {})).toThrow();
    expect(annualEscrowStatement('2026-12-31', '2027-01-30', {})).toBeTruthy();
    expect(() => annualEscrowStatement('2026-12-31', '2027-01-31', {})).toThrow();
  });
  it('T7 applies CA 2% daily accrual in leap/common years and the $10 reporting threshold', () => {
    expect(californiaInterest(Array(365).fill(50000))).toBe(1000);
    expect(californiaInterest(Array(366).fill(50000), 366)).toBe(1000);
    expect(californiaInterest(Array(183).fill(50000), 366)).toBe(500);
    expect(build1099INT(2026, 999).required).toBe(false); expect(build1099INT(2026, 1000).required).toBe(true);
  });
  it('T8 reconciles 1098 Boxes 1/2 and effective-dated Boxes 5/11', () => {
    const schedule = amortizationSchedule(450000, .0625, 360); const posted = schedule.slice(0, 12).reduce((a, r) => a + Math.round(r.interest * 100), 0);
    const common = { schedule, periodsReceived: Array.from({ length: 12 }, (_, i) => i + 1), january1PrincipalCents: 45000000, acquisitionPrincipalCents: 45000000, originationDate: '2025-01-01', mipCents: 60000, taxPaidCents: 0, hazardPaidCents: 0, address: 'property' };
    const f = build1098({ ...common, rules: { taxYear: 2026, mipReportable: true, box10Enabled: false }, acquisitionDate: '2026-02-01' });
    expect(f.box1InterestCents).toBe(posted); expect(f.box2PrincipalCents).toBe(45000000); expect(f.box5MipCents).toBe(60000); expect(f.box11AcquisitionDate).toBe('2026-02-01');
    expect(build1098({ ...common, rules: { taxYear: 2026, mipReportable: false, box10Enabled: false } }).box5MipCents).toBeUndefined();
  });
  it('T9 refuses TokenEscrow before issuer locking and accepts the controlled-issuer preflight', () => {
    const base = { account: 'rServicer', destination: 'rCounty', issuer: 'rIssuer', amountCents: 100, finishAfterUnix: 1800000000, cancelAfterUnix: 1800000100, allowlist: ['rCounty'] };
    expect(() => buildTokenEscrow({ ...base, issuerInfo: { account_flags: { allowTrustLineLocking: false } } })).toThrow(/preflight refused/);
    expect(buildTokenEscrow({ ...base, issuerInfo: { account_flags: { allowTrustLineLocking: true } } }).Amount).toMatchObject({ value: '1.00' });
  });
  it('T10 builds immutable finish/cancel windows; live early-failure evidence is recorded separately', () => {
    const tx = buildTokenEscrow({ account: 'rS', destination: 'rD', issuer: 'rI', amountCents: 100, finishAfterUnix: 1800000000, cancelAfterUnix: 1800000100, issuerInfo: { account_flags: { allowTrustLineLocking: true } }, allowlist: ['rD'] });
    expect(tx.FinishAfter).toBeLessThan(tx.CancelAfter!); expect(() => buildTokenEscrow({ account: 'rS', destination: 'rD', issuer: 'rI', amountCents: 100, finishAfterUnix: 2, cancelAfterUnix: 1, issuerInfo: { account_flags: { allowTrustLineLocking: true } }, allowlist: ['rD'] })).toThrow();
  });
  it('T11 bounds the NFToken URI, carries the bundle hash, and rejects PII-shaped memo IDs', () => {
    const sha256 = 'a'.repeat(64); const encoded = encodeLoanRecordUri({ schema: 'htm.loan-record', version: 1, loan: 'opaque_1', sha256, ptr: 'ipfs://cid' });
    expect(Buffer.from(encoded, 'hex').byteLength).toBeLessThanOrEqual(256); expect(Buffer.from(encoded, 'hex').toString()).toContain(sha256);
    expect(() => buildSettlementMemo({ v: 1, loan: '123 Main Street', period: '2026-01', leg: 'tax', cents: 1, run: 'run' })).toThrow();
  });
  it('T12 proves the selected $450,000 rebase: 4% late fee, 1.75% base UFMIP, and 15-day grace', () => {
    const base = Math.round(loan.loan.base_loan_amount * 100); const p = fhaPremiums(base, Math.round(loan.property.contract_sales_price * 100), Math.round(loan.property.appraised_value * 100));
    expect(fhaLateCharge(277073)).toBe(11083); expect(p.ufmipCents).toBe(773956); expect(base + p.ufmipCents).toBe(45000000); expect(loan.note_terms.grace_period_days).toBe(15);
  });
});
