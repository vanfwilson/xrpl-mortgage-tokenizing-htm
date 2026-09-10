import { describe, it, expect } from 'vitest';
import { earlyIntervention, forcePlacedCase, requestCase } from '../src/servicing/cases.js';
import { lossMitigationCase, type MitigationInput, type MitigationEvent } from '../src/servicing/loss-mitigation.js';

const scope = { companyId:'bank', loanId:'loan', caseId:'case' };
const event = (on:string, data: Omit<MitigationEvent, keyof typeof scope | 'on' | 'evidenceId'> & Record<string,unknown>) => ({ ...scope, on, evidenceId:`${on}-${data.type}`, ...data }) as MitigationEvent;
const base: MitigationInput = { ...scope, receivedOn:'2026-01-02', asOf:'2026-03-01', beforeFirstForeclosureNotice:true, profile:'ordinary', publicHolidays:['2026-01-19'], availableOptions:[{id:'modify',modification:true},{id:'repay',modification:false}], events:[] };
const pre: MitigationEvent[] = [event('2026-01-05',{type:'acknowledge',missingDocuments:['income'],reasonableCompletionDate:'2026-01-20'}),event('2026-01-12',{type:'complete',borrowerDocumentsComplete:true}),event('2026-01-13',{type:'complete_notice'})];
const decision = event('2026-01-20',{type:'decide',reviewerId:'reviewer-a',decisions:[{optionId:'modify',offered:false,reason:'documented rule'},{optionId:'repay',offered:true,reason:'eligible'}]});

describe('R15 real loss mitigation transitions',()=>{
  it('tracks application, diligence, completion, all-option evaluation, appeal and performing plan',()=>{
    const events = [...pre,decision,event('2026-01-25',{type:'appeal'}),event('2026-02-01',{type:'appeal_decision',reviewerId:'reviewer-b',offeredOptionIds:['modify'],reason:'corrected income'}),event('2026-02-05',{type:'accept',optionId:'modify'}),event('2026-02-06',{type:'plan_performing'})];
    const result=lossMitigationCase({...base,events});
    expect(result.status).toBe('plan_performing'); expect(result.tasks.every(t=>!t.overdue)).toBe(true);
    expect(result.foreclosureAction).toBe('blocked_pending_bank_counsel_review');
    expect(result.offeredOptionIds).toEqual(['repay','modify']);
    expect(pre).toHaveLength(3);
  });
  it('rejects missing options, empty reasons, same-reviewer appeal and skipping evaluation',()=>{
    expect(()=>lossMitigationCase({...base,events:[...pre,event('2026-01-20',{type:'decide',reviewerId:'a',decisions:[]})]})).toThrow(/every/);
    expect(()=>lossMitigationCase({...base,events:[...pre,decision,event('2026-01-25',{type:'appeal'}),event('2026-02-01',{type:'appeal_decision',reviewerId:'reviewer-a',offeredOptionIds:[],reason:'denied'})]})).toThrow(/independent/);
    expect(()=>lossMitigationCase({...base,events:[event('2026-01-03',{type:'accept',optionId:'repay'})]})).toThrow();
  });
  it('rejects cross-tenant, duplicate and future evidence',()=>{
    expect(()=>lossMitigationCase({...base,events:[{...pre[0],companyId:'other'}]})).toThrow(/scope/);
    expect(()=>lossMitigationCase({...base,events:[pre[0],pre[0]]})).toThrow(/duplicate/);
    expect(()=>lossMitigationCase({...base,asOf:'2026-01-03',events:pre})).toThrow(/chronology/);
  });
  it('retains overdue evidence and applies 45/37-day sale boundaries without authorizing foreclosure',()=>{
    const late = lossMitigationCase({...base,events:[]}); expect(late.tasks[0]).toMatchObject({dueOn:'2026-01-09',overdue:true});
    expect(lossMitigationCase({...base,saleDateAtReceipt:'2026-02-15',events:[]}).tasks).toHaveLength(0);
    const result=lossMitigationCase({...base,saleDateAtCompletion:'2026-02-18',events:pre.slice(0,2)});
    expect(result.tasks.some(t=>t.kind==='decision_notice')).toBe(false);
  });
  it('rejects late appeals and tracks independent 30-day appeal response',()=>{
    expect(()=>lossMitigationCase({...base,events:[...pre,decision,event('2026-02-04',{type:'appeal'})]})).toThrow(/late/);
    const result=lossMitigationCase({...base,events:[...pre,decision,event('2026-01-25',{type:'appeal'})]});
    expect(result.tasks.find(t=>t.kind==='appeal_notice')).toMatchObject({dueOn:'2026-02-24',overdue:true});
  });
  it('repeats monthly contact and retains written day-45 notice without fictional day-120 evaluation',()=>{
    const result=earlyIntervention({missedDueDates:['2026-01-01','2026-02-01'],asOf:'2026-03-20',contacts:[{on:'2026-02-05',evidenceId:'call'}],writtenNotices:[{on:'2026-02-14',evidenceId:'notice'}],profile:'ordinary'});
    expect(result.tasks.every(t=>!t.contactOverdue&&!t.writtenOverdue)).toBe(true);
    expect(lossMitigationCase({...base,profile:'specialist_review'}).status).toBe('specialist_review');
  });
});

describe('R13 coverage and refund workflow',()=>{
  const input={asOf:'2026-03-15',basis:'coverage_lapsed' as const,basisEvidenceId:'carrier',escrowCanMaintainExistingPolicy:false,firstNotice:{on:'2026-01-01',evidenceId:'first'},reminder:{on:'2026-01-31',evidenceId:'second'},charge:{on:'2026-02-15',evidenceId:'charge',cents:5000}};
  it('requires notices, blocks early charge and maintaining-policy bypass',()=>{
    expect(forcePlacedCase(input).status).toBe('charged');
    expect(()=>forcePlacedCase({...input,charge:{...input.charge,on:'2026-02-14'}})).toThrow(/blocked/);
    expect(()=>forcePlacedCase({...input,escrowCanMaintainExistingPolicy:true})).toThrow(/blocked/);
  });
  it('cancels, refunds premium and reverses overlapping fees; detects late and missing execution',()=>{
    const covered={...input,coverage:{on:'2026-02-20',evidenceId:'policy',overlapPremiumCents:4000,overlapFeesCents:500}};
    expect(forcePlacedCase(covered)).toMatchObject({status:'cancellation_refund_due',overdue:true});
    const done={...covered,cancellation:{on:'2026-03-01',evidenceId:'cancel'},refund:{on:'2026-03-01',evidenceId:'refund',cents:4000},feeReversal:{on:'2026-03-01',evidenceId:'reversal',cents:500}};
    expect(forcePlacedCase(done)).toMatchObject({status:'cancelled_and_refunded',overdue:false});
    expect(()=>forcePlacedCase({...done,refund:{...done.refund,cents:3999}})).toThrow(/mismatch/);
  });
});

describe('R12 requests with investigation and response evidence',()=>{
  const input={kind:'notice_of_error' as const,receivedOn:'2026-01-02',asOf:'2026-03-20',category:'general' as const,publicHolidays:['2026-01-19','2026-02-16']};
  it('tracks overdue unanswered requests, extension and reasoned correction',()=>{
    expect(requestCase(input)).toMatchObject({ackOverdue:true,responseOverdue:true,feePermitted:false});
    const response=requestCase({...input,acknowledgment:{on:'2026-01-05',evidenceId:'ack'},extension:{on:'2026-02-01',evidenceId:'extension',reason:'records retrieval'},investigation:{on:'2026-02-02',evidenceId:'review',reviewedRecordIds:['receipt']},response:{on:'2026-02-20',evidenceId:'response',outcome:'corrected',explanation:'reversed duplicate fee',assistancePhone:'555-0100'}});
    expect(response).toMatchObject({status:'responded',ackOverdue:false,responseOverdue:false,creditReportingHoldUntil:'2026-03-03'});
  });
  it('forbids extensions of special clocks and unsupported automatic exception closure',()=>{
    expect(()=>requestCase({...input,category:'payoff_error',extension:{on:'2026-01-03',evidenceId:'ext',reason:'delay'}})).toThrow(/not permitted/);
    expect(requestCase({...input,exception:{reason:'duplicate',determined:{on:'2026-01-03',evidenceId:'determination'},reviewerId:'bank-reviewer',rationale:'prior response identified'}})).toMatchObject({status:'specialist_review',automaticClosure:false,overdue:true});
  });
  it('refuses fabricated resolution without reviewed records',()=>{
    expect(()=>requestCase({...input,response:{on:'2026-01-05',evidenceId:'response',outcome:'no_error',explanation:'none',assistancePhone:'555-0100'}})).toThrow(/investigation/i);
  });
});
