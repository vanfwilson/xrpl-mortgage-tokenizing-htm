import fs from 'node:fs';
import { PDFDocument, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFTextField } from 'pdf-lib';
import type { CanonicalLoan } from '../ingest/canonical.js';
import { mdy, pens, signature, stampPages, usdPlain } from './common.js';

type Urla = Record<string, any>;
function field(doc: PDFDocument, suffix: string) {
  const f = doc.getForm().getFields().find((x) => x.getName().endsWith(suffix));
  if (!f) throw new Error(`URLA field not found: ${suffix}`);
  return f;
}
function setText(doc: PDFDocument, suffix: string, v: string | number | undefined | null) {
  if (v === undefined || v === null || v === '') return;
  const f = field(doc, suffix);
  if (f instanceof PDFTextField) { f.setText(String(v)); f.setFontSize(8); }
  else if (f instanceof PDFDropdown) f.select(String(v));
}
function check(doc: PDFDocument, suffix: string) { const f = field(doc, suffix); if (f instanceof PDFCheckBox) f.check(); }
function radio(doc: PDFDocument, name: string, option: string) {
  const f = field(doc, name);
  if (f instanceof PDFRadioGroup && f.getOptions().includes(option)) f.select(option);
}

/**
 * Fill the official Fannie Mae Form 1003 (09/2020) "Borrower Information" AcroForm for the same
 * homeowner as the rest of the package, and sign it in blue ink (section 6 borrower signature,
 * section 8 loan originator signature). SSN and DOB stay blank on purpose.
 */
export async function fillUrlaBorrower(loan: CanonicalLoan, urla: Urla, blankPath: string, outPath: string, anchor: string) {
  const doc = await PDFDocument.load(fs.readFileSync(blankPath), { ignoreEncryption: true });
  const form = doc.getForm();
  form.deleteXFA();
  const s1 = urla.section_1 ?? {}, s4 = urla.section_4 ?? {}, sig = urla.signatures ?? {};
  const am = String(s1.current_address ?? '').match(/^(.*?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})$/);

  setText(doc, 'Page1[0]._1a_Borrower_s_Name[0]', loan.borrower.name);
  setText(doc, 'Page1[0]._1a_Email[0]', 'borrower.demo@example.com');
  setText(doc, 'Page1[0]._1a_Dependents[0]', '0');
  radio(doc, 'Group1', s1.citizenship ?? 'U.S. Citizen'); radio(doc, 'Group2', 'I am applying for individual credit.'); radio(doc, 'Group3', s1.marital_status ?? 'Unmarried');
  if (am) { setText(doc, 'Page1[0]._1a_Address_St[0]', am[1]); setText(doc, 'Page1[0]._1a_Address_City[0]', am[2]); setText(doc, 'Page1[0]._1a_Address_State[0]', am[3]); setText(doc, 'Page1[0]._1a_Address_Zip[0]', am[4]); }
  setText(doc, 'Page1[0]._1a_Address_Country[0]', 'USA'); radio(doc, 'Group5', 'Rent'); check(doc, 'Page1[0]._1a_Does_Not_Apply2[0]');
  const emp = s1.employment ?? {};
  setText(doc, 'Page1[0]._1b_Employer[0]', emp.employer); setText(doc, 'Page1[0]._1b_Position[0]', emp.position); setText(doc, 'Page1[0]._1b_Base[0]', usdPlain(emp.monthly_income ?? 0));
  setText(doc, 'Page1[0]._1b_Employment_Start_Month[0]', '06'); setText(doc, 'Page1[0]._1b_Employment_Start_Day[0]', '01'); setText(doc, 'Page1[0]._1b_Employment_Start_Year[0]', String(2026 - (emp.years ?? 0)));
  setText(doc, 'Page1[0]._1b_Address[0]', '400 Innovation Way'); setText(doc, 'Page1[0]._1b_City[0]', 'Boise'); setText(doc, 'Page1[0]._1b_State[0]', 'ID'); setText(doc, 'Page1[0]._1b_Zip[0]', '83702');
  radio(doc, 'Group9', 'I have an ownership share of less than 25%.');

  setText(doc, 'Page5[0]._4a_Loan_Amount[0]', usdPlain(loan.loan.principal_amount)); radio(doc, 'Group11', 'Purchase');
  const a = loan.property.address;
  setText(doc, 'Page5[0]._4a_Address_St[0]', a.street); setText(doc, 'Page5[0]._4a_Address_City[0]', a.city); setText(doc, 'Page5[0]._4a_Address_State[0]', a.state); setText(doc, 'Page5[0]._4a_Address_Zip[0]', a.zip);
  setText(doc, 'Page5[0]._4a_Property_County[0]', a.county); setText(doc, 'Page5[0]._4a_Units[0]', '1'); setText(doc, 'Page5[0]._4a_Value[0]', usdPlain(loan.property.contract_sales_price));
  radio(doc, 'Group12', 'Primary Residence'); radio(doc, 'Group13', 'NO'); radio(doc, 'Group14', 'NO');
  if (loan.loan.loan_type === 'FHA') check(doc, 'Page5[0]._4a_FHA[0]');
  check(doc, 'Page5[0]._4b_Does_Not_Apply[0]'); check(doc, 'Page5[0]._4c_Does_Not_Apply[0]'); check(doc, 'Page5[0]._4d_Does_Not_Apply[0]');
  for (let g = 19; g <= 34; g++) { try { radio(doc, `Group${g}`, 'NO'); } catch { /* absent */ } }
  const signed = String(sig.borrower_signed ?? loan.closing.closing_date);
  const d = signed.split('-');
  setText(doc, 'Page7[0]._6a_SigDate1[0]', d[1]); setText(doc, 'Page7[0]._6a_SigDate2[0]', d[2]); setText(doc, 'Page7[0]._6a_SigDate3[0]', d[0]);
  setText(doc, '_8a\\.Loan_Ori_Org_NMLSR_ID_[0]', loan.lender.nmls_id || '0000000');
  setText(doc, '_8a\\.Loan_Ori_NMLSR_ID_[0]', sig.originator_nmls_id ?? '0000000');
  setText(doc, '_8a\\.Loan_Ori_Email[0]', 'originator.demo@example.com');
  setText(doc, 'Page9[0]._8a_Loan_Ori_Date1[0]', d[1]); setText(doc, 'Page9[0]._8a_Loan_Ori_Date2[0]', d[2]); setText(doc, 'Page9[0]._8a_Loan_Ori_Date3[0]', d[0]);
  for (const f of form.getFields()) {
    const n = f.getName();
    if (f instanceof PDFTextField && /_8a/.test(n) && /Org.*Name|Organization/i.test(n)) f.setText(sig.loan_originator ?? loan.lender.name);
    if (f instanceof PDFTextField && /_8a/.test(n) && /Ori_Name|Originator_Name/i.test(n)) f.setText('R. Originator');
  }
  const { font } = await pens(doc);
  form.updateFieldAppearances(font);
  // Blue-ink signatures over the form's signature fields (page 7 borrower, page 9 originator).
  signature(doc.getPage(6), loan.borrower.name, 126, 176, 200);
  signature(doc.getPage(8), 'R. Originator', 92, 579, 180);
  stampPages(doc, font, anchor);
  fs.writeFileSync(outPath, await doc.save());
  return doc.getPageCount();
}

/** Fill the "Lender Loan Information" companion form (L1–L4). */
export async function fillUrlaLender(loan: CanonicalLoan, blankPath: string, outPath: string, anchor: string) {
  const doc = await PDFDocument.load(fs.readFileSync(blankPath), { ignoreEncryption: true });
  const form = doc.getForm();
  form.deleteXFA();
  const s = loan.servicing;
  setText(doc, 'Lender', loan.loan.loan_id); setText(doc, "Agency'", loan.loan.fha_case_number);
  radio(doc, 'Group7', 'Property is not located in a project'); setText(doc, 'Property', loan.borrower.name);
  radio(doc, 'Group8', 'Fee Simple'); radio(doc, 'Group9', 'Sole Ownership'); radio(doc, 'Group12', 'FHA'); radio(doc, 'Group13', 'First Lien'); radio(doc, 'Group14', 'Fixed Rate');
  setText(doc, 'L3_Terms1[0]', (loan.loan.annual_interest_rate * 100).toFixed(3)); setText(doc, 'L3_Terms2[0]', String(loan.loan.term_months));
  setText(doc, 'L3_Payment1[0]', usdPlain(s.principal_and_interest)); setText(doc, 'L3_Payment2[0]', '0.00');
  setText(doc, 'L3_Payment3[0]', usdPlain(s.insurance_detail.hazard_homeowners)); setText(doc, 'L3_Payment4[0]', '0.00');
  setText(doc, 'L3_Payment5[0]', usdPlain(s.property_tax_impound)); setText(doc, 'L3_Payment6[0]', usdPlain(s.insurance_detail.fha_mip));
  setText(doc, 'L3_Payment7[0]', '0.00'); setText(doc, 'L3_Payment8[0]', '0.00'); setText(doc, 'L3_Payment9[0]', usdPlain(s.monthly_total_sweep));
  setText(doc, 'DUE FROM BORROWER(S)_1', usdPlain(loan.property.contract_sales_price));
  setText(doc, 'Loan amount_1', usdPlain(loan.loan.base_loan_amount)); setText(doc, 'Loan amount_2', usdPlain(loan.loan.financed_ufmip));
  setText(doc, 'L4_MortgageLoans[0]', usdPlain(loan.loan.principal_amount)); setText(doc, 'DUE FROM BORROWER(S)_15', usdPlain(loan.closing.cash_to_close));
  const { font } = await pens(doc);
  form.updateFieldAppearances(font);
  stampPages(doc, font, anchor);
  fs.writeFileSync(outPath, await doc.save());
  return doc.getPageCount();
}
