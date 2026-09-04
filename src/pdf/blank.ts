import type { CanonicalLoan } from '../ingest/canonical.js';
import { BLANK } from './common.js';

/** Deep-map any fixture: strings -> blank line, numbers -> NaN (renders as a blank), booleans kept. */
export function blankOf<T>(v: T): T {
  if (typeof v === 'string') return (/^\d{4}-\d{2}-\d{2}$/.test(v) ? '____-__-__' : BLANK) as unknown as T;
  if (typeof v === 'number') return NaN as unknown as T;
  if (Array.isArray(v)) return v.map(blankOf) as unknown as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, blankOf(x)])) as T;
  return v;
}

/** A CanonicalLoan whose every value is a blank, for printing unfilled templates. Structural fields kept so layouts render. */
export function blankLoan(from: CanonicalLoan): CanonicalLoan {
  const b = blankOf(from);
  b.loan.loan_type = from.loan.loan_type; b.loan.currency = 'USD'; b.loan.term_months = NaN;
  b.security_instrument.type = from.security_instrument.type; b.security_instrument.form = from.security_instrument.form; b.security_instrument.lien_position = NaN;
  b.vesting_deed.type = from.vesting_deed.type; b.property.address.state = 'ID'; b.property.address.county = 'Ada';
  b.xrpl = from.xrpl;
  return b;
}
