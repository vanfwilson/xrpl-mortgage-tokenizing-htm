/** Pure mortgage arithmetic. Amounts in USD unless stated. */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Level monthly principal & interest payment (standard amortization). */
export function monthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (annualRate === 0) return round2(principal / termMonths);
  const r = annualRate / 12;
  const f = Math.pow(1 + r, termMonths);
  return round2((principal * r * f) / (f - 1));
}

export interface ScheduleRow {
  period: number;
  interest: number;
  principal: number;
  balance: number;
}

export function amortizationSchedule(principal: number, annualRate: number, termMonths: number): ScheduleRow[] {
  const pmt = monthlyPayment(principal, annualRate, termMonths);
  const r = annualRate / 12;
  const rows: ScheduleRow[] = [];
  let bal = principal;
  for (let p = 1; p <= termMonths; p++) {
    const interest = round2(bal * r);
    let prin = round2(pmt - interest);
    if (p === termMonths) prin = round2(bal); // absorb rounding drift in the final period
    bal = round2(bal - prin);
    rows.push({ period: p, interest, principal: prin, balance: Math.max(bal, 0) });
  }
  return rows;
}

/**
 * XLS-66 expresses rates in 1/10th of a basis point: 100000 == 100%.
 * 0.0625 (6.25%) -> 6250.
 */
export function toTenthBps(rate: number): number {
  const v = Math.round(rate * 100_000);
  if (v < 0 || v > 100_000) throw new RangeError(`rate ${rate} out of XLS-66 range`);
  return v;
}
export const fromTenthBps = (v: number) => v / 100_000;

/** MPT integer units for a USD amount at AssetScale 2 (cents). */
export function usdToMptUnits(usd: number, assetScale = 2): string {
  return String(Math.round(usd * Math.pow(10, assetScale)));
}

/** FHA annual MIP (2023 table, 30-year, base loan <= $726,200). */
export function fhaAnnualMipRate(ltv: number): number {
  if (ltv <= 0.9) return 0.005;
  if (ltv <= 0.95) return 0.005;
  return 0.0055;
}
export const FHA_UFMIP_RATE = 0.0175;
