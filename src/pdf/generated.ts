import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import type { CanonicalLoan } from '../ingest/canonical.js';
import { Writer, mdy, pens, stampPages, usd, usdPlain } from './common.js';

async function start() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const { font, bold } = await pens(doc);
  return { doc, w: new Writer(page, font, bold), font };
}

export async function fhaAmendatoryClause(loan: CanonicalLoan, d: Record<string, any>, out: string, anchor: string) {
  const { doc, w, font } = await start();
  w.h('FHA AMENDATORY CLAUSE', 14);
  w.kv('FHA Case No.', d.fha_case_number); w.kv('Property', d.property); w.kv('Contract Sales Price', usd(d.contract_sales_price)); w.gap();
  w.p(`It is expressly agreed that, notwithstanding any other provisions of this contract, the purchaser shall not be obligated to complete the purchase of the property described herein or to incur any penalty by forfeiture of earnest money deposits or otherwise unless the purchaser has been given, in accordance with HUD/FHA or VA requirements, a written statement issued by the Federal Housing Commissioner, Department of Veterans Affairs, or a Direct Endorsement lender, setting forth the appraised value of the property of not less than ${usd(d.contract_sales_price)}.`);
  w.p('The purchaser shall have the privilege and option of proceeding with consummation of the contract without regard to the amount of the appraised valuation. The appraised valuation is arrived at to determine the maximum mortgage the Department of Housing and Urban Development will insure. HUD does not warrant the value nor the condition of the property. The purchaser should satisfy himself/herself that the price and condition of the property are acceptable.');
  w.gap(); w.h('REAL ESTATE CERTIFICATION', 12);
  w.p('We, the borrower, seller, and the selling real estate agent or broker involved in the sales transaction certify that the terms and conditions of the sales contract are true to the best of our knowledge and belief, and that any other agreement entered into by any of these parties in connection with this transaction is part of, or attached to, the sales agreement.');
  w.sig(`Buyer: ${d.parties.buyer}    Date ${mdy(d.signed)}`); w.sig(`Seller: ${d.parties.seller}    Date ${mdy(d.signed)}`);
  w.sig(`Buyer's Agent: ${d.parties.buyer_agent}`); w.sig(`Seller's Agent: ${d.parties.seller_agent}`);
  stampPages(doc, font, anchor); fs.writeFileSync(out, await doc.save()); return 1;
}

export async function deedOfTrust(loan: CanonicalLoan, d: Record<string, any>, out: string, anchor: string) {
  const { doc, w, font } = await start();
  w.p('After recording return to: ' + d.beneficiary_lender, 8); w.p('Recording requested by: ' + d.trustee, 8); w.rule();
  w.p(`${String(d.recording.office).toUpperCase()}     Instrument No. ${d.recording.document_number}     Recorded ${mdy(d.recording.recorded_date)}     Fee ${usd(d.recording.recording_fee)}`, 8); w.rule();
  w.h(`DEED OF TRUST  (FHA Case No. ${loan.loan.fha_case_number})`, 14);
  w.p('IDAHO - Single Family - Fannie Mae/Freddie Mac UNIFORM INSTRUMENT Form 3013 (synthetic rendering of the standard form text blocks)', 7.5);
  w.p(`THIS DEED OF TRUST ("Security Instrument") is made on ${mdy(d.note_date)}. The grantor is ${d.grantor_borrower} ("Borrower"). The trustee is ${d.trustee} ("Trustee"). The beneficiary is ${d.beneficiary_lender} ("Lender").`);
  w.p(`Borrower owes Lender the principal sum of ${usd(d.secured_note_amount)}. This debt is evidenced by Borrower's Note dated the same date as this Security Instrument, which provides for monthly payments, with the full debt, if not paid earlier, due and payable on ${mdy(d.maturity_date)}. The Note bears interest at ${(loan.loan.annual_interest_rate * 100).toFixed(3)}% per annum.`);
  w.p(`For this purpose, Borrower irrevocably grants and conveys to Trustee, in trust, with power of sale, the following described property located in ${loan.property.address.county} County, Idaho:`);
  w.p(d.legal_description); w.kv('Commonly known as', d.property_address); w.kv('Assessor Parcel No. (APN)', d.apn); w.kv('Lien position', `First (${d.lien_position})`);
  w.p("TOGETHER WITH all the improvements now or hereafter erected on the property, and all easements, appurtenances, and fixtures now or hereafter a part of the property. This Security Instrument secures to Lender the repayment of the debt evidenced by the Note, with interest, and all renewals, extensions and modifications; the payment of all other sums, with interest, advanced under paragraph 7; and the performance of Borrower's covenants and agreements.");
  w.h('TRANSFER OF RIGHTS IN THE PROPERTY', 10);
  w.p(d.transfer_of_rights_in_the_property);
  w.p('UNIFORM COVENANTS. 1. Payment of Principal, Interest and Late Charge. 2. Monthly Payment of Taxes, Insurance and Other Charges. 3. Application of Payments. 4. Fire, Flood and Other Hazard Insurance. 5. Occupancy, Preservation, Maintenance and Protection of the Property. 6. Condemnation. 7. Charges to Borrower and Protection of Lender\'s Rights in the Property. 8. Fees. 9. Grounds for Acceleration of Debt. (Standard FHA Idaho Deed of Trust covenants incorporated by reference for this synthetic test instrument.)');
  w.sig(`Borrower: ${d.grantor_borrower}`); w.gap(10);
  w.p(`STATE OF IDAHO, County of ${loan.property.address.county}. On ${mdy(d.note_date)} before me, a Notary Public, personally appeared ${d.grantor_borrower}, known or identified to me to be the person whose name is subscribed to the within instrument, and acknowledged that they executed the same.`, 8.5);
  w.sig('Notary Public for Idaho (demo)');
  stampPages(doc, font, anchor); fs.writeFileSync(out, await doc.save()); return 1;
}

export async function warrantyDeed(loan: CanonicalLoan, d: Record<string, any>, out: string, anchor: string) {
  const { doc, w, font } = await start();
  w.p('RECORDING REQUESTED BY: ' + d.recording_requested_by, 8); w.p('MAIL TAX STATEMENTS TO: ' + d.mail_tax_statements_to, 8); w.rule();
  w.p(`${String(d.recording.office).toUpperCase()}     Instrument No. ${d.recording.document_number}     Recorded ${mdy(d.recording.recorded_date)} 11:30 AM     Fee ${usd(d.recording.recording_fee)}`, 8); w.rule();
  w.h('WARRANTY DEED', 14);
  w.p(`FOR VALUE RECEIVED, ${d.grantor} ("Grantor"), does hereby grant, bargain, sell and convey unto ${d.grantee} ("Grantee"), whose current address is ${d.property_address}, the following described premises in ${loan.property.address.county} County, Idaho, to wit:`);
  w.p(d.legal_description); w.kv('Commonly known as', d.property_address); w.kv('Assessor Parcel No. (APN)', d.apn); w.kv('Consideration', usd(d.consideration));
  w.p("TO HAVE AND TO HOLD the said premises, with their appurtenances unto the said Grantee, and Grantee's heirs and assigns forever. And the said Grantor does hereby covenant to and with the said Grantee, that Grantor is the owner in fee simple of said premises; that they are free from all encumbrances except current year taxes, levies and assessments, and except U.S. Patent reservations, restrictions, easements of record and easements visible upon the premises, and that Grantor will warrant and defend the same from all lawful claims whatsoever.");
  w.p(`SUBJECT TO a first-position Deed of Trust of even date securing ${usd(loan.loan.principal_amount)} in favor of ${loan.lender.name}, recorded concurrently as Instrument No. ${loan.security_instrument.recording_number}.`);
  w.sig(`Grantor: ${d.grantor}    Dated ${mdy(d.recording.recorded_date)}`); w.gap(10);
  w.p(`STATE OF IDAHO, County of ${loan.property.address.county}. This record was acknowledged before me on ${mdy(d.recording.recorded_date)} by ${d.grantor}.`, 8.5);
  w.sig('Notary Public for Idaho (demo)');
  stampPages(doc, font, anchor); fs.writeFileSync(out, await doc.save()); return 1;
}

/**
 * Monthly servicing statement + payment coupon for period n. This is the page the
 * scan-to-ledger test reads. It itemises the borrower sweep into the three contract
 * buckets: P&I, property-tax impound, insurance impound (hazard + FHA MIP).
 */
export async function servicingStatement(loan: CanonicalLoan, period: number, dueDate: string, receivedDate: string | null, out: string, anchor: string) {
  const { doc, w, font } = await start();
  const sv = loan.servicing;
  const m = { principal_and_interest: sv.principal_and_interest, property_tax_impound: sv.property_tax_impound, homeowners_insurance_impound: sv.insurance_detail.hazard_homeowners, fha_mip: sv.insurance_detail.fha_mip, total_piti: sv.monthly_total_sweep };
  const r = loan.loan.annual_interest_rate / 12;
  let bal = loan.loan.principal_amount, interest = 0, principal = 0;
  for (let n = 1; n <= period; n++) { interest = Math.round(bal * r * 100) / 100; principal = Math.round((m.principal_and_interest - interest) * 100) / 100; if (n < period) bal = Math.round((bal - principal) * 100) / 100; }
  const insurance = m.fha_mip + m.homeowners_insurance_impound;
  w.h('HIGH TECH MORTGAGE  -  Monthly Mortgage Statement', 13);
  w.kv('Loan No.', loan.loan.loan_id); w.kv('Borrower', loan.borrower.name);
  w.kv('Property', `${loan.property.address.street}, ${loan.property.address.city}, ${loan.property.address.state} ${loan.property.address.zip}`);
  w.kv('Payment', `${period} of ${loan.loan.term_months}`); w.kv('Payment Due Date', mdy(dueDate)); w.rule();
  w.h('Explanation of Amount Due', 11);
  w.row([[0, 'Principal & Interest (P&I)', true], [300, usdPlain(m.principal_and_interest), true]]);
  w.row([[16, `of which principal ${usdPlain(principal)}, interest ${usdPlain(interest)}`]], 8);
  w.row([[0, 'Property Tax Impound', true], [300, usdPlain(m.property_tax_impound), true]]);
  w.row([[0, 'Insurance Impound (Hazard + FHA MIP)', true], [300, usdPlain(insurance), true]]);
  w.row([[16, `hazard homeowners ${usdPlain(m.homeowners_insurance_impound)}, FHA MIP ${usdPlain(m.fha_mip)}`]], 8);
  w.row([[0, 'Total Amount Due', true], [300, usd(m.total_piti), true]]); w.rule();
  w.h('Account Information', 11);
  w.kv('Outstanding Principal', usd(bal)); w.kv('Interest Rate', `${(loan.loan.annual_interest_rate * 100).toFixed(3)}%`);
  w.kv('Tax Impound Balance', usd(m.property_tax_impound * period)); w.kv('Insurance Impound Balance', usd(insurance * period)); w.kv('Maturity Date', mdy(loan.loan.maturity_date)); w.rule();
  w.h('Transaction Activity', 11);
  if (receivedDate) { w.row([[0, mdy(receivedDate)], [110, 'Payment Received - Thank You'], [300, usdPlain(m.total_piti)]]); w.kv('Amount Received', usd(m.total_piti)); w.kv('Received on', mdy(receivedDate)); }
  else w.row([[0, '-'], [110, 'No payments received this period']]);
  w.gap(14); w.rule(); w.h('PAYMENT COUPON  (detach and return)', 11);
  w.kv('Loan No.', loan.loan.loan_id); w.kv('Payment Due Date', mdy(dueDate)); w.kv('Total Amount Due', usd(m.total_piti));
  w.kv('Additional Principal', '$ ____________'); w.kv('Total Enclosed', '$ ____________');
  w.p('Make checks payable to High Tech Mortgage, Inc. Loan Servicing, P.O. Box 0000, Sacramento, CA 95814. Late charge of 5% of principal and interest applies after the 15th. Only P&I, property-tax impound and insurance impound are collected; HOA dues and any optional products are paid by the borrower directly.', 8);
  stampPages(doc, font, anchor); fs.writeFileSync(out, await doc.save()); return 1;
}

/** Fannie Mae Form 3200 Multistate Fixed Rate Note, rendered from the note fixture. */
export async function promissoryNote3200(loan: CanonicalLoan, n: Record<string, any>, out: string, anchor: string) {
  const { doc, w, font } = await start();
  const s3 = n.section_3_payments, s6 = n.section_6_borrowers_failure_to_pay;
  w.h('NOTE', 16);
  w.row([[0, mdy(n.note_date)], [180, n.city_state], [400, 'Idaho']], 9);
  w.row([[0, '[Date]'], [180, '[City]'], [400, '[State]']], 7);
  w.p(n.property_address, 9.5); w.p('[Property Address]', 7); w.gap(4);
  w.h('1. BORROWER\'S PROMISE TO PAY', 10);
  w.p(`In return for a loan that I have received, I promise to pay U.S. ${usd(n.section_1_borrowers_promise_to_pay.principal)} (this amount is called "Principal"), plus interest, to the order of the Lender. The Lender is ${n.section_1_borrowers_promise_to_pay.lender}. I will make all payments under this Note in the form of cash, check or money order. I understand that the Lender may transfer this Note. The Lender or anyone who takes this Note by transfer and who is entitled to receive payments under this Note is called the "Note Holder."`);
  w.h('2. INTEREST', 10);
  w.p(`Interest will be charged on unpaid principal until the full amount of Principal has been paid. I will pay interest at a yearly rate of ${(n.section_2_interest.yearly_rate * 100).toFixed(3)}%. The interest rate required by this Section 2 is the rate I will pay both before and after any default described in Section 6(B) of this Note.`);
  w.h('3. PAYMENTS', 10);
  w.p(`(A) Time and Place of Payments. I will pay principal and interest by making a payment every month. I will make my monthly payment on the ${s3.payment_due_day_of_month}st day of each month beginning on ${mdy(s3.first_payment_date)}. I will make these payments every month until I have paid all of the principal and interest and any other charges described below that I may owe under this Note. Each monthly payment will be applied as of its scheduled due date and will be applied to interest before Principal. If, on ${mdy(s3.maturity_date)}, I still owe amounts under this Note, I will pay those amounts in full on that date, which is called the "Maturity Date." I will make my monthly payments at ${s3.place_of_payment} or at a different place if required by the Note Holder.`);
  w.p(`(B) Amount of Monthly Payments. My monthly payment will be in the amount of U.S. ${usd(s3.monthly_payment_amount)}.`);
  w.h('4. BORROWER\'S RIGHT TO PREPAY', 10);
  w.p('I have the right to make payments of Principal at any time before they are due. A payment of Principal only is known as a "Prepayment." When I make a Prepayment, I will tell the Note Holder in writing that I am doing so. I may make a full Prepayment or partial Prepayments without paying a Prepayment charge.');
  w.h('5. LOAN CHARGES', 10);
  w.p('If a law, which applies to this loan and which sets maximum loan charges, is finally interpreted so that the interest or other loan charges collected or to be collected in connection with this loan exceed the permitted limits, then any such loan charge shall be reduced by the amount necessary to reduce the charge to the permitted limit.');
  w.h('6. BORROWER\'S FAILURE TO PAY AS REQUIRED', 10);
  w.p(`(A) Late Charge for Overdue Payments. If the Note Holder has not received the full amount of any monthly payment by the end of ${s6.grace_period_days} calendar days after the date it is due, I will pay a late charge to the Note Holder. The amount of the charge will be ${(s6.late_charge_percent_of_overdue_pi * 100).toFixed(3)}% of my overdue payment of principal and interest (${usd(s6.late_charge_amount)}). I will pay this late charge promptly but only once on each late payment.`);
  w.p('(B) Default. If I do not pay the full amount of each monthly payment on the date it is due, I will be in default. (C) Notice of Default. If I am in default, the Note Holder may send me a written notice telling me that if I do not pay the overdue amount by a certain date, the Note Holder may require me to pay immediately the full amount of Principal which has not been paid and all the interest that I owe on that amount.');
  w.h('10. UNIFORM SECURED NOTE', 10);
  w.p(`This Note is a uniform instrument with limited variations in some jurisdictions. In addition to the protections given to the Note Holder under this Note, a ${n.section_10_uniform_secured_note.security_instrument} (${n.section_10_uniform_secured_note.security_instrument_form}), dated the same date as this Note, protects the Note Holder from possible losses which might result if I do not keep the promises which I make in this Note.`);
  w.p('WITNESS THE HAND(S) AND SEAL(S) OF THE UNDERSIGNED.', 9);
  w.sig(`${n.signatures.borrower}  -Borrower   (Seal)   ${mdy(n.signatures.signed)}`);
  w.p('MULTISTATE FIXED RATE NOTE - Single Family - Fannie Mae/Freddie Mac UNIFORM INSTRUMENT   Form 3200 1/01 (synthetic rendering)', 7);
  stampPages(doc, font, anchor); fs.writeFileSync(out, await doc.save()); return 1;
}
