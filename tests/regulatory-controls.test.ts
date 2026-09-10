import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { amortizationSchedule, fhaLateCharge, fhaPremiums } from '../src/domain/loan-math.js';
import { buildCanonicalFromDocuments } from '../src/ingest/canonical.js';
import { analyzeEscrowYear, assertServicingPurpose, californiaInterest, cushionLimit } from '../src/servicing/analysis.js';
import { planMonthlyApplication, reverseApplication } from '../src/servicing/apply.js';
import { authorityCheck, boardInitialDeposit } from '../src/servicing/boarding.js';
import { idahoServicingCalendar } from '../src/servicing/calendar.js';
import { delinquencyCase, forcePlacedCase, openRequestCase } from '../src/servicing/cases.js';
import { ensureDisbursement, type VerifiedBill } from '../src/servicing/disburse.js';
import { reconcileThreeWay } from '../src/servicing/reconcile.js';
import { annualEscrowStatement, initialEscrowStatement, periodicStatement, renderStatementPdf } from '../src/servicing/statements.js';
import { build1098, build1099INT, foreclosureTaxH } from '../src/servicing/tax.js';
import { ownershipTransfer, servicingTransfer } from '../src/servicing/transfer.js';
import { buildTwoOfThree } from '../src/xrpl/keys.js';
import { buildSettlementMemo } from '../src/xrpl/settle.js';

const loan = buildCanonicalFromDocuments('data/documents');
const bill: VerifiedBill = { id: 'b1', purpose: 'tax', amountCents: 171000, dueDate: '2026-12-20', payeeId: 'county', verifiedAt: '2026-12-01T00:00:00Z' };
const escrow = (balance = 0, current = true) => analyzeEscrowYear({
  startingBalanceCents: 0, currentBalanceCents: balance, currentMonthlyDepositCents: 10000,
  disbursements: [{ month: 6, purpose: 'tax', amountCents: 60000 }], borrowerCurrent: current,
});

describe('R01-R31 regulatory control matrix', () => {
  it('R01_escrow_purpose', () => expect(() => assertServicingPurpose('closing')).toThrow(/unsupported/));
  it('R02_aggregate_trial_balances', () => expect(escrow().trialBalances).toHaveLength(12));
  it('R03_cushion_cap', () => { expect(cushionLimit(120000)).toBe(20000); expect(cushionLimit(120000, 9000, 11000)).toBe(9000); });
  it('R04_initial_deposit', () => expect(boardInitialDeposit('c', 'l', { tax: 100, hazard: 200 }).map(x => x.purpose)).toEqual(['tax', 'hazard']));
  it('R05_initial_statement_deadline', () => { expect(initialEscrowStatement('2026-01-01', '2026-02-15', {}).deadline).toBe('2026-02-15'); expect(() => initialEscrowStatement('2026-01-01', '2026-02-16', {})).toThrow(); });
  it('R06_annual_statement_deadline', () => { expect(annualEscrowStatement('2026-12-31', '2027-01-30', {}).deadline).toBe('2027-01-30'); expect(() => annualEscrowStatement('2026-12-31', '2027-01-31', {})).toThrow(); });
  it('R07_surplus_options', () => { const r = escrow(45000); expect(r.classification).toBe('surplus'); expect(r.amountCents).toBe(5000); expect(r.options).toEqual(['refund_30_days']); });
  it('R08_shortage_options', () => expect(escrow(0).options).not.toContain('collect_2_or_more'));
  it('R09_deficiency_options', () => { const r = escrow(-10001); expect(r.classification).toBe('deficiency'); expect(r.options).toContain('collect_2_or_more'); });
  it('R10_advance_when_short', () => expect(ensureDisbursement({ bill, availableCents: 1000, borrowerDaysOverdue: 30, allowlistedPayeeIds: ['county'] }).advance?.amountCents).toBe(170000));
  it('R11_transfer_notices', () => expect(servicingTransfer('2026-10-16', '2026-10-01', '2026-10-31').graceEnds).toBe('2026-12-15'));
  it('R12_noe_rfi_clocks', () => { expect(openRequestCase({ kind: 'notice_of_error', openedOn: '2026-01-01', acknowledgedOn: '2026-01-06', evidence: [] }).status).toBe('investigating'); expect(() => openRequestCase({ kind: 'information_request', openedOn: '2026-01-01', acknowledgedOn: '2026-01-09', evidence: [] })).toThrow(); });
  it('R13_force_placed', () => { expect(forcePlacedCase({ kind: 'force_placed', openedOn: '2026-01-01', evidence: [] }, 2, true).status).toBe('eligible'); expect(() => forcePlacedCase({ kind: 'force_placed', openedOn: '2026-01-01', evidence: [] }, 1, true)).toThrow(); });
  it('R14_three_way_match', () => { expect(reconcileThreeWay(10, 10, 10).matched).toBe(true); expect(() => reconcileThreeWay(10, 9, 10)).toThrow(); });
  it('R15_delinquency_state_machine', () => { expect(() => delinquencyCase(36, false, false)).toThrow(); expect(() => delinquencyCase(120, true, false)).toThrow(); });
  it('R16_receipt_date_credit', () => { const p = planMonthlyApplication({ companyId: 'c', loanId: 'l', period: '2026-01', receivedAt: '2026-01-01T01:00:00Z', receivedCents: 3, due: { principal: 1, interest: 1, tax: 1, hazard: 1, mip: 1, fees: 0 } }); expect(p.status).toBe('suspense'); expect(p.entries.suspense).toBe(3); expect(reverseApplication(p, '2026-01-02T00:00:00Z').entries.suspense).toBe(-3); });
  it('R17_periodic_statement', async () => { const s = periodicStatement('2026-11-01', { dueCents: 336501 }); expect(s.payload.dueCents).toBe(336501); expect(Buffer.from(await renderStatementPdf(s)).subarray(0, 4).toString()).toBe('%PDF'); });
  it('R18_ownership_notice', () => { expect(ownershipTransfer('2026-01-01', '2026-01-31', false, false).required).toBe(true); expect(ownershipTransfer('2026-01-01', '2026-03-01', true, false).required).toBe(false); });
  it('R19_consumer_purpose', () => expect(loan.loan.credit_purpose).toBe('consumer'));
  it('R20_fha_late_charge', () => expect(fhaLateCharge(277073)).toBe(11083));
  it('R21_fha_premiums', () => expect(fhaPremiums(44226044, 56000000, 57000000)).toMatchObject({ ufmipCents: 773956, monthlyMipCents: 18428 }));
  it('R22_bank_balance_authoritative', () => expect(reconcileThreeWay(123, 123, 123).authoritativeCents).toBe(123));
  it('R23_ca_interest', () => { expect(californiaInterest(Array(365).fill(10000))).toBe(200); expect(californiaInterest(Array(366).fill(10000), 366)).toBe(200); });
  it('R24_loss_draft_separate', () => expect(boardInitialDeposit('c', 'l', { tax: 1 }).some(x => x.purpose === ('loss_draft' as string))).toBe(false));
  it('R25_idaho_calendar_gate', () => { expect(() => idahoServicingCalendar(2026, false)).toThrow(/UNVERIFIED/); expect(idahoServicingCalendar(2026, true)[1].dueDate).toBe('2027-06-20'); });
  it('R26_license_gate', () => { expect(authorityCheck({ jurisdiction: 'CA', active: true }, '2026-01-01')).toBe(true); expect(() => authorityCheck({ jurisdiction: 'ID', active: false }, '2026-01-01')).toThrow(); });
  it('R27_no_operator_keys', () => expect(JSON.stringify(buildTwoOfThree('rBank', ['rOne', 'rTwo', 'rThree']))).not.toMatch(/Manila|operator/i));
  it('R28_no_pii_payloads', () => { expect(() => buildSettlementMemo({ v: 1, loan: 'Jordan Sandbox', period: '2026-01', leg: 'pi', cents: 1, run: 'r1' })).toThrow(); expect(JSON.stringify(buildSettlementMemo({ v: 1, loan: 'L_1', period: '2026-01', leg: 'pi', cents: 1, run: 'r1' }))).not.toContain('Jordan'); });
  it('R29_form_1098', () => { const f = build1098({ rules: { taxYear: 2026, mipReportable: true, box10Enabled: true }, schedule: amortizationSchedule(450000, .0625, 360), periodsReceived: [1], january1PrincipalCents: 45000000, originationPrincipalCents: 45000000, originationDate: '2026-01-01', mipCents: 100, taxPaidCents: 200, hazardPaidCents: 300, address: 'property' }); expect(f.box1InterestCents).toBe(234375); expect(f.box10OtherCents).toBe(500); });
  it('R30_1099int_threshold', () => { expect(build1099INT(2026, 999).required).toBe(false); expect(build1099INT(2026, 1000).required).toBe(true); expect(foreclosureTaxH(true, true)).toEqual({ form1099AReview: true, form1099CReview: true }); });
  it('R31_no_participation_fields', () => { const sql = fs.readFileSync('db/003_servicing_architecture.sql', 'utf8'); expect(sql).toMatch(/company_id[\s\S]*loan_id/); expect(sql).not.toMatch(/participation|single.asset.vault|lending.protocol/i); });
});
