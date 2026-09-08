import { addBusinessDays, addDays } from './calendar.js';
import type { Cents, IsoDate } from './types.js';

/**
 * Borrower-facing case clocks. Business days per 12 CFR 1024.31 (a day on which the servicer's offices are
 * open to the public for carrying on substantially all of its business functions); federal calendar used here.
 */

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

/** R13 12 CFR 1024.37 force-placed insurance. */
export interface ForcePlacedClock { first_notice_on: IsoDate; reminder_earliest: IsoDate; may_charge_on: IsoDate; refund_within_days_of_evidence: 15; cite: string }
export function forcePlacedClock(first_notice_on: IsoDate): ForcePlacedClock {
  return { first_notice_on, reminder_earliest: addDays(first_notice_on, 30), may_charge_on: addDays(first_notice_on, 45), refund_within_days_of_evidence: 15, cite: '12 CFR 1024.37(c)(1): first notice at least 45 days before charging, reminder at least 30 days after the first and 15 before charging; (g) refund within 15 days of evidence of coverage' };
}

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
