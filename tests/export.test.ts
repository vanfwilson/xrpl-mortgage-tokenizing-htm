import { describe, expect, it } from 'vitest';
import { buildCanonicalFromDocuments } from '../src/ingest/canonical.js';
import { toMismoSubsetXml } from '../src/export/mismo.js';
import { toXrplPayloads } from '../src/export/xrpl-payload.js';
import { extractServicingStatement, loanPayInputs, compareToLoan } from '../src/scan/compare.js';
import { extractFields, normalizeOcrText } from '../src/ingest/normalize.js';

const loan = buildCanonicalFromDocuments('data/documents');

describe('exports', () => {
  it('MISMO subset carries the core ULAD data points', () => {
    const xml = toMismoSubsetXml(loan);
    expect(xml).toContain('<NoteAmount>450000.00</NoteAmount>');
    expect(xml).toContain('<NoteRatePercent>6.250</NoteRatePercent>');
    expect(xml).toContain('<MortgageType>FHA</MortgageType>');
    expect(xml).toContain('<AgencyCaseIdentifier>411-9928340-703</AgencyCaseIdentifier>');
    expect(xml).toContain('<ParcelIdentifier>R993821-0014</ParcelIdentifier>');
    expect(xml).toContain('not schema-validated');
  });
  it('XRPL payloads use ledger units', () => {
    const p = toXrplPayloads(loan, 'f'.repeat(64));
    expect(p.MPTokenIssuanceCreate.MaximumAmount).toBe('45000000');
    expect(p.LoanSet.InterestRate).toBe(6250);
    expect(p.LoanSet.PrincipalRequested).toBe('45000000'); // 45 XRP in drops
    expect(p.LoanSet.PaymentTotal).toBe(360);
    expect(p.sweep_split_template.legs.map((l) => l.usd)).toEqual([2770.73, 285, 312.5]);
  });
});

describe('scan-back', () => {
  const statement = `HIGH TECH MORTGAGE  Monthly Mortgage Statement
Loan No. MORT-2026-88492X   Payment 1 of 360   Payment Due Date: 11/01/2026
Total Amount Due: $3,368.23   Amount Received: $3,368.23  Received on 11/01/2026`;
  it('reads a servicing statement and clears the LoanPay gates', () => {
    const s = extractServicingStatement(normalizeOcrText(statement));
    expect(s).toMatchObject({ loan_number: 'MORT-2026-88492X', period_no: 1, due_date: '2026-11-01', amount_due: 3368.23, amount_received: 3368.23 });
    const pay = loanPayInputs(s, loan);
    expect(pay.ok).toBe(true);
    expect(pay.memo?.sweep_usd).toBe(3368.23);
    expect(pay.memo?.split).toEqual({ lender_p_i_vault: 2770.73, tax_impound_vault: 285, insurance_impound_vault: 312.5 });
  });
  it('blocks LoanPay when the received amount is short', () => {
    const s = extractServicingStatement(normalizeOcrText(statement.replace('Received: $3,368.23', 'Received: $3,000.00')));
    expect(loanPayInputs(s, loan).ok).toBe(false);
  });
  it('compares extracted fields against the loan of record', () => {
    const f = extractFields('Loan Amount: $450,000.00 Interest Rate: 6.25% Cash to Close: $91,400.00 APN: R993821-0014');
    const m = compareToLoan(f, loan);
    expect(m.find((x) => x.field === 'loan_amount')?.match).toBe(true);
    expect(m.find((x) => x.field === 'fha_case_number')?.match).toBe(false);
  });
});
