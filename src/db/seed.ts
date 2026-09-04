/**
 * Emits idempotent SQL seeding htm_mortgages with the sample loan derived from the
 * four closing documents in data/documents. Run: npm run db:seed | scripts/db-apply.sh -
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { sha256Hex } from '../domain/hash.js';
import { buildCanonicalFromDocuments, validateCanonical } from '../ingest/canonical.js';
import { ADA_COUNTY_TAX_INSTALLMENTS } from '../servicing/impound-scheduler.js';

export const HTM_COMPANY_ID = '85020860-28c1-4b05-ac38-8ede57a7e797';
export const SAMPLE_LOAN_ID = '9d1f4c3e-2026-4b1a-8e7f-000000088492';

const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};
const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;

const DOCS: Array<[string, string, number]> = [
  ['01-closing-disclosure.json', 'CLOSING_DISCLOSURE', 1],
  ['02-promissory-note-3200.json', 'PROMISSORY_NOTE', 2],
  ['03-deed-of-trust-3013.json', 'DEED_OF_TRUST', 3],
  ['04-warranty-deed-recorded.json', 'WARRANTY_DEED', 4],
];

export function seedSql(): string {
  const loan = buildCanonicalFromDocuments(config.documentsDir);
  const issues = validateCanonical(loan);
  if (issues.length) throw new Error(JSON.stringify(issues));
  const parties = JSON.parse(fs.readFileSync(path.join('data', 'servicing-parties.json'), 'utf8'));
  const C = q(HTM_COMPANY_ID), L = q(SAMPLE_LOAN_ID);
  const out: string[] = ['begin;', 'set search_path = htm_mortgages, public;', `delete from loans where loan_id = ${L};`];
  out.push(`insert into loans (loan_id, company_id, loan_number, loan_type, agency_case_number, product, purpose, note_form,
      base_loan_amount, financed_ufmip, note_amount, interest_rate, term_months, monthly_pi,
      first_payment_date, maturity_date, closing_date, disbursement_date, status, synthetic)
     values (${L}, ${C}, ${q(loan.loan.loan_id)}, ${q(loan.loan.loan_type)}, ${q(loan.loan.fha_case_number)}, ${q(loan.loan.product)}, ${q(loan.loan.purpose)}, ${q(loan.loan.note_form)},
      ${loan.loan.base_loan_amount}, ${loan.loan.financed_ufmip}, ${loan.loan.principal_amount}, ${loan.loan.annual_interest_rate}, ${loan.loan.term_months}, ${loan.loan.monthly_principal_and_interest},
      ${q(loan.loan.first_payment_date)}, ${q(loan.loan.maturity_date)}, ${q(loan.closing.closing_date)}, ${q(loan.closing.disbursement_date)}, 'servicing', true);`);
  const party = (role: string, name: string, extra: Record<string, unknown> = {}) =>
    out.push(`insert into parties (company_id, loan_id, role, name, nmls_id, mailing_address, details) values (${C}, ${L}, ${q(role)}, ${q(name)}, ${q(extra.nmls ?? null)}, ${q(extra.address ?? null)}, ${j(extra.details ?? {})});`);
  party('borrower', loan.borrower.name, { address: loan.borrower.mailing_address });
  party('seller', loan.seller.name);
  party('lender', loan.lender.name, { nmls: loan.lender.nmls_id });
  party('servicer', loan.servicer.name, { details: { place_of_payment: loan.note_terms.place_of_payment } });
  party('settlement_agent', loan.closing.settlement_agent, { details: { file_number: loan.closing.escrow_file_number } });
  party('trustee', loan.security_instrument.trustee);
  const p = loan.property;
  out.push(`insert into properties (company_id, loan_id, street, city, state, zip, county, apn, legal_description, contract_sales_price, appraised_value, ltv)
     values (${C}, ${L}, ${q(p.address.street)}, ${q(p.address.city)}, ${q(p.address.state)}, ${q(p.address.zip)}, ${q(p.address.county)}, ${q(p.apn)}, ${q(p.legal_description)}, ${p.contract_sales_price}, ${p.appraised_value}, ${p.ltv});`);
  for (const [file, type, order] of DOCS) {
    const raw = fs.readFileSync(path.join(config.documentsDir, file), 'utf8');
    const doc = JSON.parse(raw) as Record<string, any>;
    const rec = doc.recording ?? null;
    out.push(`insert into loan_documents (company_id, loan_id, doc_type, form_reference, sort_order, sections, content_sha256, recorded_document_number, recorded_at)
       values (${C}, ${L}, ${q(type)}, ${q(doc.form_reference ?? doc.document)}, ${order}, ${j(doc)}, ${q(sha256Hex(raw))}, ${q(rec?.document_number ?? null)}, ${q(rec ? `${rec.recorded_date}T${rec.recorded_time ?? '00:00:00'}-06:00` : null)});`);
  }
  // Closing-cost lines from the CD (the ALTA statement is not part of the servicing package).
  const c = loan.closing;
  const line = (entry: string, code: string, desc: string, amt: number) => out.push(`insert into settlement_lines (company_id, loan_id, side, entry, code, description, amount) values (${C}, ${L}, 'borrower', ${q(entry)}, ${q(code)}, ${q(desc)}, ${amt});`);
  line('debit', 'CD-K', 'Sale price of property', p.contract_sales_price); line('debit', 'CD-J', 'Total closing costs', c.closing_costs);
  line('credit', 'CD-L1', 'Deposit', c.deposit); line('credit', 'CD-L2', 'Loan amount', loan.loan.principal_amount); line('credit', 'CD-L5', 'Seller credits', c.seller_credits); line('credit', 'CD-CTC', 'Cash to close from borrower', c.cash_to_close);
  const s = loan.servicing;
  const rec = (kind: string, amt: number, note?: string) => out.push(`insert into recurring_obligations (company_id, loan_id, kind, monthly_amount, impounded, note) values (${C}, ${L}, ${q(kind)}, ${amt}, true, ${q(note ?? null)});`);
  rec('principal_interest', s.principal_and_interest, 'Form 3200 s.3; CD p.1 Loan Terms');
  rec('property_tax', s.property_tax_impound, 'CD p.1 Estimated Taxes, Insurance & Assessments');
  rec('homeowners_insurance', s.insurance_detail.hazard_homeowners, 'CD p.1 Estimated Taxes, Insurance & Assessments');
  rec('mortgage_insurance', s.insurance_detail.fha_mip, 'CD p.1 Projected Payments (FHA MIP), routed with insurance impound');
  // Impound accounts + statutory disbursement calendar for the first loan year.
  out.push(`insert into impound_accounts (impound_id, company_id, loan_id, kind, monthly_amount, annual_total, payee_name, payee_reference, balance) values
    ('9d1f4c3e-2026-4b1a-8e7f-00000000a7a1', ${C}, ${L}, 'tax', ${s.property_tax_impound}, ${parties.county_treasurer.annual_tax}, ${q(parties.county_treasurer.name)}, ${q('APN ' + p.apn)}, ${c.initial_escrow_deposit * 0.6}),
    ('9d1f4c3e-2026-4b1a-8e7f-00000000a7a2', ${C}, ${L}, 'insurance', ${s.insurance_impound}, ${parties.hazard_insurance_carrier.annual_premium + parties.fha_mip.annual}, ${q(parties.hazard_insurance_carrier.name + ' / HUD FHA MIP')}, ${q('Policy ' + parties.hazard_insurance_carrier.policy_number)}, ${c.initial_escrow_deposit * 0.4});`);
  const y0 = Number(loan.loan.first_payment_date.slice(0, 4));
  for (const inst of ADA_COUNTY_TAX_INSTALLMENTS) {
    for (const y of [y0, y0 + 1]) {
      const due = `${y}-${inst.due}`;
      if (due < loan.loan.first_payment_date) continue;
      out.push(`insert into impound_disbursements (company_id, impound_id, due_date, description, amount) values (${C}, '9d1f4c3e-2026-4b1a-8e7f-00000000a7a1', ${q(due)}, ${q(inst.description)}, ${parties.county_treasurer.annual_tax / 2});`);
    }
  }
  out.push(`insert into impound_disbursements (company_id, impound_id, due_date, description, amount) values (${C}, '9d1f4c3e-2026-4b1a-8e7f-00000000a7a2', ${q(`${y0 + 1}-${parties.hazard_insurance_carrier.renewal}`)}, 'Hazard policy renewal + FHA MIP annual remittance', ${parties.hazard_insurance_carrier.annual_premium + parties.fha_mip.annual});`);
  // Full amortization schedule: 360 sweeps split three ways. Period 1 received (evidence: scanned statement).
  const first = new Date(loan.loan.first_payment_date + 'T00:00:00Z');
  const r = loan.loan.annual_interest_rate / 12;
  let bal = loan.loan.principal_amount;
  for (let n = 1; n <= loan.loan.term_months; n++) {
    const due = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n - 1, loan.note_terms.payment_due_day_of_month)).toISOString().slice(0, 10);
    const interest = Math.round(bal * r * 100) / 100;
    let principal = Math.round((s.principal_and_interest - interest) * 100) / 100;
    if (n === loan.loan.term_months) principal = bal;
    bal = Math.round((bal - principal) * 100) / 100;
    const status = n === 1 ? 'received' : 'scheduled';
    out.push(`insert into servicing_payments (company_id, loan_id, period_no, due_date, amount_due, principal_part, interest_part, pi_part, tax_part, insurance_part, escrow_part, status, received_at, amount_received)
       values (${C}, ${L}, ${n}, ${q(due)}, ${s.monthly_total_sweep}, ${principal}, ${interest}, ${s.principal_and_interest}, ${s.property_tax_impound}, ${s.insurance_impound}, ${s.property_tax_impound + s.insurance_impound}, ${q(status)}, ${n === 1 ? q(due + 'T17:05:00Z') : 'null'}, ${n === 1 ? s.monthly_total_sweep : 'null'});`);
  }
  out.push('commit;');
  return out.join('\n');
}

if (process.argv[1]?.endsWith('seed.ts')) process.stdout.write(seedSql() + '\n');
