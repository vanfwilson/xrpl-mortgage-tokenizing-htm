import { createHash } from 'node:crypto';
import { addDays } from './calendar.js';
import { assertIsoDate, type Evidence } from './cases.js';
import type { Cents, IsoDate } from './types.js';

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

/* ------------------------------------------------------------------------------------------------------- */
/* R11 evidence-bearing transfer package                                                                    */
/* ------------------------------------------------------------------------------------------------------- */

export const TRANSFER_RECORD_KINDS = ['documents', 'payment_history', 'escrow_analysis', 'open_bills', 'advances', 'open_cases', 'tax_history', 'suspense', 'pending_settlements'] as const;
export type TransferRecordKind = (typeof TRANSFER_RECORD_KINDS)[number];
export interface TransferRecord { kind: TransferRecordKind; sha256: string }

export interface ServicingTransferPackageInput {
  companyId: string;
  loanId: string;
  effectiveOn: IsoDate;
  transferorId: string;
  transfereeId: string;
  /** 1024.33(b)(3)(i): transferor notice not less than 15 days before the effective date. */
  transferorNotice: Evidence;
  /** 1024.33(b)(3)(ii): transferee notice not more than 15 days after the effective date. */
  transfereeNotice: Evidence;
  /** Bank statement, servicing subledger and settlement figures must agree before cutover. */
  reconciledCents: { bank: Cents; servicing: Cents; settlement: Cents };
  /** Exactly one record of each kind, each a 64-hex sha256 of the exported file (1024.38(c)(1) servicing file). */
  records: readonly TransferRecord[];
  acceptedBy: string;
  acceptedOn: IsoDate;
}

export interface ServicingTransferPackage {
  payload: ServicingTransferPackageInput & { records: TransferRecord[]; graceUntil: IsoDate; transferorNoticeDue: IsoDate; transfereeNoticeDue: IsoDate };
  sha256: string;
  /** 1026.39 / R18: a servicing transfer never changes the legal owner of the note. */
  legalOwnershipChanged: false;
  /** Signer lists and tenant access must be cut over by hand; the manifest is not a delivery proof. */
  accessCutoverRequired: true;
  cite: string;
}

/**
 * R11/R14 bank-controlled transfer manifest. 12 CFR 1024.33(b)(3): transferor notice >= 15 days before and
 * transferee notice <= 15 days after the effective date; 1024.38(c)(1): the transferee must receive the
 * complete servicing file. Record hashes are references to exported files, not proof of delivery.
 */
export function servicingTransferPackage(input: ServicingTransferPackageInput): ServicingTransferPackage {
  if (!input.companyId || !input.loanId || !input.acceptedBy || !input.transferorId || !input.transfereeId) throw new Error('transfer authority/evidence missing: tenant, parties and acceptor required');
  if (input.transferorId === input.transfereeId) throw new Error('transfer authority/evidence missing: transferor and transferee must differ');
  if (!input.transferorNotice.evidenceId || !input.transfereeNotice.evidenceId) throw new Error('transfer authority/evidence missing: notice evidence ids required');
  if (input.transferorNotice.evidenceId === input.transfereeNotice.evidenceId) throw new Error('transfer authority/evidence missing: duplicate notice evidenceId');
  assertIsoDate(input.effectiveOn, 'effectiveOn'); assertIsoDate(input.acceptedOn, 'acceptedOn');
  assertIsoDate(input.transferorNotice.on, 'transferorNotice.on'); assertIsoDate(input.transfereeNotice.on, 'transfereeNotice.on');
  if (input.acceptedOn < input.effectiveOn) throw new Error('cutover acceptance precedes effective date');
  const clock = servicingTransferCase(input.effectiveOn);
  if (input.transferorNotice.on > clock.transferor_notice_due) throw new Error('servicing transfer notice window failed: transferor notice must be >= 15 days before the effective date (1024.33(b)(3)(i))');
  if (input.transfereeNotice.on > clock.transferee_notice_due) throw new Error('servicing transfer notice window failed: transferee notice must be <= 15 days after the effective date (1024.33(b)(3)(ii))');
  const values = Object.values(input.reconciledCents);
  if (values.some((v) => !Number.isSafeInteger(v)) || new Set(values).size !== 1) throw new Error('transfer reconciliation failed: bank, servicing and settlement cents must be equal integers');
  const kinds: readonly string[] = TRANSFER_RECORD_KINDS;
  if (input.records.length !== kinds.length || kinds.some((k) => input.records.filter((r) => r.kind === k).length !== 1)) throw new Error('complete hashed transfer records required: exactly one of each of the nine kinds');
  if (input.records.some((r) => !/^[a-f0-9]{64}$/.test(r.sha256))) throw new Error('complete hashed transfer records required: sha256 must be 64 lowercase hex');
  const records = [...input.records].map((r) => ({ kind: r.kind, sha256: r.sha256 })).sort((a, b) => a.kind.localeCompare(b.kind));
  const payload = { ...input, records, graceUntil: clock.grace_until, transferorNoticeDue: clock.transferor_notice_due, transfereeNoticeDue: clock.transferee_notice_due };
  return { payload, sha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex'), legalOwnershipChanged: false, accessCutoverRequired: true, cite: '12 CFR 1024.33(b)(3), 1024.38(c)(1); 1026.39 unaffected' };
}

export interface TransferredPaymentInput {
  effectiveOn: IsoDate;
  receivedOn: IsoDate;
  receivedBy: 'transferor' | 'transferee';
  /** True when the payment would have been on time had it been sent to the right servicer. */
  otherwiseTimely: boolean;
}

/**
 * R11 12 CFR 1024.33(c)(1): a payment received by the transferor (rather than the transferee) on or before
 * the 60th day after the effective date, that is otherwise timely, may not be treated as late for any purpose
 * (no late fee, no adverse reporting). 1024.33(c)(2): the transferor must forward it or notify the borrower.
 */
export function transferredPayment(input: TransferredPaymentInput): { protectedReceipt: boolean; suppressTransferLateFee: boolean; suppressTransferAdverseReporting: boolean; forwardRequired: boolean; creditReceivedOn: IsoDate; cite: string } {
  assertIsoDate(input.effectiveOn, 'effectiveOn'); assertIsoDate(input.receivedOn, 'receivedOn');
  const graceUntil = addDays(input.effectiveOn, 60);
  const protectedReceipt = input.receivedBy === 'transferor' && input.receivedOn >= input.effectiveOn && input.receivedOn <= graceUntil && input.otherwiseTimely;
  return {
    protectedReceipt,
    suppressTransferLateFee: protectedReceipt,
    suppressTransferAdverseReporting: protectedReceipt,
    forwardRequired: input.receivedBy === 'transferor' && input.receivedOn >= input.effectiveOn,
    creditReceivedOn: input.receivedOn,
    cite: '12 CFR 1024.33(c)(1), (c)(2)',
  };
}
