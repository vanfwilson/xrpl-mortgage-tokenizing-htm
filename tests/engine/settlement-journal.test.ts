import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { Payment } from 'xrpl';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InMemorySettlementStore, PostgresSettlementStore } from '../../src/db/settlement-store.js';
import { settleOnce, type SettlementTransport } from '../../src/xrpl/settlement-journal.js';

const db = new PGlite();

beforeAll(async () => {
  await db.exec('create schema if not exists htm_mortgages;');
  await db.exec(fs.readFileSync('db/005_settlement_journal.sql', 'utf8'));
}, 30_000);
afterAll(async () => { await db.close(); });

const payment = (cents: number): Payment => ({
  TransactionType: 'Payment',
  Account: 'rServicerXXXXXXXXXXXXXXXXXXXXXXXXXX',
  Destination: 'rNoteHolderXXXXXXXXXXXXXXXXXXXXXXX',
  Amount: { currency: 'USD', issuer: 'rIssuerXXXXXXXXXXXXXXXXXXXXXXXXXXXX', value: (cents / 100).toFixed(2) },
});

/** Records every call; deterministic hash so a restart can be checked for hash equality. */
function fakeTransport(outcome: { validated: boolean; result: string } = { validated: true, result: 'tesSUCCESS' }) {
  const calls = { prepare: 0, submitOrFind: 0 };
  const transport: SettlementTransport = {
    async prepare(tx) { calls.prepare++; return { signedBlob: `blob:${JSON.stringify(tx)}`, hash: 'A'.repeat(64) }; },
    async submitOrFind() { calls.submitOrFind++; return outcome; },
  };
  return { transport, calls };
}

describe('S11 settlement journal', () => {
  it('S11_migration_applies', async () => {
    const { rows } = await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_schema='htm_mortgages' and table_name='settlement_jobs'`);
    expect(rows.map((r) => r.column_name).sort()).toEqual(['company_id', 'created_at', 'engine_result', 'fingerprint', 'leg', 'loan_id', 'run_id', 'signed_blob', 'status', 'tx_hash']);
    await db.exec(fs.readFileSync('db/005_settlement_journal.sql', 'utf8')); // idempotent re-apply
  });

  it('S11_journal_restart_idempotent', async () => {
    const scope = { companyId: 'HTM-d4790bba9e7c', loanId: 'L-restart', run: 'run-2026-09', leg: 'pi' };
    const tx = payment(277_073);

    const first = fakeTransport();
    const job1 = await settleOnce(scope, tx, new PostgresSettlementStore(db), first.transport);
    expect(first.calls).toEqual({ prepare: 1, submitOrFind: 1 });
    expect(job1.status).toBe('validated');
    expect(job1.result).toBe('tesSUCCESS');

    // "Restart": a new store instance over the same database, a transport that must never be touched.
    const second = fakeTransport();
    const job2 = await settleOnce(scope, tx, new PostgresSettlementStore(db), second.transport);
    expect(second.calls).toEqual({ prepare: 0, submitOrFind: 0 });
    expect(job2.hash).toBe(job1.hash);
    expect(job2.signedBlob).toBe(job1.signedBlob);
    expect(job2.status).toBe('validated');

    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from htm_mortgages.settlement_jobs where company_id=$1 and loan_id=$2`, [scope.companyId, scope.loanId]);
    expect(rows[0].n).toBe(1);
  });

  it('S11_prepared_blob_resubmitted_not_resigned_after_uncertain_outcome', async () => {
    const scope = { companyId: 'htm-demo', loanId: 'L-timeout', run: 'run-1', leg: 'escrow' };
    const tx = payment(41_000);
    const uncertain = fakeTransport({ validated: false, result: 'unknown' });
    await expect(settleOnce(scope, tx, new PostgresSettlementStore(db), uncertain.transport)).rejects.toThrow('settlement uncertain');
    expect((await new PostgresSettlementStore(db).get(JSON.stringify([scope.companyId, scope.loanId, scope.run, scope.leg])))?.status).toBe('prepared');

    const retry = fakeTransport();
    const job = await settleOnce(scope, tx, new PostgresSettlementStore(db), retry.transport);
    expect(retry.calls).toEqual({ prepare: 0, submitOrFind: 1 }); // same blob, never re-signed
    expect(job.status).toBe('validated');
  });

  it('S11_same_scope_different_tx_throws', async () => {
    const scope = { companyId: 'htm-demo', loanId: 'L-fp', run: 'run-1', leg: 'pi' };
    await settleOnce(scope, payment(100), new PostgresSettlementStore(db), fakeTransport().transport);
    const other = fakeTransport();
    await expect(settleOnce(scope, payment(101), new PostgresSettlementStore(db), other.transport)).rejects.toThrow('idempotency key reused for a different payment');
    expect(other.calls).toEqual({ prepare: 0, submitOrFind: 0 });
  });

  it('S11_uncertain_outcome_throws_settlement_uncertain', async () => {
    const scope = { companyId: 'htm-demo', loanId: 'L-uncertain', run: 'run-1', leg: 'pi' };
    await expect(settleOnce(scope, payment(100), new PostgresSettlementStore(db), fakeTransport({ validated: false, result: 'unknown' }).transport)).rejects.toThrow('settlement uncertain');
  });

  it('S11_failed_engine_result_is_journaled_and_blocks_replay', async () => {
    const scope = { companyId: 'htm-demo', loanId: 'L-failed', run: 'run-1', leg: 'pi' };
    await expect(settleOnce(scope, payment(100), new PostgresSettlementStore(db), fakeTransport({ validated: true, result: 'tecPATH_DRY' }).transport)).rejects.toThrow('settlement failed: tecPATH_DRY');
    const again = fakeTransport();
    await expect(settleOnce(scope, payment(100), new PostgresSettlementStore(db), again.transport)).rejects.toThrow(/requires an approved replacement/);
    expect(again.calls).toEqual({ prepare: 0, submitOrFind: 0 });
  });

  it('S11_tenant_scope_isolates_journal_rows', async () => {
    const tx = payment(100);
    const a = await settleOnce({ companyId: 'htm-demo', loanId: 'L-shared', run: 'run-1', leg: 'pi' }, tx, new PostgresSettlementStore(db), fakeTransport().transport);
    const b = fakeTransport();
    await settleOnce({ companyId: 'HTM-d4790bba9e7c', loanId: 'L-shared', run: 'run-1', leg: 'pi' }, tx, new PostgresSettlementStore(db), b.transport);
    expect(b.calls).toEqual({ prepare: 1, submitOrFind: 1 });
    expect(a.status).toBe('validated');
  });

  it('S11_scope_validation', async () => {
    await expect(settleOnce({ companyId: '', loanId: 'L', run: 'r', leg: 'pi' }, payment(100), new PostgresSettlementStore(db), fakeTransport().transport)).rejects.toThrow('full settlement scope required');
    await expect(new PostgresSettlementStore(db).get('not json')).rejects.toThrow('invalid settlement scope');
  });

  it('S11_in_memory_store_matches_postgres_semantics', async () => {
    const store = new InMemorySettlementStore();
    const scope = { companyId: 'htm-demo', loanId: 'L-mem', run: 'run-1', leg: 'pi' };
    const first = fakeTransport();
    const job1 = await settleOnce(scope, payment(100), store, first.transport);
    const second = fakeTransport();
    const job2 = await settleOnce(scope, payment(100), store, second.transport);
    expect(second.calls).toEqual({ prepare: 0, submitOrFind: 0 });
    expect(job2.hash).toBe(job1.hash);
    await expect(settleOnce(scope, payment(101), store, fakeTransport().transport)).rejects.toThrow('idempotency key reused');
  });
});
