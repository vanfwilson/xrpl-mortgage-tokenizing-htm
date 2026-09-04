import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import type { CanonicalLoan } from '../ingest/canonical.js';
import { mdy, pens, signature, stampPages, text, usd, usdPlain, xmark, type Pen } from './common.js';

/** Fill the flat CFPB H-25 Closing Disclosure page 1 by coordinate overlay, plus an itemised values page. */
export async function overlayClosingDisclosure(loan: CanonicalLoan, cd: Record<string, any>, blankPath: string, outPath: string, anchor: string) {
  const src = await PDFDocument.load(fs.readFileSync(blankPath), { ignoreEncryption: true });
  const doc = await PDFDocument.create();
  const [p1] = await doc.copyPages(src, [0]);
  doc.addPage(p1);
  const { font, bold, scripts } = await pens(doc);
  const pen: Pen = { page: p1, font, bold, size: 8 };
  const ci = cd.closing_information, ti = cd.transaction_information, li = cd.loan_information, lt = cd.loan_terms, pp = cd.projected_payments, et = cd.estimated_taxes_insurance_assessments, cc = cd.costs_at_closing;
  const taxM = et.property_taxes.monthly, hoiM = et.homeowners_insurance.monthly;
  const L = 108;
  text(pen, L, 690, mdy(ci.date_issued)); text(pen, L, 678, mdy(ci.closing_date)); text(pen, L, 666, mdy(ci.disbursement_date));
  text(pen, L, 654, ci.settlement_agent, { maxWidth: 110 }); text(pen, L, 642, ci.file_number); text(pen, L, 630, ci.property, { maxWidth: 110 });
  text(pen, L, 612, usd(ci.sale_price));
  text(pen, 262, 690, ti.borrower); text(pen, 262, 680, `${loan.property.address.street}, ${loan.property.address.city}, ${loan.property.address.state} ${loan.property.address.zip}`, { size: 6.5, maxWidth: 120 });
  text(pen, 262, 657, ti.seller); text(pen, 262, 624, ti.lender, { maxWidth: 125 });
  text(pen, 470, 690, `${li.loan_term_years} years`); text(pen, 470, 678, li.purpose); text(pen, 470, 666, li.product);
  if (li.loan_type === 'FHA') xmark(pen, 549, 645, 7); else xmark(pen, 484, 645, 7);
  text(pen, 500, 617, li.loan_id, { size: 7 }); text(pen, 500, 605, li.mic_number ?? '', { size: 7 });
  text(pen, 130, 565, usd(lt.loan_amount), { size: 9, bold: true }); text(pen, 192, 565, 'NO');
  text(pen, 130, 539, `${(lt.interest_rate * 100).toFixed(3)}%`, { size: 9, bold: true }); text(pen, 192, 539, 'NO');
  text(pen, 192, 497, usd(pp.principal_and_interest), { size: 9, bold: true }); text(pen, 262, 497, 'NO');
  text(pen, 192, 427, 'Does not have this feature.'); text(pen, 192, 405, 'Does not have this feature.');
  text(pen, 192, 348, `Years 1-${li.loan_term_years}`, { bold: true });
  text(pen, 192, 320, usdPlain(pp.principal_and_interest), { size: 9 });
  text(pen, 192, 296, usdPlain(pp.mortgage_insurance), { size: 9 });
  text(pen, 192, 276, usdPlain(pp.estimated_escrow), { size: 9 });
  text(pen, 192, 243, usd(pp.estimated_total_monthly_payment), { size: 10, bold: true });
  text(pen, 192, 198, usd(et.monthly_amount), { size: 9 });
  text(pen, 192, 186, 'a month');
  xmark(pen, 292, 199, 7); text(pen, 380, 199, 'YES');
  xmark(pen, 292, 187, 7); text(pen, 380, 187, 'YES');
  text(pen, 192, 96, usd(cc.closing_costs), { size: 9, bold: true });
  text(pen, 292, 99, usd(cc.loan_costs), { size: 6.5 }); text(pen, 400, 99, usd(cc.other_costs), { size: 6.5 }); text(pen, 292, 88, usd(cc.lender_credits), { size: 6.5 });
  text(pen, 192, 61, usd(cc.cash_to_close), { size: 9, bold: true });

  const p2 = doc.addPage([612, 792]);
  const pen2: Pen = { page: p2, font, bold, size: 9 };
  let y = 736;
  const line = (k: string, v: string, b = false) => { text(pen2, 54, y, k, { bold: b }); text(pen2, 380, y, v, { bold: b }); y -= 14; };
  text(pen2, 54, 760, 'Closing Disclosure - Figures from pages 2-5 (synthetic)', { size: 12, bold: true });
  line('Loan Amount', usd(lt.loan_amount), true); line('  Base loan amount', usd(lt.base_loan_amount)); line('  FHA UFMIP financed (1.75%)', usd(lt.financed_ufmip));
  line('Interest Rate', `${(lt.interest_rate * 100).toFixed(3)}%`, true); line('Loan Term', `${lt.loan_term_months} months`); line('LTV', `${(lt.ltv * 100).toFixed(2)}%`);
  line('First Payment Date', mdy(lt.first_payment_date)); line('Maturity Date', mdy(lt.maturity_date)); y -= 6;
  line('Principal & Interest', usdPlain(pp.principal_and_interest)); line('Mortgage Insurance (FHA MIP 0.50%)', usdPlain(pp.mortgage_insurance));
  line('Property Taxes (escrow)', usdPlain(taxM)); line("Homeowner's Insurance (escrow)", usdPlain(hoiM));
  line('Estimated Total Monthly Payment (PITI)', usd(pp.estimated_total_monthly_payment), true); y -= 6;
  line('Servicing split: P&I -> lender vault', usdPlain(pp.principal_and_interest)); line('Servicing split: tax impound', usdPlain(taxM)); line('Servicing split: insurance impound (hazard + MIP)', usdPlain(hoiM + pp.mortgage_insurance)); y -= 6;
  line('Sale Price', usd(ci.sale_price)); line('Appraised Property Value', usd(ci.appraised_property_value));
  line('Closing Costs', usd(cc.closing_costs)); line('  Loan Costs', usd(cc.loan_costs)); line('  Other Costs', usd(cc.other_costs)); line('  Lender Credits', usd(cc.lender_credits));
  line('Deposit (earnest money)', usd(-cd.calculating_cash_to_close.deposit)); line('Seller Credits', usd(-cd.calculating_cash_to_close.seller_credits));
  line('Initial Escrow Payment at Closing', usd(cd.escrow_account_information.initial_escrow_payment_at_closing));
  line('Cash to Close', usd(cc.cash_to_close), true);
  line('Settlement Agent', ci.settlement_agent); line('File #', ci.file_number); line('Seller', ti.seller); line('Lender', ti.lender);
  y -= 30; text(pen2, 54, y + 34, 'Confirm Receipt: By signing, you are only confirming that you have received this form.', { size: 8 });
  signature(p2, ti.borrower, 60, y, 190, { date: mdy(ci.closing_date), font, scripts });
  p2.drawLine({ start: { x: 54, y: y - 2 }, end: { x: 300, y: y - 2 }, thickness: 0.8 }); text(pen2, 54, y - 12, `Applicant Signature   ${ti.borrower}`, { size: 8 });
  line('FHA Case No.', li.mic_number ?? ''); line('APN', loan.property.apn); line('Loan ID #', li.loan_id);
  stampPages(doc, font, anchor);
  fs.writeFileSync(outPath, await doc.save());
  return doc.getPageCount();
}

/** ALTA Settlement Statement (Borrower/Buyer): overlay on the official ALTA form page 1, plus a ledger page, signed. */
export async function overlayAltaStatement(loan: CanonicalLoan, ss: Record<string, any>, blankPath: string, outPath: string, anchor: string) {
  const src = await PDFDocument.load(fs.readFileSync(blankPath), { ignoreEncryption: true });
  const doc = await PDFDocument.create();
  const [p1] = await doc.copyPages(src, [0]);
  doc.addPage(p1);
  const { font, bold, scripts } = await pens(doc);
  const pen: Pen = { page: p1, font, bold, size: 8 };
  text(pen, 150, 651, ss.file_number); text(pen, 150, 638, `${mdy(ss.settlement_date)} 10:00 AM`); text(pen, 150, 625, 'A. Closer'); text(pen, 150, 612, 'Meridian, ID');
  text(pen, 240, 651, ss.settlement_agent, { bold: true, maxWidth: 160 }); text(pen, 240, 638, 'ALTA ID 0000000 (demo)'); text(pen, 240, 625, '100 Title Row, Meridian, ID 83642');
  const a = loan.property.address;
  text(pen, 130, 556, `${a.street}, ${a.city}, ${a.state} ${a.zip}  (APN ${loan.property.apn})`);
  text(pen, 130, 543, loan.borrower.name); text(pen, 130, 530, loan.seller.name); text(pen, 130, 517, loan.lender.name);
  text(pen, 130, 490, mdy(ss.settlement_date)); text(pen, 130, 477, mdy(loan.closing.disbursement_date));
  const D = 458, C = 522;
  const row = (y: number, debit?: number, credit?: number) => { if (debit !== undefined) text(pen, D, y, usdPlain(debit)); if (credit !== undefined) text(pen, C, y, usdPlain(credit)); };
  const s = ss.summary;
  row(367, s.contract_sales_price); row(338, undefined, s.earnest_money_deposit); row(324, undefined, s.new_loan_principal); row(297, undefined, s.seller_credit);
  const chg = Object.fromEntries((ss.settlement_charges_detail as Array<{ line: string; amount: number }>).map((c) => [c.line, c.amount]));
  row(159, chg['801']); row(131, loan.loan.financed_ufmip); text(pen, 300, 131, '(financed into loan)', { size: 6.5 });
  const p2 = doc.addPage([612, 792]);
  const pen2: Pen = { page: p2, font, bold, size: 9 };
  let y = 740;
  text(pen2, 54, 760, 'ALTA Settlement Statement - Borrower Ledger (synthetic)', { size: 12, bold: true });
  text(pen2, 54, y, 'Code', { bold: true }); text(pen2, 100, y, 'Description', { bold: true }); text(pen2, 420, y, 'Debit', { bold: true }); text(pen2, 500, y, 'Credit', { bold: true }); y -= 16;
  let dt = 0, ct = 0;
  for (const d of ss.debits) { text(pen2, 54, y, d.code); text(pen2, 100, y, d.description); text(pen2, 420, y, usdPlain(d.amount)); dt += d.amount; y -= 14; }
  for (const c of ss.credits) { text(pen2, 54, y, c.code); text(pen2, 100, y, c.description); text(pen2, 500, y, usdPlain(c.amount)); ct += c.amount; y -= 14; }
  y -= 6; text(pen2, 100, y, 'Totals', { bold: true }); text(pen2, 420, y, usdPlain(dt), { bold: true }); text(pen2, 500, y, usdPlain(ct), { bold: true }); y -= 20;
  text(pen2, 54, y, 'Settlement charges to borrower (line 103) detail:', { bold: true }); y -= 14;
  for (const c of ss.settlement_charges_detail) { text(pen2, 70, y, `${c.line}  ${c.description}`); text(pen2, 420, y, usdPlain(c.amount)); y -= 13; }
  y -= 8; text(pen2, 54, y, `Cash from Borrower at Settlement: ${usd(s.cash_from_borrower)}`, { bold: true, size: 10 });
  y -= 14; text(pen2, 54, y, `Escrow File No. ${ss.file_number}   Loan No. ${loan.loan.loan_id}`);
  y -= 50; text(pen2, 54, y + 30, 'I have carefully reviewed the ALTA Settlement Statement and find it to be a true and accurate statement of all receipts and disbursements made on my account.', { size: 8 });
  signature(p2, loan.borrower.name, 60, y, 190, { date: mdy(ss.settlement_date), font, scripts });
  p2.drawLine({ start: { x: 54, y: y - 2 }, end: { x: 300, y: y - 2 }, thickness: 0.8 }); text(pen2, 54, y - 12, `Borrower   ${loan.borrower.name}`, { size: 8 });
  signature(p2, 'A. Closer', 360, y, 150, { font, scripts }); p2.drawLine({ start: { x: 354, y: y - 2 }, end: { x: 560, y: y - 2 }, thickness: 0.8 }); text(pen2, 354, y - 12, `Escrow Officer, ${ss.settlement_agent}`, { size: 8 });
  stampPages(doc, font, anchor); fs.writeFileSync(outPath, await doc.save()); return doc.getPageCount();
}
