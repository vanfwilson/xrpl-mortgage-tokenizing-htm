import { ensureDisbursement, type VerifiedBill } from './disburse.js';
import { parseDay } from './dates.js';
type Purpose='tax'|'hazard'|'mip';
/** Phase E: coupled cash-book simulation; confirmations below are synthetic,
 * never evidence of actual bank settlement. Same-day receipts precede bills. */
export function replayImpoundYear(input:{
  companyId:string;loanId:string;opening:{tax:number;hazard:number;mip:number};
  receipts:readonly {period:string;tax:number;hazard:number;mip:number}[];
  bills:readonly VerifiedBill[];
}) {
  const balances={...input.opening};
  if(!input.companyId||!input.loanId||Object.values(balances).some(v=>!Number.isSafeInteger(v)||v<0))throw new Error('invalid opening scope/balance');
  if(input.receipts.length!==12||new Set(input.receipts.map(p=>p.period)).size!==12)throw new Error('twelve distinct receipt periods required');
  const events:{on:string;purpose:Purpose;kind:'deposit'|'advance'|'disbursement';cents:number;balanceCents:number;reference:string}[]=[];
  const completed=new Set<string>();
  const advances:{billId:string;requestedCents:number;confirmedCents:number;confirmation:'simulated_bank_confirmation'}[]=[];
  const monthly=[];
  const post=(on:string,purpose:Purpose,kind:'deposit'|'advance'|'disbursement',cents:number,reference:string)=>{
    if(!Number.isSafeInteger(cents))throw new Error('invalid cents');
    balances[purpose]+=cents;
    if(!Number.isSafeInteger(balances[purpose])||balances[purpose]<0)throw new Error('unfunded disbursement');
    events.push({on,purpose,kind,cents,balanceCents:balances[purpose],reference});
  };
  let previousMonth:number|undefined;
  for(const receipt of input.receipts){
    const on=`${receipt.period}-01`;parseDay(on);
    const date=new Date(`${on}T00:00:00Z`),month=date.getUTCFullYear()*12+date.getUTCMonth();
    if(previousMonth!==undefined&&month!==previousMonth+1)throw new Error('receipt months must be consecutive');previousMonth=month;
    for(const purpose of ['tax','hazard','mip'] as const){if(receipt[purpose]<0)throw new Error('negative receipt');post(on,purpose,'deposit',receipt[purpose],`receipt-${receipt.period}-${purpose}`);}
    post(on,'mip','disbursement',-receipt.mip,`hud-${receipt.period}`);
    for(const bill of input.bills.filter(b=>b.dueDate.startsWith(receipt.period)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))){
      if(completed.has(bill.id))throw new Error('duplicate bill');
      const due={bill,availableCents:balances[bill.purpose],borrowerDaysOverdue:0,allowlistedPayeeIds:[bill.payeeId],asOf:bill.dueDate};
      let plan=ensureDisbursement(due);
      if(plan.status==='advance_required'){
        const cents=plan.advance.amountCents;
        post(bill.dueDate,bill.purpose,'advance',cents,`advance-${bill.id}`);
        advances.push({billId:bill.id,requestedCents:cents,confirmedCents:cents,confirmation:'simulated_bank_confirmation'});
        plan=ensureDisbursement({...due,availableCents:balances[bill.purpose]});
      }
      if(plan.status!=='ready')throw new Error('bill did not become fully funded');
      post(bill.dueDate,bill.purpose,'disbursement',-plan.escrow.amountCents,bill.id);completed.add(bill.id);
    }
    monthly.push({period:receipt.period,...balances});
  }
  if(completed.size!==input.bills.length)throw new Error('unprocessed bills outside replay year');
  const total=(kind:string)=>events.filter(e=>e.kind===kind).reduce((sum,e)=>sum+e.cents,0);
  const opening=Object.values(input.opening).reduce((a,b)=>a+b,0),closing=Object.values(balances).reduce((a,b)=>a+b,0);
  if(opening+total('deposit')+total('advance')+total('disbursement')!==closing)throw new Error('year balance mismatch');
  return {companyId:input.companyId,loanId:input.loanId,label:'synthetic bank-book simulation',openingCents:opening,closingCents:closing,balances,monthly,events,advances,totalDepositsCents:total('deposit'),totalAdvancesCents:total('advance'),totalDisbursementsCents:-total('disbursement')};
}
