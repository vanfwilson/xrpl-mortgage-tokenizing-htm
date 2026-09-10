import { anchorEvent, verifyEventChain, type AnchoredEvent } from '../servicing/event-log.js';

/** Minimal pg-style connection (node-postgres Pool/Client and PGlite both satisfy it). */
export interface QueryConnection { query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> }

export interface EventStore {
  read(companyId: string, loanId: string): Promise<AnchoredEvent[]>;
  append(companyId: string, loanId: string, payload: unknown): Promise<AnchoredEvent>;
}

interface Row { company_id: string; loan_id: string; sequence: number; previous_hash: string; event_hash: string; payload_json: string }

const TABLE = 'htm_mortgages.servicing_event_log';
const toEvent = (r: Row): AnchoredEvent => ({ companyId: r.company_id, loanId: r.loan_id, sequence: Number(r.sequence), previousHash: r.previous_hash, payloadJson: r.payload_json, eventHash: r.event_hash });

/**
 * R14: business events survive process restarts. Reads verify the full chain before returning it; appends
 * link to the current tail. The database enforces append-only (triggers) and chain continuity (PK + unique).
 */
export class PostgresEventStore implements EventStore {
  constructor(private readonly db: QueryConnection) {}

  async read(companyId: string, loanId: string): Promise<AnchoredEvent[]> {
    const { rows } = await this.db.query<Row>(`select company_id,loan_id,sequence,previous_hash,event_hash,payload_json from ${TABLE} where company_id=$1 and loan_id=$2 order by sequence`, [companyId, loanId]);
    const events = rows.map(toEvent);
    verifyEventChain(events);
    return events;
  }

  async append(companyId: string, loanId: string, payload: unknown): Promise<AnchoredEvent> {
    const { rows } = await this.db.query<Row>(`select company_id,loan_id,sequence,previous_hash,event_hash,payload_json from ${TABLE} where company_id=$1 and loan_id=$2 order by sequence desc limit 1`, [companyId, loanId]);
    const tail = rows[0] ? toEvent(rows[0]) : undefined;
    const next = anchorEvent(companyId, loanId, payload, tail);
    await this.db.query(`insert into ${TABLE}(company_id,loan_id,sequence,previous_hash,event_hash,payload_json) values($1,$2,$3,$4,$5,$6)`, [next.companyId, next.loanId, next.sequence, next.previousHash, next.eventHash, next.payloadJson]);
    return next;
  }
}

/** Same semantics without a database (tests, dry runs). */
export class InMemoryEventStore implements EventStore {
  private readonly chains = new Map<string, AnchoredEvent[]>();
  private key(companyId: string, loanId: string) { return JSON.stringify([companyId, loanId]); }

  async read(companyId: string, loanId: string): Promise<AnchoredEvent[]> {
    const events = [...(this.chains.get(this.key(companyId, loanId)) ?? [])];
    verifyEventChain(events);
    return events;
  }

  async append(companyId: string, loanId: string, payload: unknown): Promise<AnchoredEvent> {
    const k = this.key(companyId, loanId);
    const chain = this.chains.get(k) ?? [];
    const next = anchorEvent(companyId, loanId, payload, chain[chain.length - 1]);
    chain.push(next);
    this.chains.set(k, chain);
    return next;
  }
}
