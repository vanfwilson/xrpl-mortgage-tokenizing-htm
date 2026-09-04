/**
 * OCR post-processing. Scanners commonly emit letter-spaced tokens
 * ("4 1 1 - 9 9 2 8 3 4 - 7 0 3"), stray whitespace and broken lines.
 * These helpers repair the stream and pull out the fields the ledger steps
 * need. Ported from the Python sketch in docs/source and hardened.
 */

export interface ExtractedFields {
  fha_case_number?: string;
  cash_to_close?: number;
  monthly_piti?: number;
  loan_amount?: number;
  interest_rate?: number;
  apn?: string;
  recording_number?: string;
  xrpl_addresses: string[];
}

/** Collapse single-character letter spacing and runs of whitespace. */
export function normalizeOcrText(raw: string): string {
  let t = raw.replace(/\r/g, '\n');
  // Join sequences of single chars separated by one space: "9 1 , 4 0 0 . 0 0" -> "91,400.00"
  // Only runs of 3+ single characters, and the run must end at whitespace, so
  // "1 2 3 S a n d b o x Lane" -> "123Sandbox Lane" (not "...Lane" glued on).
  t = t.replace(/(?<=^|\s)\S(?: \S){2,}(?=\s|$)/g, (m) => m.replace(/ /g, ''));
  t = t.replace(/(\d) ?([,.]) ?(\d)/g, '$1$2$3');
  t = t.replace(/(\d) ?- ?(\d)/g, '$1-$2');
  return t.replace(/\s+/g, ' ').trim();
}

const money = (label: RegExp, text: string): number | undefined => {
  const m = text.match(label);
  return m ? Number(m[1].replace(/,/g, '')) : undefined;
};

export function extractFields(raw: string): ExtractedFields {
  const t = normalizeOcrText(raw);
  const out: ExtractedFields = { xrpl_addresses: [] };
  const fha = t.match(/FHA\s?Case\s?(?:No\.?|Number|#)?:?\s?(\d{3}-\d{7}-\d{3})/i);
  if (fha) out.fha_case_number = fha[1];
  out.cash_to_close = money(/Cash\s?to\s?Close(?:\s?Required)?:?\s?\$?\s?([\d,]+\.\d{2})/i, t);
  out.monthly_piti = money(/(?:Total\s?)?(?:Monthly\s?)?(?:PITI|Estimated\s?Total\s?Monthly\s?Payment):?\s?\$?\s?([\d,]+\.\d{2})/i, t);
  out.loan_amount = money(/Loan\s?Amount:?\s?\$?\s?([\d,]+\.\d{2})/i, t);
  const rate = t.match(/Interest\s?Rate:?\s?(\d{1,2}(?:\.\d{1,3})?)\s?%/i);
  if (rate) out.interest_rate = Number(rate[1]) / 100;
  const apn = t.match(/(?:APN|Parcel\s?(?:No\.?|Number)):?\s?([A-Z]?\d{4,}-\d{3,})/i);
  if (apn) out.apn = apn[1];
  const rec = t.match(/(?:Instrument|Document|Recording)\s?(?:No\.?|Number|#):?\s?(\d{4}-\d{6,}[A-Z]?)/i);
  if (rec) out.recording_number = rec[1];
  // Classic XRPL addresses: base58 (no 0 O I l), 25-35 chars, start with r.
  out.xrpl_addresses = [...new Set(t.match(/\br[1-9A-HJ-NP-Za-km-z]{24,34}\b/g) ?? [])];
  return out;
}
