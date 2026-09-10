import { addDays, parseDay } from './dates.js';
import { createHash } from 'node:crypto';
/** R11 — servicing transfer notices and misdirected-payment grace. */
export function servicingTransfer(transferDate: string, transferorNotice: string, transfereeNotice: string) {
  const days = (a: string, b: string) => (parseDay(b) - parseDay(a)) / 86_400_000;
  if (days(transferorNotice, transferDate) < 15 || days(transferDate, transfereeNotice) > 15) throw new Error('servicing transfer notice window failed');
  return { transferDate, graceEnds: new Date(Date.parse(`${transferDate}T00:00:00Z`) + 60 * 86_400_000).toISOString().slice(0, 10), nftTransferPermitted: true };
}
/** R18 — ownership notice is distinct from an NFToken/servicing transfer. */
export function ownershipTransfer(acquiredOn: string, noticeOn: string, partialInterestOnly: boolean, paymentPartyChanged: boolean) {
  parseDay(acquiredOn); parseDay(noticeOn);
  if (noticeOn < acquiredOn) throw new Error('ownership notice precedes acquisition');
  const required = !partialInterestOnly || paymentPartyChanged;
  if (required && Date.parse(noticeOn) - Date.parse(acquiredOn) > 30 * 86_400_000) throw new Error('ownership notice deadline exceeded');
  return { required, acquiredOn, noticeOn };
}

/** R11/R14: bank-controlled manifest; hashes are references, not delivery proof. */
export function servicingTransferPackage(input: {
  companyId: string; loanId: string; effectiveOn: string;
  transferorId: string; transfereeId: string;
  transferorNotice: { on: string; evidenceId: string };
  transfereeNotice: { on: string; evidenceId: string };
  reconciledCents: { bank: number; servicing: number; settlement: number };
  records: readonly { kind: 'documents' | 'payment_history' | 'escrow_analysis' | 'open_bills' | 'advances' | 'open_cases' | 'tax_history' | 'suspense' | 'pending_settlements'; sha256: string }[];
  acceptedBy: string; acceptedOn: string;
}) {
  if (!input.companyId || !input.loanId || !input.acceptedBy || !input.transferorId || !input.transfereeId || input.transferorId === input.transfereeId || !input.transferorNotice.evidenceId || !input.transfereeNotice.evidenceId) throw new Error('transfer authority/evidence missing');
  parseDay(input.acceptedOn);
  if (input.acceptedOn < input.effectiveOn) throw new Error('cutover acceptance precedes effective date');
  const notices = servicingTransfer(input.effectiveOn,input.transferorNotice.on,input.transfereeNotice.on);
  const values = Object.values(input.reconciledCents);
  if (values.some(v=>!Number.isSafeInteger(v)) || new Set(values).size !== 1) throw new Error('transfer reconciliation failed');
  const required = ['documents','payment_history','escrow_analysis','open_bills','advances','open_cases','tax_history','suspense','pending_settlements'];
  if (input.records.length !== required.length || required.some(k=>input.records.filter(r=>r.kind===k).length!==1) || input.records.some(r=>!/^[a-f0-9]{64}$/.test(r.sha256))) throw new Error('complete hashed transfer records required');
  const payload = { ...input, records:[...input.records].sort((a,b)=>a.kind.localeCompare(b.kind)), graceEnds:notices.graceEnds };
  return { payload, sha256:createHash('sha256').update(JSON.stringify(payload)).digest('hex'), legalOwnershipChanged:false, accessCutoverRequired:true };
}

/** R11: do not penalize an otherwise timely payment to the old servicer. */
export function transferredPayment(input:{ effectiveOn:string; receivedOn:string; receivedBy:'transferor'|'transferee'; otherwiseTimely:boolean }) {
  parseDay(input.effectiveOn); parseDay(input.receivedOn);
  const protectedReceipt=input.receivedBy==='transferor' && input.receivedOn>=input.effectiveOn && input.receivedOn<=addDays(input.effectiveOn,60) && input.otherwiseTimely;
  return { protectedReceipt, suppressTransferLateFee:protectedReceipt, suppressTransferAdverseReporting:protectedReceipt, forwardRequired:input.receivedBy==='transferor'&&input.receivedOn>=input.effectiveOn, creditReceivedOn:input.receivedOn };
}
