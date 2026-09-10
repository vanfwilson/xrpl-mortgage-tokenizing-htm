import { createHash } from 'node:crypto';
import type { Payment } from 'xrpl';

export interface SettlementJob {
  key: string; fingerprint: string; status: 'prepared' | 'validated' | 'failed';
  signedBlob: string; hash: string; result?: string;
}
export interface SettlementStore {
  get(key: string): Promise<SettlementJob | undefined>;
  /** Atomic INSERT ... ON CONFLICT; return the winning row. */
  insertIfAbsent(job: SettlementJob): Promise<SettlementJob>;
  validated(key: string, result: string): Promise<void>;
}
export interface SettlementTransport {
  prepare(tx: Payment): Promise<{ signedBlob: string; hash: string }>;
  /** Submit the exact same blob or look up its hash after a timeout. Never re-sign. */
  submitOrFind(blob: string, hash: string): Promise<{ validated: boolean; result: string }>;
}
/** An opaque memo run id alone cannot prevent duplicate ledger payments. Persist
 * the signed transaction before submission and reuse it after an ambiguous result. */
export async function settleOnce(scope: { companyId: string; loanId: string; run: string; leg: string }, tx: Payment, store: SettlementStore, transport: SettlementTransport) {
  if (Object.values(scope).some(v => !v)) throw new Error('full settlement scope required');
  const key = JSON.stringify([scope.companyId, scope.loanId, scope.run, scope.leg]);
  const fingerprint = createHash('sha256').update(JSON.stringify(tx)).digest('hex');
  let job = await store.get(key);
  if (!job) {
    const prepared = await transport.prepare(tx);
    job = await store.insertIfAbsent({ key, fingerprint, status: 'prepared', ...prepared });
  }
  if (job.fingerprint !== fingerprint) throw new Error('idempotency key reused for a different payment');
  if (job.status === 'validated') return job;
  if (job.status === 'failed') throw new Error('validated failed transaction requires an approved replacement attempt');
  const result = await transport.submitOrFind(job.signedBlob, job.hash);
  if (!result.validated) throw new Error('settlement uncertain: reconcile hash before replacement');
  await store.validated(key, result.result);
  if (result.result !== 'tesSUCCESS') throw new Error(`settlement failed: ${result.result}`);
  return { ...job, status: 'validated' as const, result: result.result };
}
