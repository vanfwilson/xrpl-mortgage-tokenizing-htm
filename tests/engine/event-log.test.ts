import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InMemoryEventStore, PostgresEventStore } from '../../src/db/event-store.js';
import { anchorEvent, computeEventHash, GENESIS_HASH, verifyEventChain, type AnchoredEvent } from '../../src/servicing/event-log.js';

const db = new PGlite();
const company = 'htm-demo';
const other = 'HTM-d4790bba9e7c';

beforeAll(async () => {
  await db.exec(fs.readFileSync('db/006_servicing_event_log.sql', 'utf8'));
  await db.exec(fs.readFileSync('db/006_servicing_event_log.sql', 'utf8')); // idempotent re-apply
}, 30_000);
afterAll(async () => { await db.close(); });

describe('R14 servicing event log', () => {
  it('R14_migration_applies_with_expected_columns', async () => {
    const { rows } = await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_schema='htm_mortgages' and table_name='servicing_event_log'`);
    expect(rows.map((r) => r.column_name).sort()).toEqual(['company_id', 'created_at', 'event_hash', 'loan_id', 'payload_json', 'previous_hash', 'sequence']);
  });

  it('R14_append_three_events_and_read_verifies_chain', async () => {
    const loan = 'L-chain';
    const a = await new PostgresEventStore(db).append(company, loan, { kind: 'request_received', on: '2026-01-01' });
    const b = await new PostgresEventStore(db).append(company, loan, { kind: 'acknowledged', on: '2026-01-03' });
    const c = await new PostgresEventStore(db).append(company, loan, { kind: 'response_sent', on: '2026-01-05' });
    expect(a.sequence).toBe(1);
    expect(a.previousHash).toBe(GENESIS_HASH);
    expect(b.previousHash).toBe(a.eventHash);
    expect(c.previousHash).toBe(b.eventHash);
    // "Restart": a fresh store over the same database reads and verifies the same chain.
    const read = await new PostgresEventStore(db).read(company, loan);
    expect(read).toEqual([a, b, c]);
    expect(verifyEventChain(read)).toBe(true);
    // Tenant/loan scope: same loan id under another company is an independent, empty chain.
    expect(await new PostgresEventStore(db).read(other, loan)).toEqual([]);
    const o = await new PostgresEventStore(db).append(other, loan, { kind: 'request_received' });
    expect(o.sequence).toBe(1);
    expect(await new PostgresEventStore(db).read(company, loan)).toHaveLength(3);
  });

  it('R14_tamper_detection_on_read_and_verify', async () => {
    const loan = 'L-tamper';
    const store = new PostgresEventStore(db);
    const e1 = await store.append(company, loan, { cents: 100 });
    const e2 = await store.append(company, loan, { cents: 200 });
    const good = [e1, e2];
    expect(verifyEventChain(good)).toBe(true);
    // payload altered but hash kept
    expect(() => verifyEventChain([e1, { ...e2, payloadJson: JSON.stringify({ cents: 201 }) }])).toThrow(/event_hash does not match/);
    // payload altered AND hash recomputed: the next link no longer matches
    const forged1: AnchoredEvent = { ...e1, payloadJson: JSON.stringify({ cents: 999 }) };
    forged1.eventHash = computeEventHash(forged1);
    expect(() => verifyEventChain([forged1, e2])).toThrow(/previous_hash does not link/);
    // reorder / gap / cross-tenant splice
    expect(() => verifyEventChain([e2])).toThrow(/sequence/);
    expect(() => verifyEventChain([e1, { ...e2, companyId: other }])).toThrow(/scope mismatch/);
    // anchorEvent refuses a foreign previous
    expect(() => anchorEvent(other, loan, {}, e1)).toThrow(/scope mismatch/);
    expect(() => anchorEvent('', loan, {})).toThrow(/companyId/);
  });

  it('R14_update_and_delete_rejected_by_trigger', async () => {
    const loan = 'L-immutable';
    const e1 = await new PostgresEventStore(db).append(company, loan, { kind: 'boarded' });
    await expect(db.query('update htm_mortgages.servicing_event_log set payload_json=$1 where company_id=$2 and loan_id=$3', ['{}', company, loan])).rejects.toThrow(/append-only/);
    await expect(db.query('update htm_mortgages.servicing_event_log set event_hash=$1 where event_hash=$2', ['f'.repeat(64), e1.eventHash])).rejects.toThrow(/append-only/);
    await expect(db.query('delete from htm_mortgages.servicing_event_log where company_id=$1 and loan_id=$2', [company, loan])).rejects.toThrow(/append-only/);
    // Stale/gapped insert refused by the chain trigger; duplicate hash refused by the unique constraint.
    await expect(db.query('insert into htm_mortgages.servicing_event_log(company_id,loan_id,sequence,previous_hash,event_hash,payload_json) values($1,$2,3,$3,$4,$5)', [company, loan, e1.eventHash, 'c'.repeat(64), '{}'])).rejects.toThrow(/broken event chain/);
    await expect(db.query('insert into htm_mortgages.servicing_event_log(company_id,loan_id,sequence,previous_hash,event_hash,payload_json) values($1,$2,2,$3,$4,$5)', [company, loan, e1.eventHash, e1.eventHash, '{}'])).rejects.toThrow(/unique|duplicate/);
    expect(await new PostgresEventStore(db).read(company, loan)).toEqual([e1]);
  });

  it('R14_in_memory_store_matches_postgres_semantics', async () => {
    const store = new InMemoryEventStore();
    const a = await store.append(company, 'L-mem', { n: 1 });
    const b = await store.append(company, 'L-mem', { n: 2 });
    expect(b.previousHash).toBe(a.eventHash);
    expect(await store.read(company, 'L-mem')).toEqual([a, b]);
    expect(await store.read(other, 'L-mem')).toEqual([]);
    const pg = await new PostgresEventStore(db).append(company, 'L-mem', { n: 1 });
    expect(pg.eventHash).toBe(a.eventHash); // same inputs, same hash, regardless of store
  });
});
