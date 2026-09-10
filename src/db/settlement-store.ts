import type { SettlementJob, SettlementStore } from '../xrpl/settlement-journal.js';

/** Any parameterized PostgreSQL connection: node-postgres Pool/Client, PGlite, etc. */
export interface QueryConnection { query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> }

interface Row { fingerprint: string; status: SettlementJob['status']; signed_blob: string; tx_hash: string; engine_result: string | null }

const TABLE = 'htm_mortgages.settlement_jobs';
const WHERE = 'company_id=$1 and loan_id=$2 and run_id=$3 and leg=$4';

function scopeOf(key: string): string[] {
  let scope: unknown;
  try { scope = JSON.parse(key); } catch { throw new Error('invalid settlement scope'); }
  if (!Array.isArray(scope) || scope.length !== 4 || scope.some((v) => typeof v !== 'string' || !v)) throw new Error('invalid settlement scope');
  return scope as string[];
}

export class PostgresSettlementStore implements SettlementStore {
  constructor(private readonly db: QueryConnection) {}

  async get(key: string): Promise<SettlementJob | undefined> {
    const { rows } = await this.db.query<Row>(`select fingerprint,status,signed_blob,tx_hash,engine_result from ${TABLE} where ${WHERE}`, scopeOf(key));
    const r = rows[0];
    if (!r) return undefined;
    return { key, fingerprint: r.fingerprint, status: r.status, signedBlob: r.signed_blob, hash: r.tx_hash, ...(r.engine_result ? { result: r.engine_result } : {}) };
  }

  async insertIfAbsent(job: SettlementJob): Promise<SettlementJob> {
    await this.db.query(
      `insert into ${TABLE}(company_id,loan_id,run_id,leg,fingerprint,status,signed_blob,tx_hash) values($1,$2,$3,$4,$5,'prepared',$6,$7) on conflict do nothing`,
      [...scopeOf(job.key), job.fingerprint, job.signedBlob, job.hash],
    );
    const winner = await this.get(job.key);
    if (!winner) throw new Error('persisted settlement job missing');
    return winner;
  }

  async validated(key: string, result: string): Promise<void> {
    await this.db.query(`update ${TABLE} set status=$5,engine_result=$6 where ${WHERE} and status='prepared'`, [...scopeOf(key), result === 'tesSUCCESS' ? 'validated' : 'failed', result]);
  }
}

/** Process-local journal for --no-ledger / replay runs. Same semantics, no durability. */
export class InMemorySettlementStore implements SettlementStore {
  private readonly jobs = new Map<string, SettlementJob>();

  async get(key: string): Promise<SettlementJob | undefined> {
    const job = this.jobs.get(key);
    return job ? { ...job } : undefined;
  }

  async insertIfAbsent(job: SettlementJob): Promise<SettlementJob> {
    scopeOf(job.key);
    if (!this.jobs.has(job.key)) this.jobs.set(job.key, { ...job, status: 'prepared' });
    return { ...this.jobs.get(job.key)! };
  }

  async validated(key: string, result: string): Promise<void> {
    const job = this.jobs.get(key);
    if (!job || job.status !== 'prepared') return;
    this.jobs.set(key, { ...job, status: result === 'tesSUCCESS' ? 'validated' : 'failed', result });
  }
}
