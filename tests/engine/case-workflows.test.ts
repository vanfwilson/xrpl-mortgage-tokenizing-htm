import { describe, expect, it } from 'vitest';
import { forcePlacedCase, requestCase } from '../../src/servicing/cases.js';
import { earlyIntervention, lossMitigationCase, type MitigationEvent, type MitigationInput } from '../../src/servicing/loss-mitigation.js';

/*
 * Federal business-day calendar (src/servicing/calendar.ts) is used throughout:
 * 2026-01-02 is a Friday; 2026-01-19 (MLK) and 2026-02-16 (Presidents Day) are skipped.
 *   +5 business days  -> 2026-01-09
 *   +30 business days -> 2026-02-17
 *   +45 business days -> 2026-03-10
 */

describe('R12 notice of error / information request with evidence (12 CFR 1024.35, .36)', () => {
  const input = { kind: 'notice_of_error' as const, receivedOn: '2026-01-02', asOf: '2026-03-20', category: 'general' as const };

  it('R12_request_case_lifecycle', () => {
    // Nothing on file by asOf: both clocks overdue, never a fee.
    expect(requestCase(input)).toMatchObject({ status: 'received', ackDeadline: '2026-01-09', responseDeadline: '2026-02-17', ackOverdue: true, responseOverdue: true, feePermitted: false, creditReportingHoldUntil: '2026-03-03' });
    expect(requestCase({ ...input, acknowledgment: { on: '2026-01-05', evidenceId: 'ack' } })).toMatchObject({ status: 'acknowledged', ackOverdue: false });

    const full = requestCase({
      ...input,
      acknowledgment: { on: '2026-01-05', evidenceId: 'ack' },
      extension: { on: '2026-02-01', evidenceId: 'extension', reason: 'records retrieval' },
      investigation: { on: '2026-02-02', evidenceId: 'review', reviewedRecordIds: ['receipt-2025-12'] },
      response: { on: '2026-02-20', evidenceId: 'response', outcome: 'corrected', explanation: 'reversed duplicate fee', assistancePhone: '555-0100' },
    });
    expect(full).toMatchObject({ status: 'responded', ackDeadline: '2026-01-09', responseDeadline: '2026-03-10', ackOverdue: false, responseOverdue: false, feePermitted: false, creditReportingHoldUntil: '2026-03-03' });

    // Special clocks: payoff 7 business days, owner identity 10, foreclosure error bounded by the sale date.
    expect(requestCase({ ...input, category: 'payoff_error' }).responseDeadline).toBe('2026-01-13');
    expect(requestCase({ ...input, kind: 'information_request', category: 'owner_identity' })).toMatchObject({ responseDeadline: '2026-01-16', creditReportingHoldUntil: undefined });
    expect(requestCase({ ...input, category: 'foreclosure_error', saleDate: '2026-02-01' }).responseDeadline).toBe('2026-02-01');

    // Guardrails.
    expect(() => requestCase({ ...input, category: 'payoff_error', extension: { on: '2026-01-03', evidenceId: 'ext', reason: 'delay' } })).toThrow(/not permitted/);
    expect(() => requestCase({ ...input, extension: { on: '2026-02-18', evidenceId: 'ext', reason: 'late' } })).toThrow(/not permitted/);
    expect(() => requestCase({ ...input, response: { on: '2026-01-05', evidenceId: 'response', outcome: 'no_error', explanation: 'none', assistancePhone: '555-0100' } })).toThrow(/investigation/i);
    expect(() => requestCase({ ...input, investigation: { on: '2026-01-10', evidenceId: 'review', reviewedRecordIds: ['r'] }, response: { on: '2026-01-12', evidenceId: 'response', outcome: 'information_provided', explanation: 'x', assistancePhone: '555' } })).toThrow(/outcome/);
    expect(() => requestCase({ ...input, acknowledgment: { on: '2026-01-05', evidenceId: 'same' }, investigation: { on: '2026-01-06', evidenceId: 'same', reviewedRecordIds: ['r'] } })).toThrow(/duplicate/);
    expect(() => requestCase({ ...input, acknowledgment: { on: '2026-01-08', evidenceId: 'ack' }, investigation: { on: '2026-01-06', evidenceId: 'review', reviewedRecordIds: ['r'] } })).toThrow(/chronological/);
    expect(() => requestCase({ ...input, acknowledgment: { on: '2026-03-21', evidenceId: 'ack' } })).toThrow(/asOf/);
    expect(() => requestCase({ ...input, acknowledgment: { on: '2026-01-05', evidenceId: '' } })).toThrow(/evidenceId/);
    expect(() => requestCase({ ...input, category: 'owner_identity' })).toThrow(/category/);
    expect(() => requestCase({ ...input, receivedOn: '2026-02-30' })).toThrow(/calendar date/);
  });

  it('R12_exception_routes_to_specialist', () => {
    const exception = requestCase({ ...input, exception: { reason: 'duplicate', determined: { on: '2026-01-03', evidenceId: 'determination' }, reviewerId: 'bank-reviewer', rationale: 'prior response identified' } });
    expect(exception).toMatchObject({ status: 'specialist_review', exceptionNoticeDeadline: '2026-01-09', overdue: true, automaticClosure: false, feePermitted: false });
    const noticed = requestCase({ ...input, exception: { reason: 'overbroad', determined: { on: '2026-01-03', evidenceId: 'determination' }, notice: { on: '2026-01-08', evidenceId: 'notice' }, reviewerId: 'bank-reviewer', rationale: 'asks for every record since origination' } });
    expect(noticed).toMatchObject({ status: 'specialist_review', overdue: false });
    // A notice of error is never dismissed as privileged/irrelevant; every exception needs a reviewer and rationale.
    expect(() => requestCase({ ...input, exception: { reason: 'privileged', determined: { on: '2026-01-03', evidenceId: 'd' }, reviewerId: 'r', rationale: 'x' } })).toThrow(/review required/);
    expect(() => requestCase({ ...input, exception: { reason: 'duplicate', determined: { on: '2026-01-03', evidenceId: 'd' }, reviewerId: '', rationale: 'x' } })).toThrow(/review required/);
    expect(() => requestCase({ ...input, exception: { reason: 'duplicate', determined: { on: '2026-01-05', evidenceId: 'd' }, notice: { on: '2026-01-04', evidenceId: 'n' }, reviewerId: 'r', rationale: 'x' } })).toThrow(/chronological/);
    expect(requestCase({ ...input, kind: 'information_request', exception: { reason: 'irrelevant', determined: { on: '2026-01-03', evidenceId: 'd' }, notice: { on: '2026-01-05', evidenceId: 'n' }, reviewerId: 'r', rationale: 'not about servicing' } }).status).toBe('specialist_review');
  });
});

describe('R13 force-placed insurance case (12 CFR 1024.37)', () => {
  const input = { asOf: '2026-03-15', basis: 'coverage_lapsed' as const, basisEvidenceId: 'carrier-cancellation', escrowCanMaintainExistingPolicy: false, firstNotice: { on: '2026-01-01', evidenceId: 'first' }, reminder: { on: '2026-01-31', evidenceId: 'second' }, charge: { on: '2026-02-15', evidenceId: 'charge', cents: 5000 } };

  it('R13_force_placed_case_blocks_early_charge', () => {
    expect(forcePlacedCase(input)).toMatchObject({ status: 'charged', mayCharge: false, overdue: false });
    expect(forcePlacedCase({ ...input, charge: undefined })).toMatchObject({ status: 'reminder_sent', mayCharge: false });
    expect(() => forcePlacedCase({ ...input, charge: { ...input.charge, on: '2026-02-14' } })).toThrow(/blocked/);
    expect(() => forcePlacedCase({ ...input, reminder: { ...input.reminder, on: '2026-02-05' }, charge: { ...input.charge, on: '2026-02-16' } })).toThrow(/blocked/);
    expect(() => forcePlacedCase({ ...input, reminder: { ...input.reminder, on: '2026-01-30' } })).toThrow(/reminder too early/);
    expect(() => forcePlacedCase({ ...input, reminder: undefined })).toThrow(/blocked/);
    expect(() => forcePlacedCase({ ...input, escrowCanMaintainExistingPolicy: true })).toThrow(/blocked/);
    expect(forcePlacedCase({ ...input, escrowCanMaintainExistingPolicy: true, charge: undefined }).status).toBe('maintain_existing_policy');
    expect(() => forcePlacedCase({ ...input, coverage: { on: '2026-02-10', evidenceId: 'policy', overlapPremiumCents: 0, overlapFeesCents: 0 } })).toThrow(/blocked/);
    expect(() => forcePlacedCase({ ...input, basisEvidenceId: '' })).toThrow(/reasonable basis/);
    expect(() => forcePlacedCase({ ...input, charge: { ...input.charge, on: '2026-03-16' } })).toThrow(/asOf/);
    expect(() => forcePlacedCase({ ...input, reminder: { ...input.reminder, evidenceId: 'first' } })).toThrow(/duplicate/);
  });

  it('R13_force_placed_refund_within_15_days', () => {
    const covered = { ...input, coverage: { on: '2026-02-20', evidenceId: 'policy', overlapPremiumCents: 4000, overlapFeesCents: 500 } };
    expect(forcePlacedCase(covered)).toMatchObject({ status: 'cancellation_refund_due', deadline: '2026-03-07', overdue: true, mayCharge: false });
    expect(forcePlacedCase({ ...covered, asOf: '2026-03-07' })).toMatchObject({ status: 'cancellation_refund_due', overdue: false });
    const done = { ...covered, cancellation: { on: '2026-03-01', evidenceId: 'cancel' }, refund: { on: '2026-03-01', evidenceId: 'refund', cents: 4000 }, feeReversal: { on: '2026-03-01', evidenceId: 'reversal', cents: 500 } };
    expect(forcePlacedCase(done)).toMatchObject({ status: 'cancelled_and_refunded', deadline: '2026-03-07', overdue: false, mayCharge: false });
    expect(forcePlacedCase({ ...done, refund: { ...done.refund, on: '2026-03-08' } })).toMatchObject({ status: 'cancelled_and_refunded', overdue: true });
    expect(() => forcePlacedCase({ ...done, refund: { ...done.refund, cents: 3999 } })).toThrow(/mismatch/);
    expect(() => forcePlacedCase({ ...done, feeReversal: { ...done.feeReversal, cents: 0 } })).toThrow(/mismatch/);
    expect(() => forcePlacedCase({ ...done, cancellation: { on: '2026-02-19', evidenceId: 'cancel' } })).toThrow(/predates/);
    expect(() => forcePlacedCase({ ...input, refund: { on: '2026-03-01', evidenceId: 'refund', cents: 1 } })).toThrow(/coverage evidence required/);
  });
});

describe('R15 loss mitigation and early intervention (12 CFR 1024.39, .41)', () => {
  const scope = { companyId: 'bank', loanId: 'loan', caseId: 'case' };
  type EventBody = Extract<MitigationEvent, { type: MitigationEvent['type'] }> extends infer E ? (E extends MitigationEvent ? Omit<E, 'companyId' | 'loanId' | 'caseId' | 'on' | 'evidenceId'> : never) : never;
  const event = (on: string, body: EventBody): MitigationEvent => ({ ...scope, on, evidenceId: `${on}-${body.type}`, ...body } as MitigationEvent);
  const base: MitigationInput = { ...scope, receivedOn: '2026-01-02', asOf: '2026-03-01', beforeFirstForeclosureNotice: true, profile: 'ordinary', availableOptions: [{ id: 'modify', modification: true }, { id: 'repay', modification: false }], events: [] };
  const pre: MitigationEvent[] = [
    event('2026-01-05', { type: 'acknowledge', missingDocuments: ['income'], reasonableCompletionDate: '2026-01-20' }),
    event('2026-01-12', { type: 'complete', borrowerDocumentsComplete: true }),
    event('2026-01-13', { type: 'complete_notice' }),
  ];
  const decision = event('2026-01-20', { type: 'decide', reviewerId: 'reviewer-a', decisions: [{ optionId: 'modify', offered: false, reason: 'DTI above program ceiling' }, { optionId: 'repay', offered: true, reason: 'eligible' }] });

  it('R15_loss_mitigation_full_path', () => {
    const events = [...pre, decision, event('2026-01-25', { type: 'appeal' }), event('2026-02-01', { type: 'appeal_decision', reviewerId: 'reviewer-b', offeredOptionIds: ['modify'], reason: 'corrected income' }), event('2026-02-05', { type: 'accept', optionId: 'modify' }), event('2026-02-06', { type: 'plan_performing' })];
    const result = lossMitigationCase({ ...base, events });
    expect(result.status).toBe('plan_performing');
    expect(result.foreclosureAction).toBe('blocked_pending_bank_counsel_review');
    expect(result.offeredOptionIds).toEqual(['repay', 'modify']);
    expect(result.completeOn).toBe('2026-01-12');
    expect(result.appealDeadline).toBe('2026-02-03');
    expect(result.responseDeadline).toBe('2026-02-15');
    expect(result.tasks.map((t) => [t.kind, t.dueOn, t.completedOn, t.overdue])).toEqual([
      ['acknowledge', '2026-01-09', '2026-01-05', false],
      ['complete_notice', '2026-01-20', '2026-01-13', false],
      ['decision_notice', '2026-02-11', '2026-01-20', false],
      ['appeal_notice', '2026-02-24', '2026-02-01', false],
    ]);

    // Overdue evidence is retained, not discarded; sale-date boundaries waive tasks without authorizing foreclosure.
    const late = lossMitigationCase({ ...base, events: [] });
    expect(late.tasks[0]).toMatchObject({ kind: 'acknowledge', dueOn: '2026-01-09', overdue: true });
    expect(late.foreclosureAction).toBe('blocked_pending_bank_counsel_review');
    expect(lossMitigationCase({ ...base, saleDateAtReceipt: '2026-02-15', events: [] }).tasks).toHaveLength(0);
    expect(lossMitigationCase({ ...base, saleDateAtCompletion: '2026-02-18', events: pre.slice(0, 2) }).tasks.some((t) => t.kind === 'decision_notice')).toBe(false);
    // Fewer than 90 days before the sale: 7-day acceptance window.
    expect(lossMitigationCase({ ...base, saleDateAtCompletion: '2026-03-15', events: [...pre, decision] }).responseDeadline).toBe('2026-01-27');
    expect(lossMitigationCase({ ...base, profile: 'specialist_review' }).status).toBe('specialist_review');

    // Transition and evidence guardrails.
    expect(() => lossMitigationCase({ ...base, events: [...pre, event('2026-01-20', { type: 'decide', reviewerId: 'a', decisions: [] })] })).toThrow(/every/);
    expect(() => lossMitigationCase({ ...base, events: [event('2026-01-03', { type: 'accept', optionId: 'repay' })] })).toThrow();
    expect(() => lossMitigationCase({ ...base, events: [...pre, decision, event('2026-02-05', { type: 'accept', optionId: 'modify' })] })).toThrow(/acceptance invalid/);
    expect(() => lossMitigationCase({ ...base, events: [{ ...pre[0], companyId: 'other' }] })).toThrow(/scope/);
    expect(() => lossMitigationCase({ ...base, events: [pre[0], pre[0]] })).toThrow(/duplicate/);
    expect(() => lossMitigationCase({ ...base, asOf: '2026-01-03', events: pre })).toThrow(/chronology/);
    expect(() => lossMitigationCase({ ...base, events: [pre[1], pre[0]] })).toThrow(/chronology/);
    expect(() => lossMitigationCase({ ...base, events: [event('2026-01-05', { type: 'acknowledge', missingDocuments: ['income'] })] })).toThrow(/completion date/);
  });

  it('R15_appeal_requires_independent_reviewer', () => {
    expect(() => lossMitigationCase({ ...base, events: [...pre, decision, event('2026-01-25', { type: 'appeal' }), event('2026-02-01', { type: 'appeal_decision', reviewerId: 'reviewer-a', offeredOptionIds: [], reason: 'denied' })] })).toThrow(/independent/);
    expect(() => lossMitigationCase({ ...base, events: [...pre, decision, event('2026-02-04', { type: 'appeal' })] })).toThrow(/late/);
    // Only a denied modification option is appealable.
    const repayOnly = event('2026-01-20', { type: 'decide', reviewerId: 'reviewer-a', decisions: [{ optionId: 'modify', offered: true, reason: 'eligible' }, { optionId: 'repay', offered: false, reason: 'not needed' }] });
    expect(lossMitigationCase({ ...base, events: [...pre, repayOnly] }).appealDeadline).toBeUndefined();
    expect(() => lossMitigationCase({ ...base, events: [...pre, repayOnly, event('2026-01-25', { type: 'appeal' })] })).toThrow(/unavailable/);
    // After the first notice with < 90 days to the sale there is no appeal right.
    expect(lossMitigationCase({ ...base, beforeFirstForeclosureNotice: false, saleDateAtCompletion: '2026-03-15', events: [...pre, decision] }).appealDeadline).toBeUndefined();
    // Independent decision tracked against the 30-day appeal-notice task.
    const pending = lossMitigationCase({ ...base, events: [...pre, decision, event('2026-01-25', { type: 'appeal' })] });
    expect(pending.status).toBe('appeal_pending');
    expect(pending.tasks.find((t) => t.kind === 'appeal_notice')).toMatchObject({ dueOn: '2026-02-24', overdue: true });
    const decided = lossMitigationCase({ ...base, events: [...pre, decision, event('2026-01-25', { type: 'appeal' }), event('2026-02-01', { type: 'appeal_decision', reviewerId: 'reviewer-b', offeredOptionIds: [], reason: 'denial confirmed on the documented rule' })] });
    expect(decided).toMatchObject({ status: 'appeal_decided', offeredOptionIds: ['repay'], responseDeadline: '2026-02-15' });
  });

  it('R15_early_intervention_repeat_contacts', () => {
    const result = earlyIntervention({ missedDueDates: ['2026-01-01', '2026-02-01'], asOf: '2026-03-20', contacts: [{ on: '2026-01-25', evidenceId: 'call' }], writtenNotices: [{ on: '2026-02-14', evidenceId: 'notice' }], profile: 'ordinary' });
    expect(result.status).toBe('tracking');
    expect(result.tasks).toEqual([
      { due: '2026-01-01', contactDue: '2026-02-06', writtenDue: '2026-02-15', contactOverdue: false, writtenOverdue: false },
      { due: '2026-02-01', contactDue: '2026-03-09', writtenDue: '2026-03-18', contactOverdue: true, writtenOverdue: false },
    ]);
    // A contact dated after the second missed payment satisfies both open windows; the written notice within 180 days carries over.
    const repeated = earlyIntervention({ missedDueDates: ['2026-01-01', '2026-02-01'], asOf: '2026-03-20', contacts: [{ on: '2026-02-05', evidenceId: 'call-1' }, { on: '2026-03-05', evidenceId: 'call-2' }], writtenNotices: [{ on: '2026-02-14', evidenceId: 'notice' }], profile: 'ordinary' });
    expect(repeated.tasks.every((t) => !t.contactOverdue && !t.writtenOverdue)).toBe(true);
    const nothing = earlyIntervention({ missedDueDates: ['2026-01-01'], asOf: '2026-03-20', contacts: [], writtenNotices: [], profile: 'ordinary' });
    expect(nothing.tasks[0]).toMatchObject({ contactOverdue: true, writtenOverdue: true });
    expect(earlyIntervention({ missedDueDates: ['2026-01-01'], asOf: '2026-03-20', contacts: [], writtenNotices: [], profile: 'specialist_review' }).status).toBe('specialist_review');
    expect(() => earlyIntervention({ missedDueDates: ['2026-04-01'], asOf: '2026-03-20', contacts: [], writtenNotices: [], profile: 'ordinary' })).toThrow(/future/);
    expect(() => earlyIntervention({ missedDueDates: ['2026-01-01'], asOf: '2026-03-20', contacts: [{ on: '2026-03-21', evidenceId: 'x' }], writtenNotices: [], profile: 'ordinary' })).toThrow(/evidence/);
  });
});
