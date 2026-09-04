import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import type { CanonicalLoan } from '../ingest/canonical.js';
import { mdy, pens, stampPages, text, usd, usdPlain, xmark, type Pen } from './common.js';

/** Fill the flat CFPB H-25 Closing Disclosure page 1 by coordinate overlay, plus an itemised values page. */
export async function overlayClosingDisclosure(loan: CanonicalLoan, cd: Record<string, any>, blankPath: string, outPath: string, anchor: string) {
  const src = await PDFDocument.load(fs.readFileSync(blankPath), { ignoreEncryption: true });
  const doc = await PDFDocument.create();
  const [p1] = await doc.copyPages(src, [0]);
  doc.addPage(p1);
  const { font, bold } = await pens(doc);
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
  text(pen2, 54, 760, 'Closing Disclosure - Itemised Figures (synthetic)', { size: 12, bold: true });
  line('Loan Amount', usd(lt.loan_amount), true); line('  Base loan amount', usd(lt.base_loan_amount)); line('  FHA UFMIP financed (1.75%)', usd(lt.financed_ufmip));
  line('Interest Rate', `${(lt.interest_rate * 100).toFixed(3)}%`, true); line('Loan Term', `${lt.loan_term_months} months`); line('LTV', `${(lt.ltv * 100).toFixed(2)}%`);
  line('First Payment Date', mdy(lt.first_payment_date)); line('Maturity Date', mdy(lt.maturity_date)); y -= 6;
  line('Principal & Interest', usdPlain(pp.principal_and_interest)); line('Mortgage Insurance (FHA MIP 0.50%)', usdPlain(pp.mortgage_insurance));
  line('Property Taxes (escrow)', usdPlain(taxM)); line("Homeowner's Insurance (escrow)", usdPlain(hoiM));
  line('Estimated Total Monthly Payment (PITI)', usd(pp.estimated_total_monthly_payment), true); y -= 6;
  line('Servicing split: P&I -> lender vault', usdPlain(pp.principal_and_interest)); line('Servicing split: tax impound', usdPlain(taxM)); line('Servicing split: insurance impound (hazard + MIP)', usdPlain(hoiM + pp.mortgage_insurance)); y -= 6;
  line('Closing Costs', usd(cc.closing_costs)); line('Cash to Close', usd(cc.cash_to_close), true);
  line('FHA Case No.', li.mic_number ?? ''); line('APN', loan.property.apn); line('Loan ID #', li.loan_id);
  stampPages(doc, font, anchor);
  fs.writeFileSync(outPath, await doc.save());
  return doc.getPageCount();
}
