import { analyzeEscrowYear, resolveAnalysis, type EscrowAnalysisInput, type ResolutionOption } from './analysis.js';
import { initialEscrowStatement, annualEscrowStatement, type DeliveryStatement } from './statements.js';
import { parseDay } from './dates.js';

interface StatementScope { companyId:string; loanId:string; principalInterestCents:number }
interface Forecast { yearStart:string; yearEnd:string; analysisInput:EscrowAnalysisInput; bills:readonly { month:number; dueOn:string; purpose:'tax'|'hazard'|'mip'; amountCents:number; description:string }[] }
function money(value:number,negative=false) { if (!Number.isSafeInteger(value)||(!negative&&value<0)) throw new Error('invalid statement cents'); }
function scope(input:StatementScope) { if (!input.companyId||!input.loanId) throw new Error('statement scope required'); money(input.principalInterestCents); }
function forecast(input:Forecast) {
  parseDay(input.yearStart);parseDay(input.yearEnd);
  const end=new Date(`${input.yearStart}T00:00:00Z`);end.setUTCFullYear(end.getUTCFullYear()+1);end.setUTCDate(end.getUTCDate()-1);
  if(end.toISOString().slice(0,10)!==input.yearEnd)throw new Error('twelve-month computation year required');
  const a=analyzeEscrowYear(input.analysisInput);
  const key=(x:{month:number;purpose:string;amountCents:number})=>`${x.month}:${x.purpose}:${x.amountCents}`;
  const expected=input.analysisInput.disbursements.map(key).sort();
  for(const bill of input.bills){
    parseDay(bill.dueOn);money(bill.amountCents);
    const start=new Date(`${input.yearStart}T00:00:00Z`),due=new Date(`${bill.dueOn}T00:00:00Z`);
    const month=(due.getUTCFullYear()-start.getUTCFullYear())*12+due.getUTCMonth()-start.getUTCMonth()+1;
    if(bill.dueOn<input.yearStart||bill.dueOn>input.yearEnd||month!==bill.month||!bill.description.trim())throw new Error('dated bill inconsistent with forecast');
  }
  if(JSON.stringify(expected)!==JSON.stringify(input.bills.map(key).sort()))throw new Error('forecast bill amounts do not match analysis');
  return {...a,yearStart:input.yearStart,yearEnd:input.yearEnd,estimatedDisbursements:input.bills.map(b=>({...b}))};
}

/** R05: required ordinary initial disclosure data, not just a deadline wrapper.
 * CFPB 1024.17(g),(h), accessed 2026-09-10. */
export function buildInitialEscrowStatement(input:StatementScope & Forecast & {settlementOn:string;generatedOn:string}) {
  scope(input);const projection=forecast(input);
  return initialEscrowStatement(input.settlementOn,input.generatedOn,{
    companyId:input.companyId,loanId:input.loanId,
    monthlyMortgageCents:input.principalInterestCents+projection.newMonthlyDepositCents,
    monthlyEscrowCents:projection.newMonthlyDepositCents,
    initialDepositCents:input.analysisInput.startingBalanceCents,
    selectedCushionCents:projection.cushionCents,
    projection,
    actualOpeningTrial:projection.actualProjection,
  });
}

/** R06: past-year account activity and next-year projection with resolution.
 * Unexplained payment/projection differences refuse a final statement.
 * CFPB 1024.17(i), accessed 2026-09-10. */
export function buildAnnualEscrowStatement(input:StatementScope & {
  generatedOn:string;priorYearStart:string;priorYearEnd:string;
  priorMonthlyEscrowCents:number;priorProjectionEvidenceId:string;
  openingCents:number;closingCents:number;
  activity:readonly {on:string;kind:'deposit'|'tax'|'hazard'|'mip'|'interest'|'refund'|'adjustment';cents:number;reference:string}[];
  next:Forecast;election:ResolutionOption;recoveryMonths?:number;
  differenceExplanation:string;
}) {
  scope(input);parseDay(input.priorYearStart);parseDay(input.priorYearEnd);
  money(input.openingCents,true);money(input.closingCents,true);money(input.priorMonthlyEscrowCents);
  if(!input.priorProjectionEvidenceId||!input.differenceExplanation.trim())throw new Error('prior projection and differences explanation required');
  const dayAfter=new Date(parseDay(input.priorYearEnd)+86400000).toISOString().slice(0,10);
  if(dayAfter!==input.next.yearStart||input.priorYearStart>input.priorYearEnd)throw new Error('noncontiguous statement years');
  let balance=input.openingCents;const refs=new Set<string>();
  const history=[...input.activity].sort((a,b)=>a.on.localeCompare(b.on)).map(entry=>{
    parseDay(entry.on);money(entry.cents,true);
    if(entry.on<input.priorYearStart||entry.on>input.priorYearEnd||!entry.reference||refs.has(entry.reference))throw new Error('invalid history date/reference');
    if(['deposit','interest'].includes(entry.kind)&&entry.cents<0||['tax','hazard','mip','refund'].includes(entry.kind)&&entry.cents>0)throw new Error('activity sign inconsistent');
    refs.add(entry.reference);balance+=entry.cents;money(balance,true);return {...entry,balanceCents:balance};
  });
  if(balance!==input.closingCents||input.next.analysisInput.currentBalanceCents!==balance)throw new Error('statement closing balance mismatch');
  const projection=forecast(input.next);
  const resolution=resolveAnalysis(projection,input.election,input.generatedOn,input.recoveryMonths);
  const total=(kind:string)=>history.filter(e=>e.kind===kind).reduce((sum,e)=>sum+e.cents,0);
  return annualEscrowStatement(input.priorYearEnd,input.generatedOn,{
    companyId:input.companyId,loanId:input.loanId,priorYearStart:input.priorYearStart,priorYearEnd:input.priorYearEnd,
    priorMonthlyMortgageCents:input.principalInterestCents+input.priorMonthlyEscrowCents,priorMonthlyEscrowCents:input.priorMonthlyEscrowCents,
    newBaseMonthlyMortgageCents:input.principalInterestCents+projection.newMonthlyDepositCents,newBaseMonthlyEscrowCents:projection.newMonthlyDepositCents,
    totalDepositsCents:total('deposit'),totalInterestCreditsCents:total('interest'),
    disbursementsCents:{tax:Math.abs(total('tax')),hazard:Math.abs(total('hazard')),mip:Math.abs(total('mip')),refunds:Math.abs(total('refund'))},
    openingCents:input.openingCents,closingCents:balance,history,projection,resolution,
    priorProjectionEvidenceId:input.priorProjectionEvidenceId,differenceExplanation:input.differenceExplanation,
  });
}

/** Submission is distinct from generation: a PDF without delivery is not done. */
export function recordStatementDelivery(statement:DeliveryStatement,input:{on:string;method:'mail'|'electronic';evidenceId:string;electronicConsentEvidenceId?:string}) {
  parseDay(input.on);
  if(input.on<statement.generatedOn||!input.evidenceId||(input.method==='electronic'&&!input.electronicConsentEvidenceId))throw new Error('valid delivery evidence/consent required');
  return {...input,statementType:statement.type,deadline:statement.deadline,late:input.on>statement.deadline};
}
