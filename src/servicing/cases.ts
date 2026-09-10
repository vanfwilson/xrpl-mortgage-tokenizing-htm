import { addBusinessDays, addDays, parseDay } from './dates.js';
export type CaseKind = 'notice_of_error' | 'information_request' | 'force_placed' | 'early_intervention' | 'loss_mitigation';
export interface ServicingCase { kind: CaseKind; openedOn: string; acknowledgedOn?: string; resolvedOn?: string; evidence: readonly string[]; asOf?: string; publicHolidays?: readonly string[]; responseCategory?: 'general' | 'owner_identity' | 'payoff_error' | 'foreclosure_error'; saleDate?: string }
/** R12 — minimal real SLA state: acknowledgment must occur within five days. */
export function openRequestCase(c: ServicingCase) {
  if (!['notice_of_error', 'information_request'].includes(c.kind)) throw new Error('wrong case kind');
  parseDay(c.openedOn);
  const ackDeadline = addBusinessDays(c.openedOn, 5, c.publicHolidays ?? []);
  const responseDays = c.responseCategory === 'owner_identity' ? 10 : c.responseCategory === 'payoff_error' ? 7 : 30;
  let responseDeadline = addBusinessDays(c.openedOn, responseDays, c.publicHolidays ?? []);
  if (c.responseCategory === 'foreclosure_error') {
    if (!c.saleDate) throw new Error('foreclosure error requires sale date and specialist review');
    responseDeadline = [responseDeadline, c.saleDate].sort()[0];
  }
  const asOf = c.asOf ?? c.acknowledgedOn ?? c.openedOn;
  parseDay(asOf);
  if (c.acknowledgedOn) { parseDay(c.acknowledgedOn); if (c.acknowledgedOn < c.openedOn || c.acknowledgedOn > ackDeadline) throw new Error('acknowledgment SLA failed'); }
  if (!c.acknowledgedOn && asOf > ackDeadline) throw new Error('acknowledgment SLA failed');
  if (c.resolvedOn) { parseDay(c.resolvedOn); if (c.resolvedOn < c.openedOn || c.resolvedOn > responseDeadline || !c.evidence.length) throw new Error('response deadline/evidence failed'); }
  if (!c.resolvedOn && asOf > responseDeadline) throw new Error('response deadline exceeded');
  return { ...c, ackDeadline, responseDeadline, status: c.resolvedOn ? 'resolved' : c.acknowledgedOn ? 'investigating' : 'received' } as const;
}

/** Dated notices for the standard force-placed-insurance path. */
export function forcePlacedTimeline(input: { firstNotice: string; reminder: string; chargeOn: string; reasonableBasis: boolean; evidenceReceivedOn?: string; cancelledOn?: string; refundOn?: string }) {
  const first = parseDay(input.firstNotice), second = parseDay(input.reminder), charge = parseDay(input.chargeOn);
  if (!input.reasonableBasis || second - first < 30 * 86400000 || charge - first < 45 * 86400000 || charge - second < 15 * 86400000) throw new Error('force-placed notice timing failed');
  if (input.evidenceReceivedOn) {
    const deadline = addDays(input.evidenceReceivedOn, 15);
    if (!input.cancelledOn || !input.refundOn || input.cancelledOn > deadline || input.refundOn > deadline) throw new Error('cancellation/refund overdue');
  }
  return { status: input.evidenceReceivedOn ? 'cancelled_and_refunded' : 'eligible_for_review' };
}
/** R13 */
export function forcePlacedCase(c: ServicingCase, noticesSent: number, overlappingPremiumRefunded: boolean) {
  if (c.kind !== 'force_placed' || noticesSent < 2 || !overlappingPremiumRefunded) throw new Error('force-placed insurance controls incomplete');
  return { ...c, status: 'eligible' as const };
}
/** R15 */
export function delinquencyCase(daysDelinquent: number, liveContactAttempted: boolean, completeApplicationEvaluated: boolean) {
  if (daysDelinquent >= 36 && !liveContactAttempted) throw new Error('early-intervention contact missing');
  if (daysDelinquent >= 120 && !completeApplicationEvaluated) throw new Error('loss-mitigation evaluation missing');
  return { daysDelinquent, liveContactAttempted, completeApplicationEvaluated };
}
