import { nextBusinessDay } from './calendar.js';
import type { Cents, IsoDate, LoanTerms } from './types.js';

/**
 * R29 IRS Form 1098 (Mortgage Interest Statement) built from receipt-dated applications and the schedule.
 * The servicer that first receives the interest files. $600 threshold per mortgage. Effective-dated rules
 * decide Box 5 reportability; Box 10 is optional; Box 11 only for an in-year acquisition.
 * R30 Form 1099-INT for California escrow interest of $10 or more; 1099-A/C are handoff flags only.
 */
export interface Form1098Input {
  year: number;
  terms: LoanTerms;
  /** Interest actually received and applied in the calendar year, by effective date (receipt date). */
  interest_received_cents: Cents;
  /** Principal outstanding as of January 1 of the year (or origination balance if originated in-year). */
  principal_jan1_cents: Cents;
  refund_of_prior_year_interest_cents: Cents;
  mip_received_cents: Cents;
  points_paid_cents: Cents;
  taxes_paid_from_escrow_cents: Cents;
  insurance_paid_from_escrow_cents: Cents;
  acquisition_date?: IsoDate;
  filer: { name: string; is_first_recipient: boolean };
  /** Effective-dated statutory rule: is qualified MIP reportable in Box 5 for this tax year? */
  mip_reportable: (year: number) => boolean;
  property_address_same_as_mailing: boolean;
  properties_secured: number;
}

export interface Form1098 {
  year: number;
  required: boolean;
  filer_of_record: string;
  boxes: { 1: Cents; 2: Cents; 3: IsoDate; 4: Cents; 5: Cents; 6: Cents; 7: boolean; 8: 'off-ledger property record'; 9: number; 10: Cents | null; 11: IsoDate | null };
  calendar: FilingCalendar;
  cite: string;
}

export interface FilingCalendar { tax_year: number; furnish_to_borrower_by: IsoDate; paper_file_by: IsoDate; efile_by: IsoDate; cite: string }
export function filingCalendar(taxYear: number): FilingCalendar {
  const y = taxYear + 1;
  const feb = new Date(Date.UTC(y, 2, 0)).getUTCDate(); // 28 or 29
  return {
    tax_year: taxYear,
    furnish_to_borrower_by: nextBusinessDay(`${y}-01-31`),
    paper_file_by: nextBusinessDay(`${y}-02-${feb}`),
    efile_by: nextBusinessDay(`${y}-03-31`),
    cite: 'IRS General Instructions for Certain Information Returns: recipient copy Jan 31, paper Feb 28, e-file Mar 31, next business day if on a weekend or legal holiday (verify each filing year)',
  };
}

export function build1098(i: Form1098Input): Form1098 {
  if (!i.filer.is_first_recipient) throw new Error('R29: only the servicer that first receives the interest files Form 1098 (IRS Instructions for Form 1098, Who Must File)');
  const box5 = i.mip_reportable(i.year) ? i.mip_received_cents : 0;
  const required = i.interest_received_cents >= 60_000 || box5 >= 60_000;
  return {
    year: i.year,
    required,
    filer_of_record: i.filer.name,
    boxes: {
      1: i.interest_received_cents,
      2: i.principal_jan1_cents,
      3: i.terms.origination_date,
      4: i.refund_of_prior_year_interest_cents,
      5: box5,
      6: i.points_paid_cents,
      7: i.property_address_same_as_mailing,
      8: 'off-ledger property record',
      9: i.properties_secured,
      10: i.taxes_paid_from_escrow_cents + i.insurance_paid_from_escrow_cents > 0 ? i.taxes_paid_from_escrow_cents + i.insurance_paid_from_escrow_cents : null,
      11: i.acquisition_date && i.acquisition_date.startsWith(String(i.year)) ? i.acquisition_date : null,
    },
    calendar: filingCalendar(i.year),
    cite: 'IRS Instructions for Form 1098 (2026 revision): $600 threshold per mortgage; Box 2 principal as of Jan 1; Box 10 optional; Box 11 acquisition in the year',
  };
}

export interface Form1099INT { year: number; required: boolean; interest_cents: Cents; payer: string; cite: string }
export function build1099INT(year: number, interestCents: Cents, payer: string): Form1099INT {
  return { year, required: interestCents >= 1_000, interest_cents: interestCents, payer, cite: 'IRS Instructions for Form 1099-INT: $10 threshold; California impound interest under Civ. Code 2954.8' };
}

export type TaxHandoff = { form: '1099-A'; event: 'acquisition_or_abandonment' } | { form: '1099-C'; event: 'cancellation_of_debt' };
export const taxHandoffs = (events: Array<'foreclosure' | 'deed_in_lieu' | 'cancellation'>): TaxHandoff[] =>
  events.map((e) => (e === 'cancellation' ? { form: '1099-C', event: 'cancellation_of_debt' } : { form: '1099-A', event: 'acquisition_or_abandonment' }));
