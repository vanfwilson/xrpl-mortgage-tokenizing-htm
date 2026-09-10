import { PDFDocument, StandardFonts } from 'pdf-lib';
import { parseDay } from './dates.js';
import type { CanonicalLoan } from '../ingest/canonical.js';
import type { ScheduleRow } from '../domain/loan-math.js';

export interface DeliveryStatement { type: 'initial_escrow' | 'annual_escrow' | 'periodic'; generatedOn: string; deadline: string; payload: Record<string, unknown> }
const daysBetween = (a: string, b: string) => {
  const days = (parseDay(b) - parseDay(a)) / 86400000;
  if (days < 0) throw new RangeError('statement precedes reporting event');
  return days;
};
/** R05 */
export function initialEscrowStatement(settlement: string, generated: string, payload: Record<string, unknown>): DeliveryStatement {
  if (daysBetween(settlement, generated) > 45) throw new Error('initial escrow statement deadline exceeded');
  return { type: 'initial_escrow', generatedOn: generated, deadline: add(settlement, 45), payload };
}
/** R06 */
export function annualEscrowStatement(yearEnd: string, generated: string, payload: Record<string, unknown>): DeliveryStatement {
  if (daysBetween(yearEnd, generated) > 30) throw new Error('annual escrow statement deadline exceeded');
  return { type: 'annual_escrow', generatedOn: generated, deadline: add(yearEnd, 30), payload };
}
/** R17 */
export function periodicStatement(period: string, payload: Record<string, unknown>): DeliveryStatement { return { type: 'periodic', generatedOn: period, deadline: period, payload }; }

/** Standard current fixed-rate loan disclosure data. Delinquency, bankruptcy,
 * acceleration and other exceptions require their own bank-approved templates. */
export function currentLoanStatement(loan:CanonicalLoan,row:ScheduleRow,input:{generatedOn:string;dueDate:string;postedPayments:readonly {receivedOn:string;principalCents:number;interestCents:number;escrowCents:number;feesCents:number}[];servicerPhone:string;servicerWebsite:string;correspondenceAddress:string}) {
  parseDay(input.generatedOn);parseDay(input.dueDate);
  if(!input.servicerPhone||!input.servicerWebsite||!input.correspondenceAddress)throw new Error('servicer contact details required');
  const summary=(payments:typeof input.postedPayments)=>payments.reduce((a,p)=>({principalCents:a.principalCents+p.principalCents,interestCents:a.interestCents+p.interestCents,escrowCents:a.escrowCents+p.escrowCents,feesCents:a.feesCents+p.feesCents}),{principalCents:0,interestCents:0,escrowCents:0,feesCents:0});
  return periodicStatement(input.generatedOn,{
    profile:'current_fixed_rate',loanNumber:loan.loan.loan_id,borrower:loan.borrower,
    dueDate:input.dueDate,amountDueCents:Math.round(loan.servicing.monthly_total_sweep*100),
    lateFeeAppliesAfter:add(input.dueDate,loan.note_terms.grace_period_days),lateFeeCents:Math.round(loan.note_terms.late_charge_amount*100),
    amountExplanation:{principalCents:Math.round(row.principal*100),interestCents:Math.round(row.interest*100),escrowCents:Math.round((loan.servicing.monthly_total_sweep-loan.servicing.principal_and_interest)*100),feesCents:0,pastDueCents:0},
    pastPaymentBreakdown:{lastPayment:summary(input.postedPayments.slice(-1)),calendarYearToDate:summary(input.postedPayments.filter(p=>p.receivedOn.startsWith(input.generatedOn.slice(0,4))))},
    transactionActivity:input.postedPayments,partialPaymentInformation:{unappliedCents:0,explanation:'Partial payments are held in suspense until sufficient for a periodic payment.'},
    contact:{phone:input.servicerPhone,website:input.servicerWebsite,correspondenceAddress:input.correspondenceAddress},
    accountInformation:{outstandingPrincipalCents:Math.round((row.balance+row.principal)*100),interestRate:loan.loan.annual_interest_rate,nextRateChange:null,prepaymentPenalty:loan.note_terms.prepayment_penalty},
    counseling:{website:'https://www.hud.gov/counseling',phone:'800-569-4287'},
  });
}

/** Render the same statement payload as a deterministic, printable PDF artifact. */
export async function renderStatementPdf(statement: DeliveryStatement): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const lines = [
    'High Tech Mortgage servicing statement',
    `Type: ${statement.type}`,
    `Generated: ${statement.generatedOn}`,
    `Deadline: ${statement.deadline}`,
    ...JSON.stringify(statement.payload, null, 2).split('\n'),
  ];
  // Wrap and paginate the entire payload: silently truncating disclosures is unsafe.
  const wrapped = lines.flatMap(line => line.match(/.{1,88}/g) ?? ['']);
  for (let offset = 0; offset < wrapped.length; offset += 45) {
    const page = document.addPage([612, 792]);
    wrapped.slice(offset, offset + 45).forEach((line, index) => page.drawText(line, { x: 42, y: 750 - index * 15, size: 9, font }));
  }
  return document.save({ useObjectStreams: false });
}
const add = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
