import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCanonicalFromScan, classifyPage } from '../src/ingest/from-scan.js';
import { buildCanonicalFromDocuments, validateCanonical } from '../src/ingest/canonical.js';

const pages = fs.readFileSync('tests/fixtures/stack.ocr.txt', 'utf8').split('\n\f\n');

describe('rebuild the loan from OCR of the printed package', () => {
  it('classifies each page', () => {
    const kinds = pages.map(classifyPage);
    expect(kinds.filter((k) => k === 'urla')).toHaveLength(11);
    expect(kinds.slice(11)).toEqual(['closing_disclosure', 'closing_disclosure', 'settlement_statement', 'settlement_statement', 'escrow_instructions', 'fha_amendatory', 'note', 'deed_of_trust', 'warranty_deed', 'recorder_receipt', 'statement', 'ocr_test']);
  });
  it('yields every required field and ties out', () => {
    const b = buildCanonicalFromScan(pages);
    expect(b.missing).toEqual([]);
    expect(validateCanonical(b.loan)).toEqual([]);
  });
  it('matches the fixture record on every figure the ledger uses', () => {
    const scanned = buildCanonicalFromScan(pages).loan;
    const fx = buildCanonicalFromDocuments('data/documents');
    expect(scanned.loan).toEqual(fx.loan);
    expect(scanned.servicing).toEqual(fx.servicing);
    expect(scanned.note_terms.grace_period_days).toBe(15);
    expect(scanned.note_terms.late_charge_amount).toBe(138.54);
    expect(scanned.property.apn).toBe(fx.property.apn);
    expect(scanned.property.legal_description).toBe(fx.property.legal_description);
    expect(scanned.security_instrument.recording_number).toBe(fx.security_instrument.recording_number);
    expect(scanned.vesting_deed.recording_number).toBe(fx.vesting_deed.recording_number);
    expect(scanned.closing.cash_to_close).toBe(fx.closing.cash_to_close);
    expect(scanned.borrower.name).toBe(fx.borrower.name);
  });
});
