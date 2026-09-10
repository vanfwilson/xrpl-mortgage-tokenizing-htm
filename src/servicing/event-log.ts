import { createHash } from 'node:crypto';
export interface AnchoredEvent { companyId: string; loanId: string; sequence: number; previousHash: string; payloadJson: string; eventHash: string }
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function anchorEvent(companyId:string,loanId:string,payload:unknown,previous?:AnchoredEvent):AnchoredEvent {
  if(!companyId||!loanId||(previous&&(previous.companyId!==companyId||previous.loanId!==loanId)))throw new Error('event chain scope mismatch');
  const event={companyId,loanId,sequence:(previous?.sequence??0)+1,previousHash:previous?.eventHash??'0'.repeat(64),payloadJson:JSON.stringify(payload)};
  return {...event,eventHash:digest(JSON.stringify(event))};
}
export function verifyEventChain(events:readonly AnchoredEvent[]) {
  let previous:AnchoredEvent|undefined;
  for(const event of events) {
    const expected=anchorEvent(event.companyId,event.loanId,JSON.parse(event.payloadJson),previous);
    if(JSON.stringify(expected)!==JSON.stringify(event))throw new Error('event chain altered');
    previous=event;
  }
  return true;
}
