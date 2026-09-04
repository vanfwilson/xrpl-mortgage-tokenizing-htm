import fs from 'node:fs';
import path from 'node:path';
import { monthlyPayment, round2 } from '../domain/loan-math.js';

/**
 * Canonical loan record built from the FOUR closing documents a servicer needs:
 * Closing Disclosure (financial source of truth), Form 3200 Note (payment rules),
 * Form 3013 Deed of Trust (lien + APN + legal), recorded Warranty Deed (registry).
 * Servicing collects exactly three buckets: P&I, property-tax impound, insurance impound.
 */
export interface CanonicalLoan {
  schema: 'htm.canonical-loan/2';
  loan: {
    loan_id: string;
    loan_type: 'FHA' | 'Conventional' | 'VA' | 'USDA';
    fha_case_number?: string;
    product: string;
    purpose: string;
    note_form: string;
    currency: 'USD';
    base_loan_amount: number;
    financed_ufmip: number;
    principal_amount: number;
    annual_interest_rate: number;
    term_months: number;
    origination_date: string;
    first_payment_date: string;
    maturity_date: string;
    monthly_principal_and_interest: number;
  };
  note_terms: {
    payment_due_day_of_month: number;
    grace_period_days: number;
    late_charge_percent_of_pi: number;
    late_charge_amount: number;
    prepayment_penalty: boolean;
    place_of_payment: string;
  };
  borrower: { name: string; mailing_address: string };
  seller: { name: string };
  lender: { name: string; nmls_id: string };
  servicer: { name: string };
  property: {
    address: { street: string; city: string; state: string; zip: string; county: string };
    apn: string;
    legal_description: string;
    appraised_value: number;
    contract_sales_price: number;
    ltv: number;
  };
  security_instrument: {
    type: 'Deed of Trust' | 'Mortgage';
    form: string;
    lien_position: number;
    trustee: string;
    recording_number: string;
    recording_date: string;
    recording_time: string;
    recording_office: string;
  };
  vesting_deed: { type: string; recording_number: string; recording_date: string; recording_time: string; recording_office: string };
  closing: {
    settlement_agent: string;
    escrow_file_number: string;
    closing_date: string;
    disbursement_date: string;
    loan_costs: number;
    other_costs: number;
    lender_credits: number;
    closing_costs: number;
    deposit: number;
    seller_credits: number;
    cash_to_close: number;
    initial_escrow_deposit: number;
  };
  /** The three, and only three, servicing buckets. */
  servicing: {
    principal_and_interest: number;
    property_tax_impound: number;
    insurance_impound: number;          // hazard homeowners + FHA MIP
    insurance_detail: { hazard_homeowners: number; fha_mip: number };
    monthly_total_sweep: number;        // == P&I + tax + insurance
  };
  xrpl: { network: 'devnet'; issuer_address?: string; servicer_address?: string };
}

export interface ValidationIssue { field: string; message: string }

/** Cross-document consistency checks a servicer's boarding QC would run. */
export function validateCanonical(l: CanonicalLoan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const pmt = monthlyPayment(l.loan.principal_amount, l.loan.annual_interest_rate, l.loan.term_months);
  if (Math.abs(pmt - l.loan.monthly_principal_and_interest) > 0.01) issues.push({ field: 'loan.monthly_principal_and_interest', message: `expected ${pmt}` });
  if (round2(l.loan.base_loan_amount + l.loan.financed_ufmip) !== l.loan.principal_amount) issues.push({ field: 'loan.principal_amount', message: 'base + financed UFMIP must equal note amount' });
  const c = l.closing;
  if (round2(c.loan_costs + c.other_costs - c.lender_credits) !== c.closing_costs) issues.push({ field: 'closing.closing_costs', message: 'loan costs + other costs - lender credits' });
  const ctc = round2(l.property.contract_sales_price + c.closing_costs - l.loan.principal_amount - c.deposit - c.seller_credits);
  if (ctc !== c.cash_to_close) issues.push({ field: 'closing.cash_to_close', message: `ties to ${ctc}` });
  const s = l.servicing;
  if (round2(s.insurance_detail.hazard_homeowners + s.insurance_detail.fha_mip) !== s.insurance_impound) issues.push({ field: 'servicing.insurance_impound', message: 'hazard + MIP' });
  const sweep = round2(s.principal_and_interest + s.property_tax_impound + s.insurance_impound);
  if (sweep !== s.monthly_total_sweep) issues.push({ field: 'servicing.monthly_total_sweep', message: `three buckets sum to ${sweep}` });
  if (s.principal_and_interest !== l.loan.monthly_principal_and_interest) issues.push({ field: 'servicing.principal_and_interest', message: 'must equal Note P&I' });
  if (Math.abs(round2(l.loan.principal_amount / l.property.contract_sales_price * 100) / 100 - l.property.ltv) > 0.0001) issues.push({ field: 'property.ltv', message: 'LTV' });
  if (Math.abs(round2(l.loan.monthly_principal_and_interest * l.note_terms.late_charge_percent_of_pi) - l.note_terms.late_charge_amount) > 0.01) issues.push({ field: 'note_terms.late_charge_amount', message: 'late charge % × P&I' });
  if (l.security_instrument.recording_date !== l.vesting_deed.recording_date) issues.push({ field: 'security_instrument.recording_date', message: 'deed and deed of trust recorded same day' });
  return issues;
}

export function buildCanonicalFromDocuments(dir: string): CanonicalLoan {
  const read = (n: string) => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
  const cd = read('01-closing-disclosure.json');
  const note = read('02-promissory-note-3200.json');
  const dot = read('03-deed-of-trust-3013.json');
  const wd = read('04-warranty-deed-recorded.json');
  const [street, city, stzip] = String(cd.closing_information.property).split(', ');
  const [state, zip] = String(stzip).split(' ');
  const lt = cd.loan_terms, pp = cd.projected_payments, et = cd.estimated_taxes_insurance_assessments, cc = cd.costs_at_closing, calc = cd.calculating_cash_to_close;
  const hazard = et.homeowners_insurance.monthly, mip = pp.mortgage_insurance, tax = et.property_taxes.monthly;
  return {
    schema: 'htm.canonical-loan/2',
    loan: {
      loan_id: cd.loan_information.loan_id,
      loan_type: cd.loan_information.loan_type,
      fha_case_number: cd.loan_information.mic_number,
      product: `${cd.loan_information.loan_term_years}-Year ${cd.loan_information.product}`,
      purpose: cd.loan_information.purpose,
      note_form: 'Fannie Mae/Freddie Mac Form 3200 Multistate Fixed Rate Note',
      currency: 'USD',
      base_loan_amount: lt.base_loan_amount,
      financed_ufmip: lt.financed_ufmip,
      principal_amount: lt.loan_amount,
      annual_interest_rate: lt.interest_rate,
      term_months: lt.loan_term_months,
      origination_date: note.note_date,
      first_payment_date: note.section_3_payments.first_payment_date,
      maturity_date: note.section_3_payments.maturity_date,
      monthly_principal_and_interest: lt.monthly_principal_and_interest,
    },
    note_terms: {
      payment_due_day_of_month: note.section_3_payments.payment_due_day_of_month,
      grace_period_days: note.section_6_borrowers_failure_to_pay.grace_period_days,
      late_charge_percent_of_pi: note.section_6_borrowers_failure_to_pay.late_charge_percent_of_overdue_pi,
      late_charge_amount: note.section_6_borrowers_failure_to_pay.late_charge_amount,
      prepayment_penalty: !!note.section_4_borrowers_right_to_prepay.prepayment_penalty,
      place_of_payment: note.section_3_payments.place_of_payment,
    },
    borrower: { name: cd.transaction_information.borrower, mailing_address: cd.transaction_information.borrower_mailing_address },
    seller: { name: cd.transaction_information.seller },
    lender: { name: cd.transaction_information.lender, nmls_id: cd.transaction_information.lender_nmls_id },
    servicer: { name: 'High Tech Mortgage, Inc. Loan Servicing (demo)' },
    property: {
      address: { street, city, state, zip, county: 'Ada' },
      apn: dot.apn,
      legal_description: dot.legal_description,
      appraised_value: cd.closing_information.appraised_property_value,
      contract_sales_price: cd.closing_information.sale_price,
      ltv: lt.ltv,
    },
    security_instrument: {
      type: dot.instrument_type, form: 'Fannie Mae Form 3013 (Idaho)', lien_position: dot.lien_position, trustee: dot.trustee,
      recording_number: dot.recording.document_number, recording_date: dot.recording.recorded_date, recording_time: dot.recording.recorded_time, recording_office: dot.recording.office,
    },
    vesting_deed: { type: wd.instrument_type, recording_number: wd.recording.document_number, recording_date: wd.recording.recorded_date, recording_time: wd.recording.recorded_time, recording_office: wd.recording.office },
    closing: {
      settlement_agent: cd.closing_information.settlement_agent, escrow_file_number: cd.closing_information.file_number,
      closing_date: cd.closing_information.closing_date, disbursement_date: cd.closing_information.disbursement_date,
      loan_costs: cc.loan_costs, other_costs: cc.other_costs, lender_credits: cc.lender_credits, closing_costs: cc.closing_costs,
      deposit: -calc.deposit, seller_credits: -calc.seller_credits, cash_to_close: cc.cash_to_close,
      initial_escrow_deposit: cd.escrow_account_information.initial_escrow_payment_at_closing,
    },
    servicing: {
      principal_and_interest: pp.principal_and_interest,
      property_tax_impound: tax,
      insurance_impound: round2(hazard + mip),
      insurance_detail: { hazard_homeowners: hazard, fha_mip: mip },
      monthly_total_sweep: pp.estimated_total_monthly_payment,
    },
    xrpl: { network: 'devnet' },
  };
}
