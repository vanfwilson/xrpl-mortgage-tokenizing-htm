import { describe,it,expect } from 'vitest';
import { buildInitialEscrowStatement,buildAnnualEscrowStatement,recordStatementDelivery } from '../src/servicing/escrow-statements.js';
import { renderStatementPdf } from '../src/servicing/statements.js';
import { ownershipTransfer,servicingTransfer,servicingTransferPackage,transferredPayment } from '../src/servicing/transfer.js';

const scope={companyId:'bank',loanId:'loan',principalInterestCents:277073};
const forecast={yearStart:'2027-01-01',yearEnd:'2027-12-31',analysisInput:{startingBalanceCents:20000,currentBalanceCents:20000,currentMonthlyDepositCents:10000,borrowerCurrent:true,disbursements:[{month:12,purpose:'tax' as const,amountCents:120000}]},bills:[{month:12,dueOn:'2027-12-20',purpose:'tax' as const,amountCents:120000,description:'County property tax'}]};

describe('R05/R06 escrow disclosure contents and delivery',()=>{
  it('includes monthly split, dated estimates, cushion and running balances in initial JSON/PDF',async()=>{
    const s=buildInitialEscrowStatement({...scope,...forecast,settlementOn:'2026-12-20',generatedOn:'2026-12-20'});
    expect(s.payload).toMatchObject({monthlyMortgageCents:287073,monthlyEscrowCents:10000,selectedCushionCents:20000});
    expect(s.payload.actualOpeningTrial).toHaveLength(12);
    expect(Buffer.from(await renderStatementPdf(s)).subarray(0,4).toString()).toBe('%PDF');
    expect(()=>buildInitialEscrowStatement({...scope,...forecast,settlementOn:'2026-12-20',generatedOn:'2026-12-20',bills:[{...forecast.bills[0],dueOn:'2027-11-20'}]})).toThrow(/inconsistent/);
  });
  const annual={...scope,generatedOn:'2027-01-15',priorYearStart:'2026-01-01',priorYearEnd:'2026-12-31',priorMonthlyEscrowCents:10000,priorProjectionEvidenceId:'prior-statement',openingCents:20000,closingCents:20000,activity:[{on:'2026-06-01',kind:'deposit' as const,cents:120000,reference:'deposits'},{on:'2026-12-20',kind:'tax' as const,cents:-120000,reference:'tax'}],next:forecast,election:'do_nothing' as const,differenceExplanation:'No differences from prior projection.'};
  it('reconciles annual actual history with new projection and includes prior statement reference',()=>{
    const s=buildAnnualEscrowStatement(annual);
    expect(s.payload).toMatchObject({totalDepositsCents:120000,closingCents:20000,disbursementsCents:{tax:120000,hazard:0,mip:0,refunds:0},priorProjectionEvidenceId:'prior-statement'});
    expect(()=>buildAnnualEscrowStatement({...annual,closingCents:20001})).toThrow(/mismatch/);
    expect(()=>buildAnnualEscrowStatement({...annual,differenceExplanation:''})).toThrow(/explanation/);
  });
  it('records actual delivery lateness rather than claiming generation satisfies furnishing',()=>{
    const s=buildAnnualEscrowStatement(annual);
    expect(recordStatementDelivery(s,{on:'2027-01-30',method:'mail',evidenceId:'dispatch'}).late).toBe(false);
    expect(recordStatementDelivery(s,{on:'2027-01-31',method:'mail',evidenceId:'dispatch'}).late).toBe(true);
    expect(()=>recordStatementDelivery(s,{on:'2027-01-20',method:'electronic',evidenceId:'email'})).toThrow(/consent/);
  });
});

describe('R11/R18 transfer controls',()=>{
  it('rejects invalid dates and notices dated before acquisition',()=>{
    expect(()=>servicingTransfer('bad','2026-01-01','2026-01-01')).toThrow();
    expect(()=>ownershipTransfer('2026-02-30','2026-03-01',false,false)).toThrow();
    expect(()=>ownershipTransfer('2026-02-01','2026-01-01',false,false)).toThrow(/precedes/);
  });
  it('protects day 60, not day 61, only when otherwise timely',()=>{
    const input={effectiveOn:'2026-01-01',receivedOn:'2026-03-02',receivedBy:'transferor' as const,otherwiseTimely:true};
    expect(transferredPayment(input)).toMatchObject({protectedReceipt:true,suppressTransferLateFee:true,creditReceivedOn:'2026-03-02'});
    expect(transferredPayment({...input,receivedOn:'2026-03-03'}).protectedReceipt).toBe(false);
    expect(transferredPayment({...input,otherwiseTimely:false}).protectedReceipt).toBe(false);
  });
  it('requires complete reconciled records before accepting the transfer manifest',()=>{
    const kinds=['documents','payment_history','escrow_analysis','open_bills','advances','open_cases','tax_history','suspense','pending_settlements'] as const;
    const input={companyId:'bank',loanId:'loan',effectiveOn:'2026-02-01',transferorId:'a',transfereeId:'b',transferorNotice:{on:'2026-01-15',evidenceId:'notice-a'},transfereeNotice:{on:'2026-02-10',evidenceId:'notice-b'},reconciledCents:{bank:100,servicing:100,settlement:100},records:kinds.map(kind=>({kind,sha256:'a'.repeat(64)})),acceptedBy:'bank-reviewer',acceptedOn:'2026-02-10'};
    expect(servicingTransferPackage(input).sha256).toHaveLength(64);
    expect(servicingTransferPackage(input).legalOwnershipChanged).toBe(false);
    expect(()=>servicingTransferPackage({...input,records:input.records.slice(1)})).toThrow(/complete/);
    expect(()=>servicingTransferPackage({...input,reconciledCents:{bank:100,servicing:99,settlement:100}})).toThrow(/reconciliation/);
  });
});
