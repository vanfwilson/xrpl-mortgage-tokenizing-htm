import { describe, expect, it } from 'vitest';
import { BANK_RECEIPT_COLUMNS, centsToDollars, dollarsToCents, formatBankReceiptCsv, parseBankReceiptCsv, rowsFromEntries } from '../../src/servicing/bank-receipts.js';
import { assertReconciled, threeWayMatch } from '../../src/servicing/reconcile.js';

const HEADER = BANK_RECEIPT_COLUMNS.join(',');
const good = [
  HEADER,
  'run:2026-11:receipt,2026-11-01,HTM-abc,credit,3365.01',
  'run:2026-11:pi,2026-11-01,HTM-abc,debit,2770.73',
  'run:2026-11:tax,2026-11-01,HTM-abc,debit,285.00',
].join('\r\n') + '\r\n';

describe('RS1 bank receipt file (T13)', () => {
  it('T13_bank_receipt_file_round_trip: parse, exact cents, serialise back byte for byte', () => {
    const p = parseBankReceiptCsv(good, { loan_ref: 'HTM-abc' });
    expect(p.rows).toHaveLength(3);
    expect(p.entries).toEqual([
      { ref: 'run:2026-11:receipt', cents: 336_501 },
      { ref: 'run:2026-11:pi', cents: -277_073 },
      { ref: 'run:2026-11:tax', cents: -28_500 },
    ]);
    expect(p.net_cents).toBe(336_501 - 277_073 - 28_500);
    expect(formatBankReceiptCsv(p.rows)).toBe(good.replace(/\r\n/g, '\n'));
  });

  it('T13_bank_receipt_exact_cents: dollars to cents never passes through floating point', () => {
    expect(dollarsToCents('3365.01')).toBe(336_501);
    expect(dollarsToCents('0.1')).toBe(10);
    expect(dollarsToCents('1')).toBe(100);
    expect(dollarsToCents('19.99')).toBe(1_999);
    expect(centsToDollars(1_999)).toBe('19.99');
    expect(centsToDollars(-5)).toBe('0.05');
    for (const bad of ['3,365.01', '-1.00', '1.234', '$5', '', '1e3']) expect(() => dollarsToCents(bad)).toThrow(/amount/);
    expect(() => dollarsToCents('0.00')).toThrow(/greater than zero/);
  });

  it('T13_bank_receipt_contract_violations: header, columns, duplicates, dates, direction, loan scope', () => {
    expect(() => parseBankReceiptCsv('')).toThrow(/empty/);
    expect(() => parseBankReceiptCsv('ref,date,loan,dir,amt\n')).toThrow(/header/);
    expect(() => parseBankReceiptCsv(`${HEADER}\na,2026-11-01,L,credit\n`)).toThrow(/columns/);
    expect(() => parseBankReceiptCsv(`${HEADER}\na,2026-11-01,L,credit,1.00\na,2026-11-02,L,credit,1.00\n`)).toThrow(/duplicate bank_ref 'a'/);
    expect(() => parseBankReceiptCsv(`${HEADER}\na,2026-02-30,L,credit,1.00\n`)).toThrow(/calendar date/);
    expect(() => parseBankReceiptCsv(`${HEADER}\na,11/01/2026,L,credit,1.00\n`)).toThrow(/ISO date/);
    expect(() => parseBankReceiptCsv(`${HEADER}\na,2026-11-01,L,withdrawal,1.00\n`)).toThrow(/direction/);
    expect(() => parseBankReceiptCsv(`${HEADER}\na,2026-11-01,OTHER,credit,1.00\n`, { loan_ref: 'L' })).toThrow(/scoped loan/);
    expect(() => parseBankReceiptCsv(`${HEADER}\n,2026-11-01,L,credit,1.00\n`)).toThrow(/bank_ref is required/);
    expect(() => formatBankReceiptCsv([{ bank_ref: 'a,b', posted_on: '2026-11-01', loan_ref: 'L', direction: 'credit', amount_cents: 1 }])).toThrow(/comma/);
    expect(() => formatBankReceiptCsv([{ bank_ref: 'a', posted_on: '2026-11-01', loan_ref: 'L', direction: 'credit', amount_cents: 0 }])).toThrow(/positive integer/);
    expect(() => formatBankReceiptCsv([{ bank_ref: 'a', posted_on: '2026-13-01', loan_ref: 'L', direction: 'credit', amount_cents: 1 }])).toThrow(/calendar date/);
  });

  it('T13_bank_receipt_feeds_three_way_match: the parsed file is the bank side of R14', () => {
    const sub = [{ ref: 'run:2026-11:receipt', cents: 336_501 }, { ref: 'run:2026-11:pi', cents: -277_073 }, { ref: 'run:2026-11:tax', cents: -28_500 }];
    const file = formatBankReceiptCsv(rowsFromEntries(sub, 'HTM-abc', '2026-11-01'));
    const bank = parseBankReceiptCsv(file, { loan_ref: 'HTM-abc' }).entries;
    const r = threeWayMatch({ bank, subledger: sub, ledger: sub });
    expect(r.reconciled).toBe(true);
    expect(() => assertReconciled(r)).not.toThrow();
    // A one-cent difference in the bank file is a reconciliation break, never silently absorbed.
    const off = parseBankReceiptCsv(file.replace('3365.01', '3365.02'), { loan_ref: 'HTM-abc' }).entries;
    expect(threeWayMatch({ bank: off, subledger: sub, ledger: sub }).unmatched).toEqual([{ ref: 'run:2026-11:receipt', bank: 336_502, subledger: 336_501, ledger: 336_501 }]);
  });
});
