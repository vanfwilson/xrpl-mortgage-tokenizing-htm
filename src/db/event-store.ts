import { anchorEvent,verifyEventChain,type AnchoredEvent } from '../servicing/event-log.js';
import type { QueryConnection } from './settlement-store.js';
interface Row { company_id:string;loan_id:string;sequence:number;previous_hash:string;event_hash:string;payload_json:string }
const event=(r:Row):AnchoredEvent=>({companyId:r.company_id,loanId:r.loan_id,sequence:r.sequence,previousHash:r.previous_hash,payloadJson:r.payload_json,eventHash:r.event_hash});
/** R14: preserve case/statement/servicing evidence across process restarts.
 * Hashes detect tampering, not authenticity; DB administrators remain trusted. */
export class PostgresEventStore {
  constructor(private readonly db:QueryConnection){}
  async read(companyId:string,loanId:string):Promise<AnchoredEvent[]> {
    const rows=(await this.db.query<Row>('select * from htm_mortgages.servicing_event_log where company_id=$1 and loan_id=$2 order by sequence',[companyId,loanId])).rows.map(event);
    verifyEventChain(rows);return rows;
  }
  async append(companyId:string,loanId:string,payload:unknown):Promise<AnchoredEvent> {
    const tail=(await this.db.query<Row>('select * from htm_mortgages.servicing_event_log where company_id=$1 and loan_id=$2 order by sequence desc limit 1',[companyId,loanId])).rows[0];
    const next=anchorEvent(companyId,loanId,payload,tail?event(tail):undefined);
    await this.db.query('insert into htm_mortgages.servicing_event_log(company_id,loan_id,sequence,previous_hash,event_hash,payload_json) values($1,$2,$3,$4,$5,$6)',[companyId,loanId,next.sequence,next.previousHash,next.eventHash,next.payloadJson]);
    return next;
  }
}
