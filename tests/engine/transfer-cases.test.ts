import { describe, expect, it } from 'vitest';
import { misdirectedPayment, ownershipTransferNotice, servicingTransferCase } from '../../src/servicing/transfer.js';
import { delinquencyCase, forcePlacedClock, informationRequestCase, lossMitigationClock, noticeOfErrorCase } from '../../src/servicing/cases.js';

describe('R11 servicing transfer (12 CFR 1024.33)', () => {
  it('R11_transfer_notices: 15 days before, 15 days after, 60-day grace', () => {
    const t = servicingTransferCase('2027-03-01');
    expect(t.transferor_notice_due).toBe('2027-02-14');
    expect(t.transferee_notice_due).toBe('2027-03-16');
    expect(t.grace_until).toBe('2027-04-30');
    expect(misdirectedPayment(t, '2027-04-30').treated_as_timely).toBe(true);
    expect(misdirectedPayment(t, '2027-05-01').treated_as_timely).toBe(false);
    expect(t.steps).toContain('transfer loan-record NFToken by zero-price offer');
  });
});

describe('R18 ownership transfer (12 CFR 1026.39)', () => {
  it('R18_ownership_notice: whole loan -> notice within 30 days; partial interest with unchanged notice party -> exempt', () => {
    expect(ownershipTransferNotice({ acquired_on: '2027-05-10', partial_interest: false, notice_party_changed: false })).toMatchObject({ notice_required: true, due_by: '2027-06-09' });
    expect(ownershipTransferNotice({ acquired_on: '2027-05-10', partial_interest: true, notice_party_changed: false }).notice_required).toBe(false);
    expect(ownershipTransferNotice({ acquired_on: '2027-05-10', partial_interest: true, notice_party_changed: true }).notice_required).toBe(true);
  });
});

describe('R12 notice of error / information request (12 CFR 1024.35, .36)', () => {
  it('R12_noe_rfi_clocks: business days skip the weekend and Veterans Day', () => {
    const n = noticeOfErrorCase('2026-11-06'); // Friday; 2026-11-11 is a holiday
    expect(n.acknowledge_by).toBe('2026-11-16');
    expect(noticeOfErrorCase('2026-11-06', 'payoff').respond_by).toBe('2026-11-18');
    expect(n.extended_respond_by).toBeDefined();
    const r = informationRequestCase('2026-11-06', true);
    expect(r.respond_by).toBe('2026-11-23');
  });
});

describe('R13 force-placed insurance (12 CFR 1024.37)', () => {
  it('R13_force_placed: 45 days before charging, reminder at least 30 days after the first notice, 15-day refund', () => {
    const f = forcePlacedClock('2026-10-01');
    expect(f.reminder_earliest).toBe('2026-10-31');
    expect(f.may_charge_on).toBe('2026-11-15');
    expect(f.refund_within_days_of_evidence).toBe(15);
  });
});

describe('R15 early intervention and loss mitigation (12 CFR 1024.39, .41)', () => {
  it('R15_delinquency_state_machine: day 36 live contact, day 45 written notice, referral after 120', () => {
    expect(delinquencyCase(undefined, '2027-01-01').state).toBe('current');
    expect(delinquencyCase('2026-12-02', '2027-01-06').state).toBe('delinquent');
    expect(delinquencyCase('2026-12-02', '2027-01-07').state).toBe('early_intervention_live_contact_due');
    expect(delinquencyCase('2026-12-02', '2027-01-16').state).toBe('early_intervention_written_notice_due');
    expect(delinquencyCase('2026-12-02', '2027-04-01').state).toBe('early_intervention_written_notice_due');
    expect(delinquencyCase('2026-12-02', '2027-04-02').state).toBe('foreclosure_referral_eligible');
    const lm = lossMitigationClock('2027-02-01');
    expect(lm.acknowledge_by).toBe('2027-02-08');
    expect(lm.evaluate_by).toBe('2027-03-03');
    expect(lm.evaluation_required).toBe(true);
    expect(lossMitigationClock('2027-02-01', '2027-03-01').evaluation_required).toBe(false);
  });
});
