import { addBusinessDays, addDays, fmtDate, parseDate } from './calendar.js';
import type { Cents, IsoDate } from './types.js';

/**
 * Borrower-facing case clocks. Business days per 12 CFR 1024.31 (a day on which the servicer's offices are
 * open to the public for carrying on substantially all of its business functions); federal calendar used here.
 */

/** Strict ISO `YYYY-MM-DD` validation; rejects malformed strings and impossible dates such as 2026-02-30. */
export function assertIsoDate(iso: string, label = 'date'): IsoDate {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new RangeError(`${label}: ISO date required`);
  const d = parseDate(iso);
  if (Number.isNaN(d.getTime()) || fmtDate(d) !== iso) throw new RangeError(`${label}: invalid calendar date`);
  return iso;
}

/** A dated, identified piece of bank evidence (letter, log entry, document id). Never a fabricated placeholder. */
export interface Evidence { on: IsoDate; evidenceId: string }

/** R12 12 CFR 1024.35 notice of error and 1024.36 information request. */
export type ErrorType = 'payoff' | 'foreclosure_sale' | 'other';
export interface CaseClock { kind: 'notice_of_error' | 'information_request'; received_on: IsoDate; acknowledge_by: IsoDate; respond_by: IsoDate; extended_respond_by?: IsoDate; cite: string }

export function noticeOfErrorCase(received_on: IsoDate, type: ErrorType = 'other'): CaseClock {
  const ack = addBusinessDays(received_on, 5);
  if (type === 'payoff') return { kind: 'notice_of_error', received_on, acknowledge_by: ack, respond_by: addBusinessDays(received_on, 7), cite: '12 CFR 1024.35(d), (e)(3)(i)(A): payoff errors within 7 business days' };
  if (type === 'foreclosure_sale') return { kind: 'notice_of_error', received_on, acknowledge_by: ack, respond_by: addBusinessDays(received_on, 30), cite: '12 CFR 1024.35(e)(3)(i)(B): before the foreclosure sale or within 30 business days, whichever is earlier' };
  return { kind: 'notice_of_error', received_on, acknowledge_by: ack, respond_by: addBusinessDays(received_on, 30), extended_respond_by: addBusinessDays(received_on, 45), cite: '12 CFR 1024.35(d), (e)(3)(i)(C), (e)(3)(ii): 30 business days, extendable once by 15 with written notice' };
}
export function informationRequestCase(received_on: IsoDate, ownerIdentity = false): CaseClock {
  const ack = addBusinessDays(received_on, 5);
  if (ownerIdentity) return { kind: 'information_request', received_on, acknowledge_by: ack, respond_by: addBusinessDays(received_on, 10), cite: '12 CFR 1024.36(d)(2)(i)(A): identity of owner or assignee within 10 business days' };
  return { kind: 'information_request', received_on, acknowledge_by: ack, respond_by: addBusinessDays(received_on, 30), extended_respond_by: addBusinessDays(received_on, 45), cite: '12 CFR 1024.36(c), (d)(2)(i)(B), (d)(2)(ii)' };
}

/* ------------------------------------------------------------------------------------------------------- */
/* R12 evidence-bearing request case                                                                        */
/* ------------------------------------------------------------------------------------------------------- */

export type RequestKind = 'notice_of_error' | 'information_request';
export type RequestCategory = 'general' | 'owner_identity' | 'payoff_error' | 'foreclosure_error';
export type RequestOutcome = 'corrected' | 'no_error' | 'information_provided' | 'unavailable';
export type ExceptionReason = 'duplicate' | 'overbroad' | 'untimely' | 'privileged' | 'irrelevant';
export type RequestStatus = 'received' | 'acknowledged' | 'investigating' | 'responded' | 'specialist_review';

export interface RequestCaseInput {
  kind: RequestKind;
  receivedOn: IsoDate;
  asOf: IsoDate;
  /** `owner_identity` is an information request only (1024.36(d)(2)(i)(A)); `payoff_error`/`foreclosure_error` are notices of error only (1024.35(e)(3)(i)(A)-(B)). */
  category: RequestCategory;
  /** Required for `foreclosure_error`: the response is due before the sale or within 30 business days, whichever is earlier. */
  saleDate?: IsoDate;
  /** Written acknowledgment within 5 business days, 1024.35(d) / 1024.36(c). */
  acknowledgment?: Evidence;
  /** One 15-business-day extension, general category only, noticed before the ordinary deadline with a reason, 1024.35(e)(3)(ii) / 1024.36(d)(2)(ii). */
  extension?: Evidence & { reason: string };
  /** Reasonable investigation, 1024.35(e)(1)(i); the reviewed records are what the response rests on. */
  investigation?: Evidence & { reviewedRecordIds: readonly string[] };
  /** Written response with the outcome and a contact for further assistance, 1024.35(e)(1)(i) / 1024.36(d)(1). */
  response?: Evidence & { outcome: RequestOutcome; explanation: string; assistancePhone: string };
  /** Exception determination, 1024.35(g) / 1024.36(f): notice within 5 business days of the determination. Routed to a reviewer, never auto-closed. */
  exception?: { reason: ExceptionReason; determined: Evidence; notice?: Evidence; reviewerId: string; rationale: string };
}

export interface RequestCaseResult {
  status: RequestStatus;
  ackDeadline: IsoDate;
  responseDeadline: IsoDate;
  ackOverdue: boolean;
  responseOverdue: boolean;
  /** 1024.35(h) / 1024.36(g): no fee for responding to a notice of error or information request. */
  feePermitted: false;
  /** 1024.35(i)(1): no adverse credit reporting for 60 days after receipt of a notice of error. */
  creditReportingHoldUntil?: IsoDate;
  /** Exception path only. */
  exceptionNoticeDeadline?: IsoDate;
  overdue?: boolean;
  automaticClosure?: false;
  cite: string;
}

function checkEvidenceChain(items: Array<[string, Evidence | undefined]>, receivedOn: IsoDate, asOf: IsoDate): void {
  const seen = new Set<string>();
  let last = receivedOn;
  for (const [label, e] of items) {
    if (!e) continue;
    assertIsoDate(e.on, label);
    if (!e.evidenceId || !e.evidenceId.trim()) throw new Error(`${label}: evidenceId required`);
    if (seen.has(e.evidenceId)) throw new Error(`${label}: duplicate evidenceId ${e.evidenceId}`);
    seen.add(e.evidenceId);
    if (e.on < receivedOn || e.on > asOf) throw new Error(`${label}: evidence dated outside [receivedOn, asOf]`);
    if (e.on < last) throw new Error(`${label}: evidence out of chronological order`);
    last = e.on;
  }
}

/**
 * R12 evidence-bearing notice-of-error / information-request lifecycle (12 CFR 1024.35, 1024.36).
 * Every transition is backed by a dated evidence id; deadlines are computed from receipt on the federal
 * business-day calendar. Exceptions (1024.35(g), 1024.36(f)) are referred for specialist review rather than
 * silently closing the case. A notice of error can never be dismissed as privileged/irrelevant (those
 * exceptions exist only in 1024.36(f)(1)).
 */
export function requestCase(input: RequestCaseInput): RequestCaseResult {
  assertIsoDate(input.receivedOn, 'receivedOn'); assertIsoDate(input.asOf, 'asOf');
  if (input.asOf < input.receivedOn) throw new Error('asOf precedes receivedOn');
  if (input.kind === 'notice_of_error' && input.category === 'owner_identity') throw new Error('invalid request category: owner_identity is an information request (1024.36(d)(2)(i)(A))');
  if (input.kind === 'information_request' && (input.category === 'payoff_error' || input.category === 'foreclosure_error')) throw new Error('invalid request category: error categories require a notice of error (1024.35(b))');

  // Evidence must be present, unique, chronological and not after asOf. Extension may come at any point
  // after acknowledgment; the investigation -> response order is mandatory.
  checkEvidenceChain([['acknowledgment', input.acknowledgment], ['investigation', input.investigation], ['response', input.response]], input.receivedOn, input.asOf);
  checkEvidenceChain([['acknowledgment', input.acknowledgment], ['extension', input.extension]], input.receivedOn, input.asOf);
  checkEvidenceChain([['exception.determined', input.exception?.determined], ['exception.notice', input.exception?.notice]], input.receivedOn, input.asOf);
  const ids = [input.acknowledgment, input.extension, input.investigation, input.response, input.exception?.determined, input.exception?.notice].filter((e): e is Evidence => Boolean(e)).map((e) => e.evidenceId);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate evidenceId across request evidence');

  const ackDeadline = addBusinessDays(input.receivedOn, 5);
  const responseDays = input.category === 'owner_identity' ? 10 : input.category === 'payoff_error' ? 7 : 30;
  const ordinaryDeadline = addBusinessDays(input.receivedOn, responseDays);
  let responseDeadline = ordinaryDeadline;
  if (input.category === 'foreclosure_error') {
    if (!input.saleDate) throw new Error('foreclosure_error requires saleDate (1024.35(e)(3)(i)(B))');
    assertIsoDate(input.saleDate, 'saleDate');
    responseDeadline = input.saleDate < ordinaryDeadline ? input.saleDate : ordinaryDeadline;
  }
  if (input.extension) {
    if (input.category !== 'general') throw new Error('extension not permitted: only the 30-business-day clock may be extended (1024.35(e)(3)(ii), 1024.36(d)(2)(ii))');
    if (input.extension.on >= ordinaryDeadline) throw new Error('extension not permitted: notice must precede the ordinary deadline');
    if (!input.extension.reason.trim()) throw new Error('extension not permitted: reason required');
    responseDeadline = addBusinessDays(ordinaryDeadline, 15);
  }

  const cite = input.kind === 'notice_of_error' ? '12 CFR 1024.35(d), (e), (g), (h), (i)' : '12 CFR 1024.36(c), (d), (f), (g)';

  if (input.exception) {
    const x = input.exception;
    if (!x.reviewerId || !x.reviewerId.trim() || !x.rationale.trim()) throw new Error('exception review required: reviewerId and rationale');
    if (input.kind === 'notice_of_error' && (x.reason === 'privileged' || x.reason === 'irrelevant')) throw new Error('exception review required: notice of error cannot be dismissed as privileged/irrelevant (1024.35(g)(1))');
    const exceptionNoticeDeadline = addBusinessDays(x.determined.on, 5);
    return {
      status: 'specialist_review', ackDeadline, responseDeadline,
      ackOverdue: (input.acknowledgment?.on ?? input.asOf) > ackDeadline,
      responseOverdue: false,
      feePermitted: false,
      creditReportingHoldUntil: input.kind === 'notice_of_error' ? addDays(input.receivedOn, 60) : undefined,
      exceptionNoticeDeadline,
      overdue: (x.notice?.on ?? input.asOf) > exceptionNoticeDeadline,
      automaticClosure: false,
      cite: `${cite}; exception notice within 5 business days of determination (${input.kind === 'notice_of_error' ? '1024.35(g)(2)' : '1024.36(f)(2)'})`,
    };
  }

  if (input.response) {
    if (!input.investigation) throw new Error('investigation required before a response (1024.35(e)(1)(i))');
    if (input.response.on < input.investigation.on) throw new Error('investigation must precede the response');
    if (!input.investigation.reviewedRecordIds.length) throw new Error('investigation must cite the reviewed records');
    if (!input.response.explanation.trim() || !input.response.assistancePhone.trim()) throw new Error('written response requires an explanation and assistance contact');
    const allowed: RequestOutcome[] = input.kind === 'notice_of_error' ? ['corrected', 'no_error'] : ['information_provided', 'unavailable'];
    if (!allowed.includes(input.response.outcome)) throw new Error(`wrong response outcome ${input.response.outcome} for ${input.kind}`);
  }
  // 1024.35(d) / 1024.36(c): no acknowledgment needed when the servicer corrects or provides within 5 business days.
  const earlyResponse = Boolean(input.response && input.response.on <= ackDeadline && (input.response.outcome === 'corrected' || input.response.outcome === 'information_provided'));
  const status: RequestStatus = input.response ? 'responded' : input.investigation ? 'investigating' : input.acknowledgment ? 'acknowledged' : 'received';
  return {
    status, ackDeadline, responseDeadline,
    ackOverdue: !earlyResponse && (input.acknowledgment?.on ?? input.asOf) > ackDeadline,
    responseOverdue: (input.response?.on ?? input.asOf) > responseDeadline,
    feePermitted: false,
    creditReportingHoldUntil: input.kind === 'notice_of_error' ? addDays(input.receivedOn, 60) : undefined,
    cite,
  };
}

/* ------------------------------------------------------------------------------------------------------- */
/* R13 force-placed insurance                                                                               */
/* ------------------------------------------------------------------------------------------------------- */

/** R13 12 CFR 1024.37 force-placed insurance. */
export interface ForcePlacedClock { first_notice_on: IsoDate; reminder_earliest: IsoDate; may_charge_on: IsoDate; refund_within_days_of_evidence: 15; cite: string }
export function forcePlacedClock(first_notice_on: IsoDate): ForcePlacedClock {
  return { first_notice_on, reminder_earliest: addDays(first_notice_on, 30), may_charge_on: addDays(first_notice_on, 45), refund_within_days_of_evidence: 15, cite: '12 CFR 1024.37(c)(1): first notice at least 45 days before charging, reminder at least 30 days after the first and 15 before charging; (g) refund within 15 days of evidence of coverage' };
}

export type ForcePlacedBasis = 'coverage_lapsed' | 'cancelled_other_than_nonpayment' | 'vacant';
export type ForcePlacedStatus = 'coverage_review' | 'maintain_existing_policy' | 'first_notice_sent' | 'reminder_sent' | 'charged' | 'cancellation_refund_due' | 'cancelled_and_refunded';

export interface ForcePlacedCaseInput {
  asOf: IsoDate;
  /** Reasonable basis to believe hazard insurance lapsed, 1024.37(b); the basis itself is evidence. */
  basis: ForcePlacedBasis;
  basisEvidenceId: string;
  /** 1024.17(k)(5): an escrowed loan must keep the existing policy in force instead of force-placing. */
  escrowCanMaintainExistingPolicy: boolean;
  firstNotice?: Evidence;
  reminder?: Evidence;
  charge?: Evidence & { cents: Cents };
  /** Evidence that the borrower has hazard insurance, 1024.37(g)(1); overlap amounts are what must come back. */
  coverage?: Evidence & { overlapPremiumCents: Cents; overlapFeesCents: Cents };
  cancellation?: Evidence;
  refund?: Evidence & { cents: Cents };
  feeReversal?: Evidence & { cents: Cents };
}

export interface ForcePlacedCaseResult {
  status: ForcePlacedStatus;
  /** 15 days after evidence of coverage, 1024.37(g)(2). */
  deadline?: IsoDate;
  overdue: boolean;
  /** The engine never authorizes a charge on its own; charges are recorded evidence that the case validates. */
  mayCharge: false;
  cite: string;
}

/**
 * R13 ordinary initial force-placement only; renewals and exemptions require specialist review.
 * 12 CFR 1024.37(c)(1): first written notice at least 45 days before a charge, reminder at least 30 days after
 * the first notice and at least 15 days before a charge. 1024.37(g): within 15 days of evidence of coverage,
 * cancel the force-placed policy and refund every premium and fee for the overlap period.
 * 1024.17(k)(5): when the escrow account can maintain the borrower's policy, force-placement is not allowed.
 */
export function forcePlacedCase(input: ForcePlacedCaseInput): ForcePlacedCaseResult {
  assertIsoDate(input.asOf, 'asOf');
  const bases: ForcePlacedBasis[] = ['coverage_lapsed', 'cancelled_other_than_nonpayment', 'vacant'];
  if (!input.basisEvidenceId || !input.basisEvidenceId.trim() || !bases.includes(input.basis)) throw new Error('documented reasonable basis required (1024.37(b))');
  const cite = '12 CFR 1024.37(b), (c)(1), (g); 1024.17(k)(5)';
  const events: Array<[string, Evidence | undefined]> = [['firstNotice', input.firstNotice], ['reminder', input.reminder], ['charge', input.charge], ['coverage', input.coverage], ['cancellation', input.cancellation], ['refund', input.refund], ['feeReversal', input.feeReversal]];
  const seen = new Set<string>([input.basisEvidenceId]);
  for (const [label, e] of events) {
    if (!e) continue;
    assertIsoDate(e.on, label);
    if (!e.evidenceId || !e.evidenceId.trim()) throw new Error(`${label}: evidenceId required`);
    if (seen.has(e.evidenceId)) throw new Error(`${label}: duplicate evidenceId ${e.evidenceId}`);
    seen.add(e.evidenceId);
    if (e.on > input.asOf) throw new Error(`${label}: evidence dated after asOf`);
  }
  const amount = (label: string, v: Cents) => { if (!Number.isSafeInteger(v) || v < 0) throw new Error(`${label}: integer cents >= 0 required`); };
  if (input.reminder && (!input.firstNotice || input.reminder.on < addDays(input.firstNotice.on, 30))) throw new Error('reminder too early: at least 30 days after the first notice (1024.37(c)(1)(ii))');
  if (input.charge) {
    amount('charge', input.charge.cents);
    if (input.escrowCanMaintainExistingPolicy) throw new Error('force-placed charge blocked: escrow can maintain the existing policy (1024.17(k)(5))');
    if (!input.firstNotice || !input.reminder) throw new Error('force-placed charge blocked: first notice and reminder required (1024.37(c)(1))');
    if (input.charge.on < addDays(input.firstNotice.on, 45)) throw new Error('force-placed charge blocked: fewer than 45 days after the first notice (1024.37(c)(1)(i))');
    if (input.charge.on < addDays(input.reminder.on, 15)) throw new Error('force-placed charge blocked: fewer than 15 days after the reminder (1024.37(c)(1)(ii))');
    if (input.coverage && input.coverage.on <= input.charge.on) throw new Error('force-placed charge blocked: coverage evidence precedes the charge (1024.37(c)(1)(iii))');
  }
  if (!input.coverage && (input.cancellation || input.refund || input.feeReversal)) throw new Error('coverage evidence required for closure (1024.37(g)(1))');
  if (input.coverage) {
    amount('coverage.overlapPremiumCents', input.coverage.overlapPremiumCents); amount('coverage.overlapFeesCents', input.coverage.overlapFeesCents);
    for (const [label, e] of [['cancellation', input.cancellation], ['refund', input.refund], ['feeReversal', input.feeReversal]] as Array<[string, Evidence | undefined]>) {
      if (e && e.on < input.coverage.on) throw new Error(`${label}: closure predates coverage evidence`);
    }
    if (input.refund) { amount('refund', input.refund.cents); if (input.refund.cents !== input.coverage.overlapPremiumCents) throw new Error('overlap premium refund mismatch (1024.37(g)(2))'); }
    if (input.feeReversal) { amount('feeReversal', input.feeReversal.cents); if (input.feeReversal.cents !== input.coverage.overlapFeesCents) throw new Error('overlap fee reversal mismatch (1024.37(g)(2))'); }
    const deadline = addDays(input.coverage.on, 15);
    const premiumDone = input.coverage.overlapPremiumCents === 0 || Boolean(input.refund);
    const feesDone = input.coverage.overlapFeesCents === 0 || Boolean(input.feeReversal);
    const closed = Boolean(input.cancellation) && premiumDone && feesDone;
    const pending: Array<Evidence | undefined> = [input.cancellation, input.coverage.overlapPremiumCents ? input.refund : input.coverage, input.coverage.overlapFeesCents ? input.feeReversal : input.coverage];
    const overdue = pending.some((e) => (e?.on ?? input.asOf) > deadline);
    return { status: closed ? 'cancelled_and_refunded' : 'cancellation_refund_due', deadline, overdue, mayCharge: false, cite };
  }
  const status: ForcePlacedStatus = input.escrowCanMaintainExistingPolicy ? 'maintain_existing_policy' : input.charge ? 'charged' : input.reminder ? 'reminder_sent' : input.firstNotice ? 'first_notice_sent' : 'coverage_review';
  return { status, overdue: false, mayCharge: false, cite };
}

/* ------------------------------------------------------------------------------------------------------- */
/* R15 delinquency clocks (evidence-bearing state machines live in ./loss-mitigation.ts)                    */
/* ------------------------------------------------------------------------------------------------------- */

/** R15 12 CFR 1024.39 early intervention and 1024.41 loss mitigation. */
export type DelinquencyState = 'current' | 'delinquent' | 'early_intervention_live_contact_due' | 'early_intervention_written_notice_due' | 'loss_mitigation_application' | 'loss_mitigation_evaluated' | 'foreclosure_referral_eligible';
export interface DelinquencyCase { state: DelinquencyState; delinquent_since?: IsoDate; live_contact_by?: IsoDate; written_notice_by?: IsoDate; foreclosure_referral_earliest?: IsoDate; cite: string }

export function delinquencyCase(delinquent_since: IsoDate | undefined, as_of: IsoDate): DelinquencyCase {
  if (!delinquent_since) return { state: 'current', cite: '12 CFR 1024.39' };
  const days = Math.round((Date.parse(as_of) - Date.parse(delinquent_since)) / 86_400_000);
  const live = addDays(delinquent_since, 36), written = addDays(delinquent_since, 45), referral = addDays(delinquent_since, 120);
  let state: DelinquencyState = 'delinquent';
  if (days >= 36) state = 'early_intervention_live_contact_due';
  if (days >= 45) state = 'early_intervention_written_notice_due';
  if (days > 120) state = 'foreclosure_referral_eligible';
  return { state, delinquent_since, live_contact_by: live, written_notice_by: written, foreclosure_referral_earliest: referral, cite: '12 CFR 1024.39(a) live contact by day 36, (b) written notice by day 45; 1024.41(f)(1)(i) no first notice or filing until more than 120 days delinquent' };
}

export interface LossMitigationClock { application_received_on: IsoDate; acknowledge_by: IsoDate; evaluate_by: IsoDate; evaluation_required: boolean; appeal_window_days: 14; cite: string }
export function lossMitigationClock(application_received_on: IsoDate, foreclosure_sale_on?: IsoDate): LossMitigationClock {
  const daysBeforeSale = foreclosure_sale_on ? Math.round((Date.parse(foreclosure_sale_on) - Date.parse(application_received_on)) / 86_400_000) : Infinity;
  return { application_received_on, acknowledge_by: addBusinessDays(application_received_on, 5), evaluate_by: addDays(application_received_on, 30), evaluation_required: daysBeforeSale > 37, appeal_window_days: 14, cite: '12 CFR 1024.41(b)(2)(i)(B) acknowledge within 5 business days; (c)(1) evaluate within 30 days when received more than 37 days before a sale; (h) 14-day appeal' };
}

/** Amount to bring the loan current: missed periodic payments plus assessed late charges, integer cents. */
export const amountToCure = (missedPeriodicCents: Cents[], lateChargesCents: Cents[]) => missedPeriodicCents.reduce((a, b) => a + b, 0) + lateChargesCents.reduce((a, b) => a + b, 0);
