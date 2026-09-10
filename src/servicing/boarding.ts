import type { Cents } from './apply.js';
export type SubledgerPurpose = 'tax' | 'hazard' | 'mip' | 'loss_draft';
/** R04/R24 — initial deposit is posted to impounds; loss proceeds are structurally separate. */
export function boardInitialDeposit(companyId: string, loanId: string, allocations: Partial<Record<Exclude<SubledgerPurpose, 'loss_draft'>, Cents>>) {
  if (!companyId || !loanId) throw new Error('tenant and loan scope required');
  for (const [purpose, value] of Object.entries(allocations)) if (!['tax','hazard','mip'].includes(purpose) || !Number.isSafeInteger(value) || value! < 0) throw new Error('invalid initial impound allocation');
  return Object.entries(allocations).map(([purpose, amountCents]) => ({ companyId, loanId, purpose, amountCents, event: 'initial_escrow_deposit' as const }));
}
export interface Authority { jurisdiction: 'CA' | 'ID'; active: boolean; expiresOn?: string }
/** R26 — boarding fails closed when the configured servicing authority is absent/expired. */
export function authorityCheck(a: Authority, on: string) {
  if (!a.active || (a.expiresOn && a.expiresOn < on)) throw new Error(`servicing authority unavailable for ${a.jurisdiction}`);
  return true;
}
