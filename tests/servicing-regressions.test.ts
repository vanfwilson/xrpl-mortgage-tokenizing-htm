import { expect, it } from 'vitest';
import { analyzeEscrowYear, resolveAnalysis } from '../src/servicing/analysis.js';
import { anchorEvent, verifyEventChain } from '../src/servicing/event-log.js';
import { applyWithSuspense, planMonthlyApplication } from '../src/servicing/apply.js';
import { openRequestCase, forcePlacedTimeline } from '../src/servicing/cases.js';
import { build1098 } from '../src/servicing/tax.js';
import { buildSettlementMemo, buildIssuedUsdPayment } from '../src/xrpl/settle.js';
import { settleOnce, type SettlementJob } from '../src/xrpl/settlement-journal.js';
import { amortizationSchedule } from '../src/domain/loan-math.js';
import { currentLoanStatement } from '../src/servicing/statements.js';
import { buildCanonicalFromDocuments } from '../src/ingest/canonical.js';

it('R02_aggregate_target_reproduces_every_hand_calculated_balance', () => {
  const a = analyzeEscrowYear({ startingBalanceCents: 0, currentBalanceCents: 0, currentMonthlyDepositCents: 41000, borrowerCurrent: true,
    disbursements: [{month:2,purpose:'tax',amountCents:171000},{month:8,purpose:'tax',amountCents:171000},{month:11,purpose:'hazard',amountCents:150000}] });
  expect(a.newMonthlyDepositCents).toBe(41000);
  expect(a.cushionCents).toBe(82000);
  expect(a.targetOpeningCents).toBe(171000);
  expect(a.trialBalances.map(r=>r.endingBalanceCents)).toEqual([212000,82000,123000,164000,205000,246000,287000,157000,198000,239000,130000,171000]);
  expect(a.classification).toBe('shortage');
  expect(a.amountCents).toBe(171000);
});

it('R17_current_fixed_rate_statement_includes_amounts_history_contacts_and_account_info',()=>{
  const loan=buildCanonicalFromDocuments('data/documents');
  const statement=currentLoanStatement(loan,amortizationSchedule(450000,.0625,360)[0],{generatedOn:'2026-10-15',dueDate:'2026-11-01',postedPayments:[],servicerPhone:'demo-phone',servicerWebsite:'https://example.com',correspondenceAddress:'synthetic servicing office'});
  expect(statement.payload.amountDueCents).toBe(336501);
  expect(statement.payload.amountExplanation).toEqual({principalCents:42698,interestCents:234375,escrowCents:59428,feesCents:0,pastDueCents:0});
  for(const field of ['lateFeeAppliesAfter','pastPaymentBreakdown','transactionActivity','partialPaymentInformation','contact','accountInformation','counseling'])expect(statement.payload).toHaveProperty(field);
});

it('R03_small_annual_rounding_never_creates_a_negative_deposit',()=>{
  const a=analyzeEscrowYear({startingBalanceCents:0,currentBalanceCents:0,currentMonthlyDepositCents:0,borrowerCurrent:true,disbursements:[{month:12,purpose:'tax',amountCents:1}]});
  expect(a.trialBalances.every(r=>r.depositCents>=0)).toBe(true);
  expect(a.trialBalances.reduce((s,r)=>s+r.depositCents,0)).toBe(1);
});

it('R08_elected_recovery_conserves_cents_and_cannot_change_the_base_deposit',()=>{
  const a=analyzeEscrowYear({startingBalanceCents:0,currentBalanceCents:1,currentMonthlyDepositCents:10000,borrowerCurrent:true,disbursements:[{month:12,purpose:'tax',amountCents:120000}]});
  const recovery=resolveAnalysis(a,'collect_12_or_more','2027-01-01',12);
  expect(recovery.installments?.reduce((s,r)=>s+r.amountCents,0)).toBe(a.amountCents);
  expect(recovery.baseDepositCents).toBe(10000);
  expect(()=>resolveAnalysis(a,'collect_12_or_more','2027-01-01',11)).toThrow();
});

it('R14_event_hash_chain_detects_tampering_and_cross_loan_append',()=>{
  const first=anchorEvent('c','l',{cents:1}),second=anchorEvent('c','l',{cents:2},first);
  expect(verifyEventChain([first,second])).toBe(true);
  expect(()=>verifyEventChain([first,{...second,payloadJson:'{"cents":3}'}])).toThrow();
  expect(()=>anchorEvent('other','l',{},second)).toThrow();
});

it('R16_unpaid_fees_do_not_block_a_full_periodic_payment_and_suspense_accumulates', () => {
  const input = {companyId:'c',loanId:'l',period:'2026-11',receivedAt:'2026-11-01T23:59:00Z',receivedCents:300,due:{principal:100,interest:100,tax:50,hazard:25,mip:25,fees:20}};
  const result = planMonthlyApplication(input);
  expect(result.status).toBe('applied'); expect(result.entries.fees).toBe(0);
  expect(result.receivedAt).toBe(input.receivedAt);
  const partial=applyWithSuspense({...input,receivedCents:150},150);
  expect(partial.plan.status).toBe('applied'); expect(partial.priorSuspenseReleaseCents).toBe(-150);
});

it('T1_actual_amortization_conserves_360_periods_and_retires_principal', () => {
  const schedule=amortizationSchedule(450000,.0625,360);
  let principal=0;
  for(const row of schedule) {
    const due={principal:Math.round(row.principal*100),interest:Math.round(row.interest*100),tax:28500,hazard:12500,mip:18428,fees:0};
    principal+=due.principal;
    const cents=Object.values(due).reduce((a,b)=>a+b,0);
    expect(planMonthlyApplication({companyId:'c',loanId:'l',period:String(row.period),receivedAt:'2026-11-01T00:00:00Z',receivedCents:cents,due}).conservationCents).toBe(cents);
  }
  expect(principal).toBe(45000000); expect(schedule[359].balance).toBe(0);
});

it('R12_business_day_clocks_exclude_weekends_and_supplied_public_holidays', () => {
  const c = openRequestCase({kind:'information_request',openedOn:'2026-01-01',acknowledgedOn:'2026-01-08',evidence:[],publicHolidays:['2026-01-01']});
  expect(c.ackDeadline).toBe('2026-01-08');
  expect(()=>openRequestCase({...c,acknowledgedOn:'2026-01-09'})).toThrow();
  expect(openRequestCase({kind:'notice_of_error',openedOn:'2026-01-01',evidence:[]}).status).toBe('received');
});

it('R13_force_placed_charge_requires_45_day_and_15_day_notice_intervals', () => {
  const timeline={firstNotice:'2026-01-01',reminder:'2026-01-31',chargeOn:'2026-02-15',reasonableBasis:true};
  expect(forcePlacedTimeline(timeline).status).toBe('eligible_for_review');
  expect(()=>forcePlacedTimeline({...timeline,chargeOn:'2026-02-14'})).toThrow();
});

it('T8_tax_boxes_use_received_calendar_year_and_correct_property_box_numbers', () => {
  const input={rules:{taxYear:2027,mipReportable:true,box10Enabled:true},schedule:[],periodsReceived:[],january1PrincipalCents:44900000,originationDate:'2026-09-01',acquisitionDate:'2026-10-01',mipCents:59999,taxPaidCents:171000,hazardPaidCents:150000,address:'synthetic property',postedInterest:[{id:'a',receivedOn:'2026-12-31',interestCents:100},{id:'b',receivedOn:'2027-01-01',interestCents:200}]};
  const form=build1098(input);
  expect(form.box1InterestCents).toBe(200); expect(form.box2PrincipalCents).toBe(44900000);
  expect(form.box7SameAddress).toBe(false); expect(form.box8PropertyAddress).toBe('synthetic property'); expect(form.box9PropertyCount).toBe(1);
  expect(form.box11AcquisitionDate).toBeUndefined(); expect(form.box5MipCents).toBeUndefined();
  expect(()=>build1098({...input,acquisitionDate:'2027-06-01'})).toThrow(/principal required/);
});

it('T11_runtime_extra_fields_cannot_escape_to_memo', () => {
  const m=buildSettlementMemo({v:1,loan:'opaque',period:'2026-11',leg:'pi',cents:1,run:'r',name:'PRIVATE',apn:'PRIVATE'} as any);
  expect(Buffer.from(m.Memo.MemoData!,'hex').toString()).not.toContain('PRIVATE');
});

it('S11_timeout_retry_reuses_the_persisted_blob_and_rejects_key_collision', async () => {
  const jobs = new Map<string,SettlementJob>(); let signed=0, calls=0;
  const store={get:async(k:string)=>jobs.get(k),insertIfAbsent:async(j:SettlementJob)=>{if(!jobs.has(j.key))jobs.set(j.key,j);return jobs.get(j.key)!;},validated:async(k:string,r:string)=>{jobs.get(k)!.status=r==='tesSUCCESS'?'validated':'failed';}};
  const transport={prepare:async()=>{signed++;return {signedBlob:'blob',hash:'hash'};},submitOrFind:async(blob:string)=>{expect(blob).toBe('blob');if(++calls===1)throw new Error('timeout');return {validated:true,result:'tesSUCCESS'};}};
  const scope={companyId:'c',loanId:'l',run:'r',leg:'pi'};
  const tx=buildIssuedUsdPayment('rA','rB','rI',{v:1,loan:'l',period:'2026-11',leg:'pi',cents:100,run:'r'});
  await expect(settleOnce(scope,tx,store,transport)).rejects.toThrow('timeout');
  await settleOnce(scope,tx,store,transport); await settleOnce(scope,tx,store,transport);
  expect(signed).toBe(1); expect(calls).toBe(2);
  await expect(settleOnce(scope,{...tx,Destination:'rOther'},store,transport)).rejects.toThrow(/different payment/);
});
