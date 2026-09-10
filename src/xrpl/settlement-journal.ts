import { createHash } from 'node:crypto';
import type { Payment } from 'xrpl';

/**
 * S11 settlement journal: one persisted, signed transaction per (company, loan, run, leg).
 * A memo run id alone cannot prevent a duplicate ledger payment after a timeout or process
 * restart. The signed blob is journaled BEFORE submission and the exact same blob (same
 * hash) is resubmitted or looked up afterwards; nothing is ever re-signed.
 */
export type SettlementStatus = 'prepared' | 'validated' | 'failed';

export interface SettlementScope { companyId: string; loanId: string; run: string; leg: string }

export interface SettlementJob {
  /** Idempotency key: JSON of [companyId, loanId, run, leg]. */
  key: string;
  /** sha256 of the unsigned transaction JSON. */
  fingerprint: string;
  status: SettlementStatus;
  signedBlob: string;
  hash: string;
  /** Engine result once validated (e.g. tesSUCCESS). */
  result?: string;
}

export interface SettlementStore {
  get(key: string): Promise<SettlementJob | undefined>;
  /** Atomic INSERT ... ON CONFLICT DO NOTHING; returns the winning (persisted) row. */
  insertIfAbsent(job: SettlementJob): Promise<SettlementJob>;
  /** Record the validated engine result (tesSUCCESS -> validated, anything else -> failed). */
  validated(key: string, result: string): Promise<void>;
}

export interface SettlementTransport {
  /** Autofill + sign. Called at most once per scope. */
  prepare(tx: Payment): Promise<{ signedBlob: string; hash: string }>;
  /** Look the hash up on the ledger, else submit the exact stored blob. Never re-sign. */
  submitOrFind(blob: string, hash: string): Promise<{ validated: boolean; result: string }>;
}

export const settlementKey = (scope: SettlementScope): string =>
  JSON.stringify([scope.companyId, scope.loanId, scope.run, scope.leg]);

export const settlementFingerprint = (tx: Payment): string =>
  createHash('sha256').update(JSON.stringify(tx)).digest('hex');

export async function settleOnce(scope: SettlementScope, tx: Payment, store: SettlementStore, transport: SettlementTransport): Promise<SettlementJob> {
  if ([scope.companyId, scope.loanId, scope.run, scope.leg].some((v) => typeof v !== 'string' || !v)) throw new Error('full settlement scope required');
  const key = settlementKey(scope);
  const fingerprint = settlementFingerprint(tx);
  let job = await store.get(key);
  if (!job) {
    const prepared = await transport.prepare(tx);
    job = await store.insertIfAbsent({ key, fingerprint, status: 'prepared', ...prepared });
  }
  if (job.fingerprint !== fingerprint) throw new Error('idempotency key reused for a different payment');
  if (job.status === 'validated') return job;
  if (job.status === 'failed') throw new Error(`validated failed transaction (${job.result ?? 'unknown'}) requires an approved replacement attempt`);
  const outcome = await transport.submitOrFind(job.signedBlob, job.hash);
  if (!outcome.validated) throw new Error('settlement uncertain: reconcile hash before replacement');
  await store.validated(key, outcome.result);
  if (outcome.result !== 'tesSUCCESS') throw new Error(`settlement failed: ${outcome.result}`);
  return { ...job, status: 'validated', result: outcome.result };
}
