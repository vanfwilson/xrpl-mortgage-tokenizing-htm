import type { IsoDate, UsState } from './types.js';

/**
 * Statutory calendars and date arithmetic (R25). Idaho Code 63-903: full or first half due December 20,
 * second half by June 20. California Rev. & Tax. Code 2617/2618: first installment delinquent after
 * December 10, second after April 10 (kept as the disbursement deadlines for the CA profile).
 */
export interface Installment { due: string; description: string } // "MM-DD"

export const TAX_CALENDAR: Record<UsState, Installment[]> = {
  ID: [
    { due: '12-20', description: 'First half property tax (Idaho Code 63-903)' },
    { due: '06-20', description: 'Second half property tax (Idaho Code 63-903)' },
  ],
  CA: [
    { due: '12-10', description: 'First installment property tax (Cal. Rev. & Tax. Code 2617)' },
    { due: '04-10', description: 'Second installment property tax (Cal. Rev. & Tax. Code 2618)' },
  ],
};

/** Escrow-interest rule per state. Idaho is UNVERIFIED and blocks the production profile until counsel signs (R25). */
export const ESCROW_INTEREST: Record<UsState, { annual_rate: number; status: 'statutory' | 'unverified' | 'none'; cite: string }> = {
  CA: { annual_rate: 0.02, status: 'statutory', cite: 'Cal. Civ. Code 2954.8' },
  ID: { annual_rate: 0, status: 'unverified', cite: 'no Idaho impound-interest statute located 2026-09-08; counsel sign-off required' },
};

export const parseDate = (iso: IsoDate) => new Date(iso + 'T00:00:00Z');
export const fmtDate = (d: Date): IsoDate => d.toISOString().slice(0, 10);
export function addDays(iso: IsoDate, days: number): IsoDate { const d = parseDate(iso); d.setUTCDate(d.getUTCDate() + days); return fmtDate(d); }
export function addMonths(iso: IsoDate, months: number, day?: number): IsoDate {
  const d = parseDate(iso);
  const dd = day ?? d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(dd, last));
  return fmtDate(t);
}
export const daysBetween = (a: IsoDate, b: IsoDate) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
export const isWeekend = (iso: IsoDate) => { const d = parseDate(iso).getUTCDay(); return d === 0 || d === 6; };

/** US federal holidays observed (fixed and floating) for a given year. */
export function federalHolidays(year: number): Set<IsoDate> {
  const s = new Set<IsoDate>();
  const fixed: Array<[number, number]> = [[1, 1], [6, 19], [7, 4], [11, 11], [12, 25]];
  for (const [m, d] of fixed) {
    let iso = fmtDate(new Date(Date.UTC(year, m - 1, d)));
    const wd = parseDate(iso).getUTCDay();
    if (wd === 6) iso = addDays(iso, -1); else if (wd === 0) iso = addDays(iso, 1);
    s.add(iso);
  }
  const nth = (m: number, weekday: number, n: number) => { const first = new Date(Date.UTC(year, m - 1, 1)); const off = (weekday - first.getUTCDay() + 7) % 7; return fmtDate(new Date(Date.UTC(year, m - 1, 1 + off + 7 * (n - 1)))); };
  const lastMon = (m: number) => { const last = new Date(Date.UTC(year, m, 0)); const off = (last.getUTCDay() - 1 + 7) % 7; return fmtDate(new Date(Date.UTC(year, m - 1, last.getUTCDate() - off))); };
  s.add(nth(1, 1, 3)); s.add(nth(2, 1, 3)); s.add(lastMon(5)); s.add(nth(9, 1, 1)); s.add(nth(10, 1, 2)); s.add(nth(11, 4, 4));
  return s;
}
export function isBusinessDay(iso: IsoDate): boolean { return !isWeekend(iso) && !federalHolidays(Number(iso.slice(0, 4))).has(iso); }
export function nextBusinessDay(iso: IsoDate): IsoDate { let d = iso; while (!isBusinessDay(d)) d = addDays(d, 1); return d; }
export function addBusinessDays(iso: IsoDate, n: number): IsoDate { let d = iso; let k = 0; while (k < n) { d = addDays(d, 1); if (isBusinessDay(d)) k++; } return d; }

/** Next occurrence of an MM-DD deadline on or after `from`. */
export function nextDeadline(mmdd: string, from: IsoDate): IsoDate {
  const [m, d] = mmdd.split('-').map(Number);
  const y = Number(from.slice(0, 4));
  let iso = fmtDate(new Date(Date.UTC(y, m - 1, d)));
  if (iso < from) iso = fmtDate(new Date(Date.UTC(y + 1, m - 1, d)));
  return iso;
}

/** Every statutory disbursement date in [from, to] for a state (tax halves) plus the hazard renewal MM-DD. */
export function disbursementCalendar(state: UsState, hazardRenewal: string, from: IsoDate, to: IsoDate): Array<{ purpose: 'tax' | 'hazard'; due: IsoDate; description: string }> {
  const out: Array<{ purpose: 'tax' | 'hazard'; due: IsoDate; description: string }> = [];
  const items: Array<{ purpose: 'tax' | 'hazard'; mmdd: string; description: string }> = [
    ...TAX_CALENDAR[state].map((i) => ({ purpose: 'tax' as const, mmdd: i.due, description: i.description })),
    { purpose: 'hazard', mmdd: hazardRenewal, description: 'Hazard policy renewal' },
  ];
  for (const it of items) {
    let d = nextDeadline(it.mmdd, from);
    while (d <= to) { out.push({ purpose: it.purpose, due: d, description: it.description }); d = nextDeadline(it.mmdd, addDays(d, 1)); }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

/** Ripple epoch seconds for a deadline at 17:00 UTC (10:00 Mountain) on the due date. */
export const RIPPLE_EPOCH = 946_684_800;
export const rippleTimeAt = (iso: IsoDate, hourUtc = 17) => Math.floor(Date.parse(`${iso}T${String(hourUtc).padStart(2, '0')}:00:00Z`) / 1000) - RIPPLE_EPOCH;
