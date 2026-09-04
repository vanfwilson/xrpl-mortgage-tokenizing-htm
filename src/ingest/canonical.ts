import fs from 'node:fs';
import path from 'node:path';
import { monthlyPayment, round2 } from '../domain/loan-math.js';

/** Canonical loan record: one JSON the ledger steps consume. */
export interface CanonicalLoan {
  schema: 'htm.canonical-loan/1';
  loan: {
    loan_id: string;
    product: string;
    loan_type: 'FHA' | 'Conventional' | 'VA' | 'USDA';
    fha_case_number?: string;
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
  borrower: { name: string; role: 'Borrower' };
  seller: { name: string };
  lender: { name: string; nmls_id: string };
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
    lien_position: number;
    trustee: string;
    recording_number: string;
    recording_date: string;
  };
  vesting_deed: { type: string; recording_number: string; recording_date: string };
  closing: {
    settlement_agent: string;
    escrow_file_number: string;
    closing_date: string;
    earnest_money_deposit: number;
    seller_credit: number;
    settlement_charges: number;
    cash_to_close: number;
  };
  escrow_ledger: {
    debits: Array<{ code: string; description: string; amount: number }>;
    credits: Array<{ code: string; description: string; amount: number }>;
  };
  recurring_monthly: {
    principal_and_interest: number;
    fha_mip: number;
    property_tax_impound: number;
    homeowners_insurance_impound: number;
    total_piti: number;
    hoa_dues_not_impounded: number;
    credit_life_insurance: number;
  };
  xrpl: {
    network: 'devnet';
    /** Filled at run time from out/wallets.json. */
    issuer_address?: string;
    servicer_address?: string;
  };
}

export interface ValidationIssue { field: string; message: string }

/** Cross-document consistency checks a compliance reviewer would run. */
export function validateCanonical(l: CanonicalLoan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const pmt = monthlyPayment(l.loan.principal_amount, l.loan.annual_interest_rate, l.loan.term_months);
  if (Math.abs(pmt - l.loan.monthly_principal_and_interest) > 0.01) {
    issues.push({ field: 'loan.monthly_principal_and_interest', message: `expected ${pmt}` });
  }
  if (round2(l.loan.base_loan_amount + l.loan.financed_ufmip) !== l.loan.principal_amount) {
    issues.push({ field: 'loan.principal_amount', message: 'base + financed UFMIP must equal note amount' });
  }
  const debits = round2(l.escrow_ledger.debits.reduce((s, r) => s + r.amount, 0));
  const credits = round2(l.escrow_ledger.credits.reduce((s, r) => s + r.amount, 0));
  if (debits !== credits) issues.push({ field: 'escrow_ledger', message: `debits ${debits} != credits ${credits}` });
  const c = l.closing;
  const ctc = round2(
    l.property.contract_sales_price + c.settlement_charges - l.loan.principal_amount - c.earnest_money_deposit - c.seller_credit,
  );
  if (ctc !== c.cash_to_close) issues.push({ field: 'closing.cash_to_close', message: `ties to ${ctc}` });
  const m = l.recurring_monthly;
  const piti = round2(m.principal_and_interest + m.fha_mip + m.property_tax_impound + m.homeowners_insurance_impound);
  if (piti !== m.total_piti) issues.push({ field: 'recurring_monthly.total_piti', message: `sums to ${piti}` });
  if (m.principal_and_interest !== l.loan.monthly_principal_and_interest) {
    issues.push({ field: 'recurring_monthly.principal_and_interest', message: 'must match note P&I' });
  }
  const ltv = round2(l.loan.principal_amount / l.property.contract_sales_price * 100) / 100;
  if (Math.abs(ltv - l.property.ltv) > 0.0001) issues.push({ field: 'property.ltv', message: `expected ${ltv}` });
  return issues;
}

/** Assemble the canonical record from the individual document JSON fixtures. */
export function buildCanonicalFromDocuments(dir: string): CanonicalLoan {
  const read = (n: string) => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
  const urla = read('01-urla-1003.json');
  const cd = read('02-closing-disclosure.json');
  const ss = read('03-settlement-statement.json');
  const dot = read('05-deed-of-trust.json');
  const wd = read('06-warranty-deed.json');
  return {
    schema: 'htm.canonical-loan/1',
    loan: {
      loan_id: urla.loan_identifier,
      product: cd.loan_terms.product,
      loan_type: urla.section_4.loan_type,
      fha_case_number: urla.section_4.agency_case_number,
      note_form: urla.note_form,
      currency: 'USD',
      base_loan_amount: cd.loan_terms.base_loan_amount,
      financed_ufmip: cd.loan_terms.financed_ufmip,
      principal_amount: cd.loan_terms.loan_amount,
      annual_interest_rate: cd.loan_terms.interest_rate,
      term_months: cd.loan_terms.loan_term_months,
      origination_date: cd.closing_information.closing_date,
      first_payment_date: cd.loan_terms.first_payment_date,
      maturity_date: cd.loan_terms.maturity_date,
      monthly_principal_and_interest: cd.projected_payments.principal_and_interest,
    },
    borrower: { name: urla.section_1.borrower_name, role: 'Borrower' },
    seller: { name: cd.transaction_information.seller },
    lender: { name: cd.transaction_information.lender, nmls_id: cd.transaction_information.lender_nmls_id },
    property: {
      address: urla.section_4.property_address,
      apn: urla.section_4.apn,
      legal_description: dot.legal_description,
      appraised_value: cd.closing_information.appraised_property_value,
      contract_sales_price: cd.closing_information.sale_price,
      ltv: cd.loan_terms.ltv,
    },
    security_instrument: {
      type: dot.instrument_type,
      lien_position: dot.lien_position,
      trustee: dot.trustee,
      recording_number: dot.recording.document_number,
      recording_date: dot.recording.recorded_date,
    },
    vesting_deed: {
      type: wd.instrument_type,
      recording_number: wd.recording.document_number,
      recording_date: wd.recording.recorded_date,
    },
    closing: {
      settlement_agent: ss.settlement_agent,
      escrow_file_number: ss.file_number,
      closing_date: cd.closing_information.closing_date,
      earnest_money_deposit: ss.summary.earnest_money_deposit,
      seller_credit: ss.summary.seller_credit,
      settlement_charges: ss.summary.settlement_charges_to_borrower,
      cash_to_close: cd.costs_at_closing.cash_to_close,
    },
    escrow_ledger: { debits: ss.debits, credits: ss.credits },
    recurring_monthly: {
      principal_and_interest: cd.projected_payments.principal_and_interest,
      fha_mip: cd.projected_payments.mortgage_insurance,
      property_tax_impound: cd.projected_payments.escrow.property_taxes,
      homeowners_insurance_impound: cd.projected_payments.escrow.homeowners_insurance,
      total_piti: cd.projected_payments.total_monthly_payment,
      hoa_dues_not_impounded: cd.projected_payments.not_in_escrow.hoa_dues,
      credit_life_insurance: cd.projected_payments.not_in_escrow.credit_life_insurance,
    },
    xrpl: { network: 'devnet' },
  };
}
