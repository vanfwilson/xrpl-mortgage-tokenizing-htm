/** Pure mortgage arithmetic. Amounts in USD unless stated. */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10_000) / 10_000;
/** Integer cents, the unit every ledger and subledger posting uses. */
export const toCents = (usd: number) => Math.round((usd + Number.EPSILON) * 100);
export const fromCents = (cents: number) => cents / 100;

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

// ---------------------------------------------------------------------------
// FHA (R20, R21)
// ---------------------------------------------------------------------------

/** Upfront MIP: 1.75 % of the BASE loan amount (HUD Mortgagee Letter 2023-05). */
export const FHA_UFMIP_RATE = 0.0175;
/** 24 CFR 203.25: late charge may not exceed 4 % of the payment more than 15 days in arrears. */
export const FHA_LATE_CHARGE_MAX = 0.04;
export const FHA_GRACE_DAYS = 15;
/** Base-loan threshold in the ML 2023-05 annual MIP table. HUD may revise; keep it data. */
export const FHA_MIP_TABLE_THRESHOLD = 726_200;

/**
 * Annual MIP rate from the HUD ML 2023-05 table (effective for endorsements on/after 2023-03-20).
 * Rates apply to the BASE loan amount; LTV is base / lesser of price and appraisal.
 */
export function fhaAnnualMipRate(ltv: number, baseLoan: number, termMonths: number): number {
  const long = termMonths > 180;
  const big = baseLoan > FHA_MIP_TABLE_THRESHOLD;
  if (long) {
    if (!big) return ltv > 0.95 ? 0.0055 : 0.005;
    return ltv > 0.95 ? 0.0075 : 0.007;
  }
  if (!big) return ltv > 0.9 ? 0.004 : 0.0015;
  if (ltv > 0.9) return 0.0065;
  return ltv > 0.78 ? 0.004 : 0.0015;
}

export interface FhaPremiums {
  base_loan_amount: number;
  ufmip: number;
  note_amount: number;
  ltv: number;
  annual_mip_rate: number;
  monthly_mip: number;
}

/** UFMIP, note amount, LTV and first-year monthly MIP for an FHA loan, all from the base loan amount. */
export function fhaPremiums(baseLoan: number, salePrice: number, appraisedValue: number, termMonths: number): FhaPremiums {
  const ufmip = round2(baseLoan * FHA_UFMIP_RATE);
  const ltv = round4(baseLoan / Math.min(salePrice, appraisedValue));
  const annual_mip_rate = fhaAnnualMipRate(ltv, baseLoan, termMonths);
  return {
    base_loan_amount: round2(baseLoan),
    ufmip,
    note_amount: round2(baseLoan + ufmip),
    ltv,
    annual_mip_rate,
    monthly_mip: round2((baseLoan * annual_mip_rate) / 12),
  };
}

/** Base loan that, with its UFMIP financed, produces the given note amount. */
export const fhaBaseFromNote = (noteAmount: number) => round2(noteAmount / (1 + FHA_UFMIP_RATE));

/** Late charge on an FHA loan; throws if the note percentage exceeds the 24 CFR 203.25 cap. */
export function fhaLateCharge(monthlyPi: number, pct = FHA_LATE_CHARGE_MAX): number {
  if (pct > FHA_LATE_CHARGE_MAX + 1e-9) throw new RangeError(`late charge ${pct} exceeds 24 CFR 203.25 cap of ${FHA_LATE_CHARGE_MAX}`);
  return round2(monthlyPi * pct);
}
