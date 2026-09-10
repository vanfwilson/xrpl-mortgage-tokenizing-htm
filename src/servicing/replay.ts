import type { CanonicalLoan } from '../ingest/canonical.js';
import { amortizationSchedule } from '../domain/loan-math.js';
import { planMonthlyApplication } from './apply.js';
import { analyzeEscrowYear, californiaInterest, resolveAnalysis } from './analysis.js';
import { anchorEvent, type AnchoredEvent } from './event-log.js';
import { boardInitialDeposit } from './boarding.js';
import { correctedBill, ensureDisbursement, type VerifiedBill } from './disburse.js';
import { servicingTransfer } from './transfer.js';
import { build1098, build1099INT } from './tax.js';
import { replayImpoundYear } from './year-ledger.js';

const monthId = (start: Date, offset: number) =>
  new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1)).toISOString().slice(0, 7);

/** Phase E — deterministic, injected-clock proof for one complete servicing year. */
export function buildFullYearReplay(loan: CanonicalLoan, start: Date) {
  if(start.toISOString().slice(0,10)!==loan.loan.first_payment_date)throw new Error('fixture replay must start on first payment date');
  const schedule = amortizationSchedule(loan.loan.principal_amount, loan.loan.annual_interest_rate, loan.loan.term_months);
  const payments = schedule.slice(0, 12).map((row, index) => {
    const period = monthId(start, index);
    const due = {
      principal: Math.round(row.principal * 100),
      interest: Math.round(row.interest * 100),
      tax: Math.round(loan.servicing.property_tax_impound * 100),
      hazard: Math.round(loan.servicing.hazard_insurance_impound * 100),
      mip: Math.round(loan.servicing.fha_mip_payable * 100),
      fees: 0,
    };
    const receivedCents = Object.values(due).reduce((a, b) => a + b, 0);
    return { period, row, application: planMonthlyApplication({ companyId: 'demo-bank', loanId: loan.loan.loan_id, period, receivedAt: `${period}-01T17:00:00Z`, receivedCents, due }) };
  });

  const disbursements: Array<{ month: number; purpose: 'tax' | 'hazard' | 'mip'; amountCents: number }> = [
    { month: 2, purpose: 'tax', amountCents: 171_000 },
    { month: 8, purpose: 'tax', amountCents: 171_000 },
    { month: 11, purpose: 'hazard', amountCents: 150_000 },
  ];
  for (let month = 1; month <= 12; month++) disbursements.push({ month, purpose: 'mip', amountCents: Math.round(loan.servicing.fha_mip_payable * 100) });
  const analysisBase = {
    startingBalanceCents: 123_050,
    currentMonthlyDepositCents: Math.round((loan.servicing.property_tax_impound + loan.servicing.hazard_insurance_impound + loan.servicing.fha_mip_payable) * 100),
    disbursements,
    borrowerCurrent: true,
  };
  const surplus = analyzeEscrowYear({ ...analysisBase, currentBalanceCents: 300_000 });
  const shortage = analyzeEscrowYear({ ...analysisBase, currentBalanceCents: 1_000 });
  const bill: VerifiedBill = { id: 'tax-2026-1', purpose: 'tax', amountCents: 171_000, dueDate: '2026-12-20', payeeId: 'ada-treasurer', verifiedAt: '2026-12-01T00:00:00Z' };
  const impoundLedger=replayImpoundYear({companyId:'demo-bank',loanId:loan.loan.loan_id,opening:{tax:73830,hazard:49220,mip:0},
    receipts:payments.map(p=>({period:p.period,tax:p.application.entries.tax,hazard:p.application.entries.hazard,mip:p.application.entries.mip})),
    bills:[bill,{...bill,id:'tax-2027-2',dueDate:'2027-06-20',verifiedAt:'2027-06-01T00:00:00Z'},
      {id:'hazard-2027',purpose:'hazard',amountCents:150000,dueDate:'2027-09-01',payeeId:'carrier',verifiedAt:'2027-08-20T00:00:00Z'}]});
  const advance = ensureDisbursement({ bill, availableCents: 130_830, borrowerDaysOverdue: 0, allowlistedPayeeIds: ['ada-treasurer'] });
  const correction = correctedBill(bill, { ...bill, amountCents: 175_000 });
  const caInterestCents = californiaInterest(Array(365).fill(60_000));
  const form1098 = build1098({
    rules: { taxYear: 2027, mipReportable: true, box10Enabled: true }, schedule,
    periodsReceived: [],
    postedInterest: payments.map((p, index) => ({ id: `receipt-${index+1}`, receivedOn: p.application.receivedAt.slice(0,10), interestCents: p.application.entries.interest })),
    january1PrincipalCents: Math.round(schedule[1].balance * 100),
    originationDate: loan.loan.origination_date,
    mipCents: Math.round(loan.servicing.fha_mip_payable * 10 * 100),
    taxPaidCents: 171_000, hazardPaidCents: 150_000,
    address: `${loan.property.address.street}, ${loan.property.address.city}, ${loan.property.address.state} ${loan.property.address.zip}`,
  });
  const events = [
    { type: 'initial_deposit', data: boardInitialDeposit('demo-bank', loan.loan.loan_id, { tax: 73_830, hazard: 49_220 }) },
    { type: 'tax_installments', dates: ['2026-12-20', '2027-06-20'] },
    { type: 'hazard_renewal', date: '2027-09-01' },
    { type: 'monthly_mip', count: 12 },
    { type: 'analysis_surplus', data: surplus }, { type: 'analysis_shortage', data: shortage },
    { type: 'servicer_advance', data: advance }, { type: 'corrected_bill', data: correction },
    { type: 'ca_interest', cents: caInterestCents, form: build1099INT(2026, caInterestCents) },
    { type: 'form_1098', label: '2027 year-to-date through October; finalize after December receipts', data: form1098 },
    { type: 'servicing_transfer', data: servicingTransfer('2027-10-16', '2027-10-01', '2027-10-31') },
  ];
  const resolutions = { surplus: resolveAnalysis(surplus,'refund_30_days','2027-10-31'), shortage: resolveAnalysis(shortage,'collect_12_or_more','2027-10-31',12) };
  const eventChain: AnchoredEvent[]=[];
  for(const event of [...payments,...events,resolutions,impoundLedger])eventChain.push(anchorEvent('demo-bank',loan.loan.loan_id,event,eventChain.at(-1)));
  return { schema: 'htm.servicing-year-proof/2', clock: start.toISOString(), loan: loan.loan.loan_id, payments, events, resolutions, impoundLedger, eventChain };
}
