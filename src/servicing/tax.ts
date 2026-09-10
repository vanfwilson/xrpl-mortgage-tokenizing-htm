import type { ScheduleRow } from '../domain/loan-math.js';
import { nextBusinessDay, parseDay } from './dates.js';
export interface TaxRules { taxYear: number; mipReportable: boolean; box10Enabled: boolean; federalHolidays?: readonly string[] }
/** R29 — generate traceable Form 1098 data under effective-dated rules. */
export function build1098(input: { rules: TaxRules; schedule: readonly ScheduleRow[]; periodsReceived: readonly number[]; postedInterest?: readonly { id: string; receivedOn: string; interestCents: number }[]; january1PrincipalCents: number; originationPrincipalCents?: number; acquisitionPrincipalCents?: number; originationDate: string; acquisitionDate?: string; mipCents: number; taxPaidCents: number; hazardPaidCents: number; address: string; pointsCents?: number }) {
  const year = input.rules.taxYear;
  parseDay(input.originationDate); if (input.acquisitionDate) parseDay(input.acquisitionDate);
  const acquiredThisYear = input.acquisitionDate?.startsWith(`${year}-`) === true;
  const originatedThisYear = input.originationDate.startsWith(`${year}-`);
  let box1 = input.schedule.filter(r => input.periodsReceived.includes(r.period)).reduce((a, r) => a + Math.round(r.interest * 100), 0);
  if (input.postedInterest) {
    if (new Set(input.postedInterest.map(p => p.id)).size !== input.postedInterest.length) throw new Error('duplicate interest posting');
    box1 = input.postedInterest.reduce((sum, p) => { parseDay(p.receivedOn); if (!Number.isSafeInteger(p.interestCents)) throw new RangeError('invalid posted cents'); return sum + (p.receivedOn.startsWith(`${year}-`) ? p.interestCents : 0); }, 0);
  }
  const box2 = acquiredThisYear ? input.acquisitionPrincipalCents : originatedThisYear ? input.originationPrincipalCents : input.january1PrincipalCents;
  if (box2 === undefined) throw new Error('origination/acquisition principal required for in-year event');
  const filingYear = year + 1;
  const paperDay = `${filingYear}-02-28`;
  const deadline = (day: string) => nextBusinessDay(day, input.rules.federalHolidays);
  return { year, source: input.postedInterest ? 'posted_receipts' : 'schedule_demo_only', box1InterestCents: box1, box2PrincipalCents: box2, box2Basis: acquiredThisYear ? 'acquisition' : originatedThisYear ? 'origination' : 'january_1', box3OriginationDate: input.originationDate, box4RefundCents: 0, box5MipCents: input.rules.mipReportable && input.mipCents >= 60000 ? input.mipCents : undefined, box6PointsCents: input.pointsCents ?? 0, box7SameAddress: false, box8PropertyAddress: input.address, box9PropertyCount: 1, box10OtherCents: input.rules.box10Enabled ? input.taxPaidCents + input.hazardPaidCents : undefined, box11AcquisitionDate: acquiredThisYear ? input.acquisitionDate : undefined, calendar: { borrower: deadline(`${filingYear}-01-31`), paper: deadline(paperDay), efile: deadline(`${filingYear}-03-31`) } };
}
/** R30 */
export function build1099INT(year: number, interestCents: number) { return interestCents >= 1_000 ? { required: true, year, interestCents } : { required: false, year, interestCents }; }
export const foreclosureTaxH = (foreclosure: boolean, cancelledDebt: boolean) => ({ form1099AReview: foreclosure, form1099CReview: cancelledDebt });
