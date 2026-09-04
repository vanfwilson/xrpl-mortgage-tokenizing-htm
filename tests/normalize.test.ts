import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractFields, normalizeOcrText } from '../src/ingest/normalize.js';

describe('OCR normalization', () => {
  it('repairs letter-spaced numbers without gluing neighbouring words', () => {
    expect(normalizeOcrText('Cash to Close:  $ 9 1 , 4 0 0 . 0 0')).toBe('Cash to Close: $91,400.00');
    expect(normalizeOcrText('1 2 3 S a n d b o x Lane')).toBe('123Sandbox Lane');
    expect(normalizeOcrText('FHA Case No.  4 1 1 - 9 9 2 8 3 4 0 - 7 0 3')).toBe('FHA Case No. 411-9928340-703');
  });
  it('extracts every ledger-relevant field from the noisy sample page', () => {
    const f = extractFields(fs.readFileSync('data/ocr-samples/noisy-scan.txt', 'utf8'));
    expect(f).toMatchObject({
      fha_case_number: '411-9928340-703',
      cash_to_close: 91_400,
      monthly_piti: 3368.23,
      loan_amount: 450_000,
      interest_rate: 0.0625,
      apn: 'R993821-0014',
      recording_number: '2026-0099483A',
    });
    expect(f.xrpl_addresses).toEqual(['rNHmwCAkNAfSUtDiHyTL21ifrU1BSBftsi']);
  });
  it('ignores look-alike strings that are not XRPL addresses', () => {
    expect(extractFields('rate r0OIl is not an address, nor is rShort').xrpl_addresses).toEqual([]);
  });
});
