import { addDays } from './calendar.js';
import type { IsoDate } from './types.js';

/**
 * R11 12 CFR 1024.33: servicing transfer notices and the 60-day misdirected-payment grace.
 * R18 12 CFR 1026.39: notice of a new owner within 30 days, with the narrow partial-interest exception.
 * A loan-record NFToken transfer is an operational event; neither of these clocks starts from it.
 */
export interface ServicingTransferCase {
  transfer_date: IsoDate;
  transferor_notice_due: IsoDate;   // not less than 15 days before the effective date, 1024.33(b)(3)(i)
  transferee_notice_due: IsoDate;   // not more than 15 days after the effective date, 1024.33(b)(3)(ii)
  combined_notice_allowed: boolean; // 1024.33(b)(3)(iii)
  grace_until: IsoDate;             // 60 days, 1024.33(c)(1)
  steps: string[];
  cite: string;
}
export function servicingTransferCase(transfer_date: IsoDate): ServicingTransferCase {
  return {
    transfer_date,
    transferor_notice_due: addDays(transfer_date, -15),
    transferee_notice_due: addDays(transfer_date, 15),
    combined_notice_allowed: true,
    grace_until: addDays(transfer_date, 60),
    steps: ['freeze discretionary work', 'reconcile cash and open items', 'export complete servicing file (1024.38(c))', 'send transferor and transferee notices', 'cut over signer lists and tenant access', 'transfer loan-record NFToken by zero-price offer', 'route misdirected payments for 60 days'],
    cite: '12 CFR 1024.33(b), (c)',
  };
}

/** 1024.33(c)(1): a payment sent to the old servicer within 60 days of transfer may not be treated as late. */
export function misdirectedPayment(t: ServicingTransferCase, received_by_transferor_on: IsoDate): { treated_as_timely: boolean; cite: string } {
  return { treated_as_timely: received_by_transferor_on >= t.transfer_date && received_by_transferor_on <= t.grace_until, cite: '12 CFR 1024.33(c)(1)' };
}

export interface OwnershipTransfer {
  acquired_on: IsoDate;
  partial_interest: boolean;
  /** The party authorized to receive notice of the right to rescind and resolve payment issues changed. */
  notice_party_changed: boolean;
}
export function ownershipTransferNotice(o: OwnershipTransfer): { notice_required: boolean; due_by?: IsoDate; exception?: string; cite: string } {
  if (o.partial_interest && !o.notice_party_changed) return { notice_required: false, exception: '12 CFR 1026.39(c)(3): partial interest acquired and the notice/payment party did not change', cite: '12 CFR 1026.39' };
  return { notice_required: true, due_by: addDays(o.acquired_on, 30), cite: '12 CFR 1026.39(b): on or before the 30th calendar day following acquisition' };
}
