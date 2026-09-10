import type { SettlementJob, SettlementStore } from '../xrpl/settlement-journal.js';
/** Compatible with a parameterized PostgreSQL connection, including PGlite tests. */
export interface QueryConnection { query<T>(sql:string,values?:any[]):Promise<{rows:T[]}> }
interface Row { fingerprint:string; status:SettlementJob['status']; signed_blob:string; tx_hash:string; engine_result?:string }
export class PostgresSettlementStore implements SettlementStore {
  constructor(private readonly db:QueryConnection) {}
  private scope(key:string):string[] {
    const scope=JSON.parse(key);
    if(!Array.isArray(scope)||scope.length!==4||scope.some(v=>typeof v!=='string'||!v))throw new Error('invalid settlement scope');
    return scope;
  }
  async get(key:string):Promise<SettlementJob|undefined> {
    const rows=(await this.db.query<Row>('select fingerprint,status,signed_blob,tx_hash,engine_result from htm_mortgages.settlement_jobs where company_id=$1 and loan_id=$2 and run_id=$3 and leg=$4',this.scope(key))).rows;
    if(!rows.length)return undefined;
    const r=rows[0];return {key,fingerprint:r.fingerprint,status:r.status,signedBlob:r.signed_blob,hash:r.tx_hash,result:r.engine_result};
  }
  async insertIfAbsent(job:SettlementJob):Promise<SettlementJob> {
    await this.db.query(`insert into htm_mortgages.settlement_jobs(company_id,loan_id,run_id,leg,fingerprint,status,signed_blob,tx_hash) values($1,$2,$3,$4,$5,'prepared',$6,$7) on conflict do nothing`,[...this.scope(job.key),job.fingerprint,job.signedBlob,job.hash]);
    const winner=await this.get(job.key);if(!winner)throw new Error('persisted settlement job missing');return winner;
  }
  async validated(key:string,result:string):Promise<void> {
    await this.db.query(`update htm_mortgages.settlement_jobs set status=$5,engine_result=$6 where company_id=$1 and loan_id=$2 and run_id=$3 and leg=$4 and status='prepared'`,[...this.scope(key),result==='tesSUCCESS'?'validated':'failed',result]);
  }
}
