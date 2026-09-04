import { round2 } from '../domain/loan-math.js';
import type { CanonicalLoan } from './canonical.js';
import { normalizeOcrText } from './normalize.js';

/**
 * Build the canonical loan record from the OCR text of the scanned four-document package.
 * Every value is read from the paper; `provenance` records which page supplied it and
 * `missing` lists required fields the paper did not yield. Nothing is looked up in a database.
 */
export type DocKind = 'closing_disclosure' | 'note' | 'deed_of_trust' | 'warranty_deed' | 'statement' | 'urla' | 'settlement_statement' | 'escrow_instructions' | 'fha_amendatory' | 'recorder_receipt' | 'ocr_test' | 'unknown';

export interface ScanBuild {
  loan: CanonicalLoan;
  provenance: Record<string, DocKind | 'derived'>;
  missing: string[];
  pages: Array<{ page: number; kind: DocKind }>;
}

export function classifyPage(text: string): DocKind {
  const t = text.toUpperCase();
  if (/OCR STRESS-TEST/.test(t)) return 'ocr_test';
  if (/RECORDING RECEIPT AND CERTIFICATION/.test(t)) return 'recorder_receipt';
  if (/ESCROW HOLDING INSTRUCTIONS/.test(t)) return 'escrow_instructions';
  if (/AMENDATORY CLAUSE/.test(t)) return 'fha_amendatory';
  if (/UNIFORM RESIDENTIAL LOAN APPLICATION|BORROWER INFORMATION|LENDER LOAN INFORMATION/.test(t)) return 'urla';
  if (/ALTA SETTLEMENT STATEMENT|SETTLEMENT STATEMENT/.test(t)) return 'settlement_statement';
  if (/CLOSING DISCLOSURE|CLOSI\s?NG DISCLOSU\s?RE/.test(t)) return 'closing_disclosure';
  if (/PROMISE TO PAY|MULTISTATE FIXED RATE NOTE|UNIFORM SECURED NOTE/.test(t)) return 'note';
  if (/DEED OF TRUST/.test(t) && /SECURITY INSTRUMENT|TRUSTEE/.test(t)) return 'deed_of_trust';
  if (/WARRANTY DEED/.test(t)) return 'warranty_deed';
  if (/MORTGAGE STATEMENT|PAYMENT COUPON/.test(t)) return 'statement';
  return 'unknown';
}

const money = (re: RegExp, t: string) => { const m = t.match(re); return m ? Number(m[1].replace(/,/g, '')) : undefined; };
const str = (re: RegExp, t: string) => { const m = t.match(re); return m ? m[1].trim() : undefined; };
const mdyToIso = (s?: string) => { const m = s?.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[1]}-${m[2]}` : undefined; };

export function buildCanonicalFromScan(pageTexts: string[]): ScanBuild {
  const pages = pageTexts.map((text, i) => ({ page: i + 1, kind: classifyPage(text), text: normalizeOcrText(text) }));
  const by = (k: DocKind) => pages.filter((p) => p.kind === k).map((p) => p.text).join(' ');
  const cd = by('closing_disclosure'), note = by('note'), dot = by('deed_of_trust'), wd = by('warranty_deed');
  const prov: Record<string, DocKind | 'derived'> = {};
  const missing: string[] = [];
  const need = <T>(key: string, v: T | undefined, from: DocKind | 'derived', fallback: T): T => {
    if (v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))) { missing.push(key); return fallback; }
    prov[key] = from; return v;
  };

  // Closing Disclosure
  const loanId = need('loan.loan_id', str(/Loan ID #?\s?([A-Z]{2,6}-\d{4}-\d{4,6}[A-Z]?)/i, cd), 'closing_disclosure', 'UNKNOWN');
  const principal = need('loan.principal_amount', money(/Loan Amount:?\s?\$?\s?([\d,]+\.\d{2})/i, cd), 'closing_disclosure', 0);
  const base = money(/Base loan amount:?\s?\$?\s?([\d,]+\.\d{2})/i, cd);
  const ufmip = money(/UFMIP[^$]{0,40}\$\s?([\d,]+\.\d{2})/i, cd);
  const rate = need('loan.annual_interest_rate', (() => { const m = cd.match(/Interest Rate:?\s?(\d{1,2}\.\d{1,3})\s?%/i); return m ? Number(m[1]) / 100 : undefined; })(), 'closing_disclosure', 0);
  const term = need('loan.term_months', (() => { const m = cd.match(/Loan Term:?\s?(\d{2,3})\s?months/i); return m ? Number(m[1]) : undefined; })(), 'closing_disclosure', 360);
  const ltv = (() => { const m = cd.match(/LTV:?\s?(\d{2,3}\.\d{1,2})\s?%/i); return m ? Number(m[1]) / 100 : undefined; })();
  const firstPay = need('loan.first_payment_date', mdyToIso(str(/First Payment Date:?\s?(\d{2}\/\d{2}\/\d{4})/i, cd)), 'closing_disclosure', '');
  const maturity = need('loan.maturity_date', mdyToIso(str(/Maturity Date:?\s?(\d{2}\/\d{2}\/\d{4})/i, cd) ?? str(/If, on (\d{2}\/\d{2}\/\d{4})/i, note)), 'closing_disclosure', '');
  const pi = need('loan.monthly_principal_and_interest', money(/Principal & Interest:?\s?\$?\s?([\d,]+\.\d{2})/i, cd), 'closing_disclosure', 0);
  const mip = need('servicing.insurance_detail.fha_mip', money(/Mortgage Insurance(?: \(FHA MIP [\d.]+%\))?:?\s?\$?\s?([\d,]+\.\d{2})/i, cd), 'closing_disclosure', 0);
  const tax = need('servicing.property_tax_impound', money(/Property Taxes \(escrow\):?\s?\$?\s?([\d,]+\.\d{2})/i, cd), 'closing_disclosure', 0);
  const hoi = need('servicing.insurance_detail.hazard_homeowners', money(/Homeowner'?s Insurance \(escrow\):?\s?\$?\s?([\d,]+\.\d{2})/i, cd), 'closing_disclosure', 0);
  const sweep = need('servicing.monthly_total_sweep', money(/Estimated Total Monthly Payment(?: \(PITI\))?:?\s?\$?\s?([\d,]+\.\d{2})/i, cd), 'closing_disclosure', 0);
  const closingCosts = need('closing.closing_costs', money(/Closing Costs:?\s?\$?\s?([\d,]+\.\d{2})/i, cd), 'closing_disclosure', 0);
  const loanCosts = money(/Loan Costs:?\s?\$?\s?([\d,]+\.\d{2})/i, cd) ?? money(/\$([\d,]+\.\d{2}) \$[\d,]+\.\d{2} Closing Costs/i, cd);
  const otherCosts = money(/Other Costs:?\s?\$?\s?([\d,]+\.\d{2})/i, cd) ?? money(/\$[\d,]+\.\d{2} \$([\d,]+\.\d{2}) Closing Costs/i, cd);
  const lenderCredits = money(/Lender Credits:?\s?\$?\s?([\d,]+\.\d{2})/i, cd) ?? 0;
  const cashToClose = need('closing.cash_to_close', money(/Cash to Close:?\s?\$?\s?([\d,]+\.\d{2})/i, cd), 'closing_disclosure', 0);
  const deposit = money(/Deposit(?: \(earnest money\))?:?\s?\$?\s?([\d,]+\.\d{2})/i, cd);
  const sellerCredits = money(/Seller Credits?:?\s?\$?\s?([\d,]+\.\d{2})/i, cd);
  const salePrice = money(/Sale Price:?\s?\$?\s?([\d,]+\.\d{2})/i, cd) ?? money(/Consideration:?\s?\$?\s?([\d,]+\.\d{2})/i, wd);
  const appraised = money(/Appraised (?:Property )?Value:?\s?\$?\s?([\d,]+\.\d{2})/i, cd);
  const initialEscrow = money(/Initial Escrow (?:Payment|Deposit)(?: at Closing)?:?\s?\$?\s?([\d,]+\.\d{2})/i, cd);
  const caseNo = str(/(?:FHA Case No\.?|MIC ?#):?\s?(\d{3}-\d{7}-\d{3})/i, cd + ' ' + dot);
  const dateIssued = mdyToIso(str(/Date Issued:?\s?(\d{2}\/\d{2}\/\d{4})/i, cd));
  const closingDate = need('closing.closing_date', mdyToIso(str(/Closing Date:?\s?(\d{2}\/\d{2}\/\d{4})/i, cd)), 'closing_disclosure', '');
  const disbDate = mdyToIso(str(/Disbursement Date:?\s?(\d{2}\/\d{2}\/\d{4})/i, cd)) ?? closingDate;
  const agent = str(/Settlement Agent:?\s?(.+?)(?: Seller| File)/i, cd) ?? str(/Recording requested by:?\s?(.+?) ADA COUNTY/i, wd);
  const fileNo = str(/File #?:?\s?([A-Z]{2,5}-\d{4}-\d{4,6})/i, cd);
  const seller = need('seller.name', str(/Seller:?\s?([A-Z][A-Za-z.]+(?: [A-Z][A-Za-z.]+){1,3})(?= File| Loan| Lender| Property|$)/, cd) ?? str(/FOR VALUE RECEIVED,? (.+?) \("Grantor"\)/i, wd), 'closing_disclosure', 'UNKNOWN');
  const loanType: CanonicalLoan['loan']['loan_type'] = /FHA/i.test(cd) || /FHA Case/i.test(dot) ? 'FHA' : 'Conventional';

  // Note (Form 3200)
  const lender = need('lender.name', str(/The beneficiary is (.+?) \("Lender"\)/i, dot) ?? str(/The Lender is (.+?)\. I will/i, note) ?? str(/The Lender is (.+?)\./i, note), 'deed_of_trust', 'UNKNOWN');
  const dueDay = need('note_terms.payment_due_day_of_month', (() => { const m = note.match(/payment on the (\d{1,2})(?:st|nd|rd|th) day of each month/i); return m ? Number(m[1]) : undefined; })(), 'note', 1);
  const grace = need('note_terms.grace_period_days', (() => { const m = note.match(/end of (\d{1,2}) calendar days/i); return m ? Number(m[1]) : undefined; })(), 'note', 15);
  const latePct = need('note_terms.late_charge_percent_of_pi', (() => { const m = note.match(/will be (\d{1,2}\.\d{1,3})\s?% of my overdue payment/i); return m ? Number(m[1]) / 100 : undefined; })(), 'note', 0.05);
  const lateAmt = money(/overdue payment of principal and interest \(\$([\d,]+\.\d{2})\)/i, note);
  const place = str(/monthly payments at (.+?) or at a different place/i, note);
  const noteDate = mdyToIso(str(/^(\d{2}\/\d{2}\/\d{4}) /, note) ?? str(/(\d{2}\/\d{2}\/\d{4}) Meridian/i, note) ?? str(/is made on (\d{2}\/\d{2}\/\d{4})/i, dot));
  const borrower = need('borrower.name', str(/The grantor is (.+?) \("Borrower"\)/i, dot) ?? str(/Borrower:?\s?([A-Z][A-Za-z.]+(?: [A-Z][A-Za-z.]+){1,3})/, cd), 'deed_of_trust', 'UNKNOWN');

  // Deed of Trust (Form 3013)
  const dotRec = need('security_instrument.recording_number', str(/Instrument No\.?\s?(\d{4}-\d{6,}[A-Z]?)/i, dot), 'deed_of_trust', '');
  const dotDate = need('security_instrument.recording_date', mdyToIso(str(/Recorded (\d{2}\/\d{2}\/\d{4})/i, dot)), 'deed_of_trust', '');
  const dotTime = str(/Recorded \d{2}\/\d{2}\/\d{4} (\d{1,2}:\d{2}(?::\d{2})? ?[AP]M)/i, dot);
  const office = str(/((?:[A-Z]+ )+COUNTY RECORDER, [A-Z]+, [A-Z]+)/, dot + ' ' + wd);
  const legal = need('property.legal_description', str(/(Lot \d+, Block \d+.+?Idaho\.)/i, dot) ?? str(/(Lot \d+, Block \d+.+?Idaho\.)/i, wd), 'deed_of_trust', '');
  const apn = need('property.apn', str(/(?:APN\)?|Parcel No\.? \(APN\))\s?([A-Z]?\d{4,}-\d{3,})/i, dot + ' ' + cd), 'deed_of_trust', '');
  const addr = need('property.address', str(/Commonly known as (.+?)(?: Assessor|$)/i, dot) ?? str(/Property:?\s?(\d+ .+?, [A-Z][a-z]+, [A-Z]{2} \d{5})/, cd), 'deed_of_trust', '');
  const county = str(/located in ([A-Z][a-z]+) County/i, dot) ?? 'Ada';
  const trustee = str(/The trustee is (.+?) \("Trustee"\)/i, dot) ?? agent ?? 'UNKNOWN';
  const lien = (() => { const m = dot.match(/Lien position:?\s?(?:First|Second)? ?\(?(\d)\)?/i); return m ? Number(m[1]) : 1; })();

  // Warranty deed
  const wdRec = need('vesting_deed.recording_number', str(/Instrument No\.?\s?(\d{4}-\d{6,}[A-Z]?)/i, wd), 'warranty_deed', '');
  const wdDate = need('vesting_deed.recording_date', mdyToIso(str(/Recorded (\d{2}\/\d{2}\/\d{4})/i, wd)), 'warranty_deed', '');
  const wdTime = str(/Recorded \d{2}\/\d{2}\/\d{4} (\d{1,2}:\d{2}(?::\d{2})? ?[AP]M)/i, wd);

  const am = addr.match(/^(.*?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})/);
  const toTime = (s?: string) => { if (!s) return '00:00:00'; const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))? ?([AP]M)/i); if (!m) return '00:00:00'; let h = Number(m[1]) % 12; if (m[4].toUpperCase() === 'PM') h += 12; return `${String(h).padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}`; };
  const derived = (k: string) => { prov[k] = 'derived'; };
  const baseAmt = base ?? (loanType === 'FHA' ? round2(principal / 1.0175) : principal); if (base === undefined) derived('loan.base_loan_amount');
  const ufmipAmt = ufmip ?? round2(principal - baseAmt); if (ufmip === undefined) derived('loan.financed_ufmip');
  const price = salePrice ?? 0; if (salePrice === undefined) missing.push('property.contract_sales_price'); else prov['property.contract_sales_price'] = /Sale Price/i.test(cd) ? 'closing_disclosure' : 'warranty_deed';
  const insurance = round2(hoi + mip); derived('servicing.insurance_impound');
  const dep = deposit ?? 0; if (deposit === undefined) missing.push('closing.deposit');
  const sc = sellerCredits ?? 0; if (sellerCredits === undefined) missing.push('closing.seller_credits');

  const loan: CanonicalLoan = {
    schema: 'htm.canonical-loan/2',
    loan: {
      loan_id: loanId, loan_type: loanType, fha_case_number: caseNo, product: `${term / 12}-Year Fixed Rate`, purpose: /Purpose Purchase/i.test(cd) ? 'Purchase' : 'Refinance',
      note_form: 'Fannie Mae/Freddie Mac Form 3200 Multistate Fixed Rate Note', currency: 'USD',
      base_loan_amount: baseAmt, financed_ufmip: ufmipAmt, principal_amount: principal, annual_interest_rate: rate, term_months: term,
      origination_date: noteDate ?? closingDate, first_payment_date: firstPay, maturity_date: maturity, monthly_principal_and_interest: pi,
    },
    note_terms: { payment_due_day_of_month: dueDay, grace_period_days: grace, late_charge_percent_of_pi: latePct, late_charge_amount: lateAmt ?? round2(pi * latePct), prepayment_penalty: /Prepayment Penalty Does not/i.test(cd) ? false : !/without paying a Prepayment charge/i.test(note), place_of_payment: place ?? '' },
    borrower: { name: borrower, mailing_address: addr },
    seller: { name: seller },
    lender: { name: lender, nmls_id: str(/NMLS ?#?:?\s?(\d{4,8})/i, cd) ?? '' },
    servicer: { name: place ? place.split(',')[0] : 'servicer per Note s.3' },
    property: {
      address: { street: am?.[1] ?? addr, city: am?.[2] ?? '', state: am?.[3] ?? '', zip: am?.[4] ?? '', county },
      apn, legal_description: legal, appraised_value: appraised ?? price, contract_sales_price: price, ltv: ltv ?? (price ? round2(principal / price * 100) / 100 : 0),
    },
    security_instrument: { type: 'Deed of Trust', form: /Form 3013/i.test(dot) ? 'Fannie Mae Form 3013 (Idaho)' : 'Deed of Trust', lien_position: lien, trustee, recording_number: dotRec, recording_date: dotDate, recording_time: toTime(dotTime), recording_office: office ?? '' },
    vesting_deed: { type: 'Warranty Deed', recording_number: wdRec, recording_date: wdDate, recording_time: toTime(wdTime), recording_office: office ?? '' },
    closing: {
      settlement_agent: agent ?? trustee, escrow_file_number: fileNo ?? '', closing_date: closingDate, disbursement_date: disbDate,
      loan_costs: loanCosts ?? 0, other_costs: otherCosts ?? 0, lender_credits: lenderCredits, closing_costs: closingCosts,
      deposit: dep, seller_credits: sc, cash_to_close: cashToClose, initial_escrow_deposit: initialEscrow ?? 0,
    },
    servicing: { principal_and_interest: pi, property_tax_impound: tax, insurance_impound: insurance, insurance_detail: { hazard_homeowners: hoi, fha_mip: mip }, monthly_total_sweep: sweep },
    xrpl: { network: 'devnet' },
  };
  if (appraised === undefined) derived('property.appraised_value');
  if (dateIssued) prov['closing.date_issued'] = 'closing_disclosure';
  return { loan, provenance: prov, missing, pages: pages.map(({ page, kind }) => ({ page, kind })) };
}
