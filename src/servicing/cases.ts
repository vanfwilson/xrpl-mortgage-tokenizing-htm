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
export { earlyIntervention, lossMitigationCase } from './loss-mitigation.js';

interface Evidence { on: string; evidenceId: string }
/** R13: ordinary initial placement only; renewal/exemption cases require review.
 * CFPB 1024.37(c),(d),(g), 1024.17(k)(5), accessed 2026-09-10. */
export function forcePlacedCase(input: {
  asOf: string; basis: 'coverage_lapsed' | 'cancelled_other_than_nonpayment' | 'vacant';
  basisEvidenceId: string; escrowCanMaintainExistingPolicy: boolean;
  firstNotice?: Evidence; reminder?: Evidence; charge?: Evidence & { cents: number };
  coverage?: Evidence & { overlapPremiumCents: number; overlapFeesCents: number };
  cancellation?: Evidence; refund?: Evidence & { cents: number }; feeReversal?: Evidence & { cents: number };
}) {
  parseDay(input.asOf);
  if (!input.basisEvidenceId || !['coverage_lapsed','cancelled_other_than_nonpayment','vacant'].includes(input.basis)) throw new Error('documented reasonable basis required');
  for (const event of [input.firstNotice, input.reminder, input.charge, input.coverage, input.cancellation, input.refund, input.feeReversal]) {
    if (event) { parseDay(event.on); if (!event.evidenceId || event.on > input.asOf) throw new Error('invalid insurance evidence'); }
  }
  const amount = (v: number) => { if (!Number.isSafeInteger(v) || v < 0) throw new Error('invalid insurance cents'); };
  if (input.reminder && (!input.firstNotice || input.reminder.on < addDays(input.firstNotice.on, 30))) throw new Error('reminder too early');
  if (input.charge) {
    amount(input.charge.cents);
    if (input.escrowCanMaintainExistingPolicy || !input.firstNotice || !input.reminder || input.charge.on < addDays(input.firstNotice.on,45) || input.charge.on < addDays(input.reminder.on,15) || (input.coverage && input.coverage.on <= input.charge.on)) throw new Error('force-placed charge blocked');
  }
  if (!input.coverage && (input.cancellation || input.refund || input.feeReversal)) throw new Error('coverage evidence required for closure');
  if (input.coverage) {
    amount(input.coverage.overlapPremiumCents); amount(input.coverage.overlapFeesCents);
    for (const event of [input.cancellation,input.refund,input.feeReversal]) if (event && event.on < input.coverage.on) throw new Error('closure predates coverage evidence');
    if (input.refund) { amount(input.refund.cents); if (input.refund.cents !== input.coverage.overlapPremiumCents) throw new Error('overlap premium refund mismatch'); }
    if (input.feeReversal) { amount(input.feeReversal.cents); if (input.feeReversal.cents !== input.coverage.overlapFeesCents) throw new Error('overlap fee reversal mismatch'); }
    const deadline = addDays(input.coverage.on, 15);
    const closed = Boolean(input.cancellation && (input.coverage.overlapPremiumCents === 0 || input.refund) && (input.coverage.overlapFeesCents === 0 || input.feeReversal));
    const overdue = [input.cancellation, input.coverage.overlapPremiumCents ? input.refund : input.coverage, input.coverage.overlapFeesCents ? input.feeReversal : input.coverage].some(e => (e?.on ?? input.asOf) > deadline);
    return { status: closed ? 'cancelled_and_refunded' : 'cancellation_refund_due', deadline, overdue, mayCharge: false };
  }
  return { status: input.escrowCanMaintainExistingPolicy ? 'maintain_existing_policy' : input.charge ? 'charged' : input.reminder ? 'reminder_sent' : input.firstNotice ? 'first_notice_sent' : 'coverage_review', mayCharge: false };
}

/** R12: evidence-bearing ordinary NOE/RFI lifecycle. Unsupported exceptions are
 * referred for review rather than silently exempted. Sources: 1024.35/.36. */
export function requestCase(input: {
  kind: 'notice_of_error' | 'information_request'; receivedOn: string; asOf: string;
  category: 'general' | 'owner_identity' | 'payoff_error' | 'foreclosure_error';
  saleDate?: string; publicHolidays: readonly string[]; acknowledgment?: Evidence;
  extension?: Evidence & { reason: string };
  investigation?: Evidence & { reviewedRecordIds: readonly string[] };
  response?: Evidence & { outcome: 'corrected' | 'no_error' | 'information_provided' | 'unavailable'; explanation: string; assistancePhone: string };
  exception?: { reason: 'duplicate' | 'overbroad' | 'untimely' | 'privileged' | 'irrelevant'; determined: Evidence; notice?: Evidence; reviewerId: string; rationale: string };
}) {
  parseDay(input.receivedOn); parseDay(input.asOf);
  if (input.asOf < input.receivedOn || (input.kind === 'notice_of_error' && input.category === 'owner_identity') || (input.kind === 'information_request' && ['payoff_error','foreclosure_error'].includes(input.category))) throw new Error('invalid request category/date');
  const valid = (e?: Evidence) => { if (e) { parseDay(e.on); if (!e.evidenceId || e.on < input.receivedOn || e.on > input.asOf) throw new Error('invalid request evidence'); } };
  [input.acknowledgment,input.extension,input.investigation,input.response,input.exception?.determined,input.exception?.notice].forEach(valid);
  const ackDeadline = addBusinessDays(input.receivedOn, 5, input.publicHolidays);
  const responseDays = input.category === 'owner_identity' ? 10 : input.category === 'payoff_error' ? 7 : 30;
  const ordinaryDeadline = addBusinessDays(input.receivedOn,responseDays,input.publicHolidays);
  let responseDeadline = ordinaryDeadline;
  if (input.category === 'foreclosure_error') { if (!input.saleDate) throw new Error('sale date required'); parseDay(input.saleDate); responseDeadline = [responseDeadline,input.saleDate].sort()[0]; }
  if (input.extension) {
    if (input.category !== 'general' || input.extension.on >= ordinaryDeadline || !input.extension.reason.trim()) throw new Error('extension not permitted');
    responseDeadline = addBusinessDays(ordinaryDeadline,15,input.publicHolidays);
  }
  if (input.exception) {
    const x = input.exception;
    if (!x.reviewerId || !x.rationale.trim() || (input.kind === 'notice_of_error' && ['privileged','irrelevant'].includes(x.reason))) throw new Error('exception review required');
    if (x.notice && x.notice.on < x.determined.on) throw new Error('exception notice precedes determination');
    const deadline = addBusinessDays(x.determined.on,5,input.publicHolidays);
    return { status: 'specialist_review' as const, exceptionNoticeDeadline: deadline, overdue: (x.notice?.on ?? input.asOf) > deadline, feePermitted: false, automaticClosure: false };
  }
  if (input.response) {
    if (!input.investigation || input.response.on < input.investigation.on || !input.investigation.reviewedRecordIds.length || !input.response.explanation.trim() || !input.response.assistancePhone) throw new Error('investigation and written response required');
    const allowed = input.kind === 'notice_of_error' ? ['corrected','no_error'] : ['information_provided','unavailable'];
    if (!allowed.includes(input.response.outcome)) throw new Error('wrong response outcome');
  }
  const earlyResponse = input.response && input.response.on <= ackDeadline && ['corrected','information_provided'].includes(input.response.outcome);
  return { status: input.response ? 'responded' : input.investigation ? 'investigating' : input.acknowledgment ? 'acknowledged' : 'received', ackDeadline, responseDeadline,
    ackOverdue: !earlyResponse && (input.acknowledgment?.on ?? input.asOf) > ackDeadline,
    responseOverdue: (input.response?.on ?? input.asOf) > responseDeadline,
    feePermitted: false, creditReportingHoldUntil: input.kind === 'notice_of_error' ? addDays(input.receivedOn,60) : undefined };
}
