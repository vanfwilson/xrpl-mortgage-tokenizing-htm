import type { CanonicalLoan } from '../ingest/canonical.js';
import type { ExtractedFields } from '../ingest/normalize.js';
import { calculateAutomatedPaymentSplit, scannedCdFromLoan } from '../servicing/split.js';

export interface FieldMatch { field: string; expected: unknown; scanned: unknown; match: boolean }

/** Compare OCR-extracted fields with the system-of-record loan. Money within $0.01, rates within 0.0001. */
export function compareToLoan(f: ExtractedFields, loan: CanonicalLoan): FieldMatch[] {
  const rows: Array<[string, unknown, unknown]> = [
    ['fha_case_number', loan.loan.fha_case_number, f.fha_case_number],
    ['loan_amount', loan.loan.principal_amount, f.loan_amount],
    ['interest_rate', loan.loan.annual_interest_rate, f.interest_rate],
    ['cash_to_close', loan.closing.cash_to_close, f.cash_to_close],
    ['monthly_piti', loan.servicing.monthly_total_sweep, f.monthly_piti],
    ['apn', loan.property.apn, f.apn],
    ['recording_number', loan.security_instrument.recording_number, f.recording_number],
  ];
  return rows.map(([field, expected, scanned]) => {
    let match = false;
    if (typeof expected === 'number' && typeof scanned === 'number') {
      match = Math.abs(expected - scanned) <= (field === 'interest_rate' ? 0.0001 : 0.011);
    } else if (expected !== undefined && scanned !== undefined) {
      match = String(expected).toUpperCase() === String(scanned).toUpperCase();
    }
    return { field, expected, scanned, match };
  });
}

export interface ServicingStatementFields {
  loan_number?: string;
  period_no?: number;
  due_date?: string;
  amount_due?: number;
  amount_received?: number;
  received_date?: string;
}

/** Fields specific to the monthly servicing statement / payment coupon. */
export function extractServicingStatement(normalizedText: string): ServicingStatementFields {
  const t = normalizedText;
  const out: ServicingStatementFields = {};
  const ln = t.match(/Loan\s?(?:No\.?|Number|#):?\s?([A-Z]{2,6}-\d{4}-\d{4,6}[A-Z]?)/i);
  if (ln) out.loan_number = ln[1].toUpperCase();
  const per = t.match(/(?:Payment|Period|Installment)\s?(?:No\.?|Number|#)?:?\s?(\d{1,3})\s?(?:of|\/)\s?\d{2,3}/i);
  if (per) out.period_no = Number(per[1]);
  const due = t.match(/(?:Payment\s?)?Due\s?Date:?\s?(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
  if (due) out.due_date = toIso(due[1]);
  const amt = t.match(/(?:Total\s?)?Amount\s?Due:?\s?\$?\s?([\d,]+\.\d{2})/i);
  if (amt) out.amount_due = Number(amt[1].replace(/,/g, ''));
  const rcv = t.match(/(?:Amount\s?)?(?:Received|Paid):?\s?\$?\s?([\d,]+\.\d{2})/i);
  if (rcv) out.amount_received = Number(rcv[1].replace(/,/g, ''));
  const rd = t.match(/(?:Received|Posted|Paid)\s?(?:on|Date):?\s?(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
  if (rd) out.received_date = toIso(rd[1]);
  return out;
}

function toIso(d: string): string {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : d;
}

/**
 * Build XLS-66 LoanPay inputs from a verified servicing statement. The on-ledger
 * periodic amount comes from the Loan ledger entry at submit time; here we return
 * what the memo must carry and the sanity gates that must pass first.
 */
export function loanPayInputs(s: ServicingStatementFields, loan: CanonicalLoan) {
  const gates = {
    loan_number_matches: s.loan_number === loan.loan.loan_id,
    amount_due_matches_piti: s.amount_due !== undefined && Math.abs(s.amount_due - loan.servicing.monthly_total_sweep) <= 0.011,
    received_covers_due: s.amount_received !== undefined && s.amount_due !== undefined && s.amount_received + 0.001 >= s.amount_due,
    has_period: typeof s.period_no === 'number',
  };
  const ok = Object.values(gates).every(Boolean);
  return {
    ok,
    gates,
    memo: ok
      ? {
          loan_id: loan.loan.loan_id,
          period: s.period_no,
          due: s.due_date,
          received: s.received_date,
          split: calculateAutomatedPaymentSplit(scannedCdFromLoan(loan)),
          sweep_usd: loan.servicing.monthly_total_sweep,
        }
      : null,
  };
}
