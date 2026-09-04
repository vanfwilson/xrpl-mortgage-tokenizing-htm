import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCanonicalFromDocuments } from '../src/ingest/canonical.js';

/** Every supporting form must describe the same people, property, price and loan as the four tokenization documents. */
const loan = buildCanonicalFromDocuments('data/documents');
const sup = (n: string) => JSON.parse(fs.readFileSync(`data/supporting/${n}`, 'utf8'));
const addr = `${loan.property.address.street}, ${loan.property.address.city}, ${loan.property.address.state} ${loan.property.address.zip}`;

describe('one homeowner, one property, one loan across all forms', () => {
  it('URLA 1003 matches', () => {
    const u = sup('urla-1003.json');
    expect(u.section_1.borrower_name).toBe(loan.borrower.name);
    expect(u.loan_identifier).toBe(loan.loan.loan_id);
    expect(u.section_4.loan_amount).toBe(loan.loan.principal_amount);
    expect(u.section_4.interest_rate).toBe(loan.loan.annual_interest_rate);
    expect(u.section_4.term_months).toBe(loan.loan.term_months);
    expect(u.section_4.agency_case_number).toBe(loan.loan.fha_case_number);
    expect(u.section_4.property_address).toEqual(loan.property.address);
    expect(u.section_4.apn).toBe(loan.property.apn);
    expect(u.section_4.property_value).toBe(loan.property.contract_sales_price);
    expect(u.signatures.loan_originator).toBe(loan.lender.name);
  });
  it('ALTA settlement statement matches', () => {
    const s = sup('settlement-statement.json');
    expect(s.settlement_agent).toBe(loan.closing.settlement_agent);
    expect(s.file_number).toBe(loan.closing.escrow_file_number);
    expect(s.settlement_date).toBe(loan.closing.closing_date);
    expect(s.summary.contract_sales_price).toBe(loan.property.contract_sales_price);
    expect(s.summary.new_loan_principal).toBe(loan.loan.principal_amount);
    expect(s.summary.earnest_money_deposit).toBe(loan.closing.deposit);
    expect(s.summary.seller_credit).toBe(loan.closing.seller_credits);
    expect(s.summary.settlement_charges_to_borrower).toBe(loan.closing.closing_costs);
    expect(s.summary.cash_from_borrower).toBe(loan.closing.cash_to_close);
    const debits = s.debits.reduce((a: number, r: any) => a + r.amount, 0), credits = s.credits.reduce((a: number, r: any) => a + r.amount, 0);
    expect(debits).toBeCloseTo(credits, 2);
  });
  it('FHA amendatory clause matches', () => {
    const f = sup('fha-amendatory-clause.json');
    expect(f.fha_case_number).toBe(loan.loan.fha_case_number);
    expect(f.property).toBe(addr);
    expect(f.contract_sales_price).toBe(loan.property.contract_sales_price);
    expect(f.parties.buyer).toBe(loan.borrower.name);
    expect(f.parties.seller).toBe(loan.seller.name);
  });
  it('note, deed of trust and deed agree with each other', () => {
    const note = JSON.parse(fs.readFileSync('data/documents/02-promissory-note-3200.json', 'utf8'));
    const dot = JSON.parse(fs.readFileSync('data/documents/03-deed-of-trust-3013.json', 'utf8'));
    const wd = JSON.parse(fs.readFileSync('data/documents/04-warranty-deed-recorded.json', 'utf8'));
    expect(note.section_1_borrowers_promise_to_pay.principal).toBe(dot.secured_note_amount);
    expect(note.property_address).toBe(dot.property_address);
    expect(dot.property_address).toBe(wd.property_address);
    expect(dot.apn).toBe(wd.apn);
    expect(dot.legal_description).toBe(wd.legal_description);
    expect(dot.grantor_borrower).toBe(loan.borrower.name);
    expect(wd.grantee.startsWith(loan.borrower.name)).toBe(true);
    expect(wd.grantor).toBe(loan.seller.name);
    expect(wd.consideration).toBe(loan.property.contract_sales_price);
    expect(dot.recording.recorded_date).toBe(wd.recording.recorded_date);
  });
});
