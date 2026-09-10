/**
 * RS1 (roast 2026-09-10): the bank's own receipt export is the input to the three-way match, not a simulated
 * mirror. This module defines the CSV contract a subservicer's treasury system exports, parses it strictly, and
 * turns it into the `Entry[]` that `threeWayMatch` consumes.
 *
 * Contract (one header row, then one row per posting, UTF-8, LF or CRLF):
 *
 *   bank_ref,posted_on,loan_ref,direction,amount
 *
 * - bank_ref   the bank's unique posting reference; it must equal the servicing-side leg key so the three ledgers
 *              can be matched by reference (R14). Duplicates are rejected.
 * - posted_on  ISO calendar date (YYYY-MM-DD) the bank posted the entry.
 * - loan_ref   the opaque servicing loan id (never a borrower identifier). A parser can be scoped to one loan.
 * - direction  `credit` (money into the custodial account) or `debit` (money out).
 * - amount     positive decimal dollars with at most two decimals ("3365.01"). No thousands separators, no sign.
 *
 * The parser is the single place that converts bank dollars to integer cents, so a rounding bug cannot hide in
 * the reconciliation. Debits become negative cents, matching how the servicing subledger records outflows.
 */
import type { Entry } from './reconcile.js';
import type { Cents, IsoDate } from './types.js';

export const BANK_RECEIPT_COLUMNS = ['bank_ref', 'posted_on', 'loan_ref', 'direction', 'amount'] as const;
export type BankReceiptDirection = 'credit' | 'debit';

export interface BankReceiptRow {
  bank_ref: string;
  posted_on: IsoDate;
  loan_ref: string;
  direction: BankReceiptDirection;
  /** Positive integer cents as exported by the bank; sign is carried by `direction`. */
  amount_cents: Cents;
}

export interface ParsedBankReceipts {
  rows: BankReceiptRow[];
  /** Signed entries ready for `threeWayMatch({ bank: entries, ... })`. */
  entries: Entry[];
  /** Sum of signed cents; the bank-side authoritative movement for the file. */
  net_cents: Cents;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

function assertCalendarDate(s: string, line: number): asserts s is IsoDate {
  if (!DATE_RE.test(s)) throw new Error(`bank receipts line ${line}: posted_on '${s}' is not an ISO date`);
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw new Error(`bank receipts line ${line}: posted_on '${s}' is not a calendar date`);
}

/** "3365.01" -> 336501, exactly, with no floating-point step. */
export function dollarsToCents(amount: string, line = 0): Cents {
  if (!AMOUNT_RE.test(amount)) throw new Error(`bank receipts line ${line}: amount '${amount}' must be positive decimal dollars with at most two decimals`);
  const [whole, frac = ''] = amount.split('.');
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error(`bank receipts line ${line}: amount '${amount}' must be greater than zero`);
  return cents;
}

export const centsToDollars = (cents: Cents): string => `${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;

function splitCsvLine(line: string): string[] {
  // The contract has no quoted fields; a comma inside a value is a contract violation, surfaced as a column-count error.
  return line.split(',').map((s) => s.trim());
}

export interface ParseOptions {
  /** When set, every row must carry this loan_ref (a file scoped to one loan). */
  loan_ref?: string;
}

/** Parse a bank receipt export. Throws on any contract violation; a partially parsed file is never returned. */
export function parseBankReceiptCsv(text: string, opts: ParseOptions = {}): ParsedBankReceipts {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new Error('bank receipts: empty file');
  const header = splitCsvLine(lines[0]);
  if (header.join(',') !== BANK_RECEIPT_COLUMNS.join(',')) throw new Error(`bank receipts: header must be '${BANK_RECEIPT_COLUMNS.join(',')}', got '${header.join(',')}'`);
  const rows: BankReceiptRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const line = i + 1;
    const cols = splitCsvLine(lines[i]);
    if (cols.length !== BANK_RECEIPT_COLUMNS.length) throw new Error(`bank receipts line ${line}: expected ${BANK_RECEIPT_COLUMNS.length} columns, got ${cols.length}`);
    const [bank_ref, posted_on, loan_ref, direction, amount] = cols;
    if (!bank_ref) throw new Error(`bank receipts line ${line}: bank_ref is required`);
    if (seen.has(bank_ref)) throw new Error(`bank receipts line ${line}: duplicate bank_ref '${bank_ref}'`);
    seen.add(bank_ref);
    assertCalendarDate(posted_on, line);
    if (!loan_ref) throw new Error(`bank receipts line ${line}: loan_ref is required`);
    if (opts.loan_ref && loan_ref !== opts.loan_ref) throw new Error(`bank receipts line ${line}: loan_ref '${loan_ref}' is not the scoped loan '${opts.loan_ref}'`);
    if (direction !== 'credit' && direction !== 'debit') throw new Error(`bank receipts line ${line}: direction must be credit or debit, got '${direction}'`);
    rows.push({ bank_ref, posted_on, loan_ref, direction, amount_cents: dollarsToCents(amount, line) });
  }
  const entries: Entry[] = rows.map((r) => ({ ref: r.bank_ref, cents: r.direction === 'credit' ? r.amount_cents : -r.amount_cents }));
  return { rows, entries, net_cents: entries.reduce((a, e) => a + e.cents, 0) };
}

/** Serialise rows in the contract format (used by the loan-year run to emit the file it then reconciles against). */
export function formatBankReceiptCsv(rows: readonly BankReceiptRow[]): string {
  const out = [BANK_RECEIPT_COLUMNS.join(',')];
  for (const r of rows) {
    for (const v of [r.bank_ref, r.loan_ref]) if (/[,\r\n]/.test(v)) throw new Error(`bank receipts: '${v}' contains a comma or line break, which the contract forbids`);
    if (!Number.isInteger(r.amount_cents) || r.amount_cents <= 0) throw new RangeError(`bank receipts: amount_cents for '${r.bank_ref}' must be a positive integer`);
    assertCalendarDate(r.posted_on, out.length + 1);
    out.push([r.bank_ref, r.posted_on, r.loan_ref, r.direction, centsToDollars(r.amount_cents)].join(','));
  }
  return out.join('\n') + '\n';
}

/** Convenience for producers that already hold signed entries: sign decides direction. */
export function rowsFromEntries(entries: readonly Entry[], loan_ref: string, posted_on: IsoDate | ((ref: string) => IsoDate)): BankReceiptRow[] {
  return entries.map((e) => ({ bank_ref: e.ref, posted_on: typeof posted_on === 'function' ? posted_on(e.ref) : posted_on, loan_ref, direction: e.cents >= 0 ? 'credit' : 'debit', amount_cents: Math.abs(e.cents) }));
}
