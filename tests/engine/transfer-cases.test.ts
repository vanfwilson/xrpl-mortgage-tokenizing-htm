import { describe, expect, it } from 'vitest';
import { misdirectedPayment, ownershipTransferNotice, servicingTransferCase, servicingTransferPackage, transferredPayment, TRANSFER_RECORD_KINDS } from '../../src/servicing/transfer.js';
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

  const manifest = {
    companyId: 'bank', loanId: 'loan', effectiveOn: '2026-02-01', transferorId: 'servicer-a', transfereeId: 'servicer-b',
    transferorNotice: { on: '2026-01-15', evidenceId: 'notice-a' }, transfereeNotice: { on: '2026-02-10', evidenceId: 'notice-b' },
    reconciledCents: { bank: 100, servicing: 100, settlement: 100 },
    records: TRANSFER_RECORD_KINDS.map((kind) => ({ kind, sha256: 'a'.repeat(64) })),
    acceptedBy: 'bank-reviewer', acceptedOn: '2026-02-10',
  };

  it('R11_transfer_package_manifest', () => {
    const pkg = servicingTransferPackage(manifest);
    expect(pkg.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(pkg).toMatchObject({ legalOwnershipChanged: false, accessCutoverRequired: true });
    expect(pkg.payload.records.map((r) => r.kind)).toEqual([...TRANSFER_RECORD_KINDS].sort());
    expect(pkg.payload).toMatchObject({ graceUntil: '2026-04-02', transferorNoticeDue: '2026-01-17', transfereeNoticeDue: '2026-02-16' });
    // Deterministic: record order in the input does not change the manifest hash.
    expect(servicingTransferPackage({ ...manifest, records: [...manifest.records].reverse() }).sha256).toBe(pkg.sha256);
    expect(servicingTransferPackage({ ...manifest, records: manifest.records.map((r, i) => (i === 0 ? { ...r, sha256: 'b'.repeat(64) } : r)) }).sha256).not.toBe(pkg.sha256);

    expect(() => servicingTransferPackage({ ...manifest, records: manifest.records.slice(1) })).toThrow(/complete/);
    expect(() => servicingTransferPackage({ ...manifest, records: [...manifest.records.slice(1), manifest.records[1]] })).toThrow(/complete/);
    expect(() => servicingTransferPackage({ ...manifest, records: manifest.records.map((r) => ({ ...r, sha256: 'A'.repeat(64) })) })).toThrow(/hex/);
    expect(() => servicingTransferPackage({ ...manifest, reconciledCents: { bank: 100, servicing: 99, settlement: 100 } })).toThrow(/reconciliation/);
    expect(() => servicingTransferPackage({ ...manifest, acceptedOn: '2026-01-31' })).toThrow(/precedes/);
    expect(() => servicingTransferPackage({ ...manifest, transferorNotice: { on: '2026-01-18', evidenceId: 'notice-a' } })).toThrow(/notice window/);
    expect(() => servicingTransferPackage({ ...manifest, transfereeNotice: { on: '2026-02-17', evidenceId: 'notice-b' } })).toThrow(/notice window/);
    expect(() => servicingTransferPackage({ ...manifest, transfereeId: 'servicer-a' })).toThrow(/differ/);
    expect(() => servicingTransferPackage({ ...manifest, acceptedBy: '' })).toThrow(/authority/);
    expect(() => servicingTransferPackage({ ...manifest, effectiveOn: 'bad' })).toThrow(/ISO date/);
  });

  it('R11_transferred_payment_protection', () => {
    const input = { effectiveOn: '2026-01-01', receivedOn: '2026-03-02', receivedBy: 'transferor' as const, otherwiseTimely: true };
    expect(transferredPayment(input)).toMatchObject({ protectedReceipt: true, suppressTransferLateFee: true, suppressTransferAdverseReporting: true, forwardRequired: true, creditReceivedOn: '2026-03-02' });
    // Day 61 is outside the grace period; forwarding is still required.
    expect(transferredPayment({ ...input, receivedOn: '2026-03-03' })).toMatchObject({ protectedReceipt: false, suppressTransferLateFee: false, forwardRequired: true });
    expect(transferredPayment({ ...input, otherwiseTimely: false }).protectedReceipt).toBe(false);
    expect(transferredPayment({ ...input, receivedBy: 'transferee' })).toMatchObject({ protectedReceipt: false, forwardRequired: false });
    expect(transferredPayment({ ...input, receivedOn: '2025-12-31' })).toMatchObject({ protectedReceipt: false, forwardRequired: false });
    expect(() => transferredPayment({ ...input, receivedOn: '2026-02-30' })).toThrow(/calendar date/);
  });
});

describe('R18 ownership transfer (12 CFR 1026.39)', () => {
  it('R18_ownership_notice: whole loan -> notice within 30 days; partial interest with unchanged notice party -> exempt', () => {
    expect(ownershipTransferNotice({ acquired_on: '2027-05-10', partial_interest: false, notice_party_changed: false })).toMatchObject({ notice_required: true, due_by: '2027-06-09' });
    expect(ownershipTransferNotice({ acquired_on: '2027-05-10', partial_interest: true, notice_party_changed: false }).notice_required).toBe(false);
    expect(ownershipTransferNotice({ acquired_on: '2027-05-10', partial_interest: true, notice_party_changed: true }).notice_required).toBe(true);
  });

  it('R18_ownership_notice_unchanged', () => {
    // A servicing transfer package never changes the legal owner, so it starts no 1026.39 clock on its own.
    const pkg = servicingTransferPackage({
      companyId: 'bank', loanId: 'loan', effectiveOn: '2026-02-01', transferorId: 'servicer-a', transfereeId: 'servicer-b',
      transferorNotice: { on: '2026-01-15', evidenceId: 'notice-a' }, transfereeNotice: { on: '2026-02-10', evidenceId: 'notice-b' },
      reconciledCents: { bank: 0, servicing: 0, settlement: 0 },
      records: TRANSFER_RECORD_KINDS.map((kind) => ({ kind, sha256: 'c'.repeat(64) })),
      acceptedBy: 'bank-reviewer', acceptedOn: '2026-02-01',
    });
    expect(pkg.legalOwnershipChanged).toBe(false);
    expect(pkg.cite).toMatch(/1026\.39 unaffected/);
    // The 1026.39 clock still runs only from an actual acquisition of the note.
    expect(ownershipTransferNotice({ acquired_on: '2026-02-01', partial_interest: false, notice_party_changed: false })).toMatchObject({ notice_required: true, due_by: '2026-03-03', cite: expect.stringContaining('1026.39') });
    expect(ownershipTransferNotice({ acquired_on: '2026-02-01', partial_interest: true, notice_party_changed: false })).toMatchObject({ notice_required: false, exception: expect.stringContaining('1026.39(c)(3)') });
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
