/**
 * RS3 (roast 2026-09-10): what one loan-year costs on the XRP Ledger, in drops and in dollars, and how the
 * footprint scales with the number of loans. Everything here is arithmetic over stated inputs; the XRP price is
 * an input, never fetched, so the numbers in docs/cost-model.md are reproducible.
 *
 * Two kinds of cost:
 * - transaction fees, burned per validated transaction (the 10-drop reference fee; the model takes the fee used);
 * - owner reserves, locked per ledger object an account owns (trust lines, escrows, NFTokens, signer lists) and
 *   returned when the object is removed. Reserves are capital parked, not spent.
 */
import { OWNER_RESERVE_DROPS_PER_OBJECT } from '../xrpl/escrow.js';

export const DROPS_PER_XRP = 1_000_000;
/** Reference transaction cost on Mainnet and Testnet (2026-09-10). Load scaling can raise it; the model takes an input. */
export const REFERENCE_FEE_DROPS = 10;
/** Ledgers close about every 4 seconds on Mainnet. */
export const LEDGER_CLOSE_SECONDS = 4;

export interface LoanYearFootprint {
  /** Settlement legs per monthly cycle (receipt, P&I, tax, hazard, MIP, MIP remit = 6 in the fixture). */
  legs_per_month: number;
  months: number;
  /** One-off boarding legs (initial escrow deposits). */
  boarding_legs: number;
  /** Impound bills paid through TokenEscrow this year: each is EscrowCreate + EscrowFinish (or EscrowCancel). */
  escrows: number;
  /** Trust lines held open for the loan's role accounts (issued-USD lines). */
  trust_lines: number;
  /** Loan-record NFTokens minted (one per loan). */
  nftokens: number;
  /** Other transactions in the year (NFToken mint/offer/accept, key drills, account setup). */
  other_transactions: number;
}

export interface CostInputs extends LoanYearFootprint {
  fee_drops?: number;
  reserve_drops_per_object?: number;
  /** Dollars per XRP; stated by the caller. */
  xrp_usd: number;
}

export interface LoanYearCost {
  transactions: number;
  fee_drops: number;
  /** Peak owner reserve locked at once: trust lines + NFToken + the largest number of escrows open simultaneously (assumed all). */
  reserve_drops_peak: number;
  fee_usd: number;
  reserve_usd_peak: number;
  /** Fees only, divided over the months in the year; the operating cost a subservicer would price against. */
  fee_usd_per_loan_month: number;
  /** Fees plus reserve carry, treating the peak reserve as capital parked for the year at the stated price. */
  all_in_usd_per_loan_month: number;
  inputs: Required<CostInputs>;
}

const round = (n: number, places = 6) => Math.round(n * 10 ** places) / 10 ** places;

export function loanYearCost(i: CostInputs): LoanYearCost {
  const fee_drops_each = i.fee_drops ?? REFERENCE_FEE_DROPS;
  const reserve_each = i.reserve_drops_per_object ?? OWNER_RESERVE_DROPS_PER_OBJECT;
  for (const [k, v] of Object.entries({ ...i, fee_drops: fee_drops_each, reserve_drops_per_object: reserve_each })) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new RangeError(`cost model: ${k} must be a non-negative number`);
  }
  if (i.xrp_usd <= 0) throw new RangeError('cost model: xrp_usd must be positive');
  if (i.months <= 0) throw new RangeError('cost model: months must be positive');
  const transactions = i.legs_per_month * i.months + i.boarding_legs + i.escrows * 2 + i.other_transactions;
  const fee_drops = transactions * fee_drops_each;
  const reserve_drops_peak = (i.trust_lines + i.nftokens + i.escrows) * reserve_each;
  const fee_usd = (fee_drops / DROPS_PER_XRP) * i.xrp_usd;
  const reserve_usd_peak = (reserve_drops_peak / DROPS_PER_XRP) * i.xrp_usd;
  return {
    transactions, fee_drops, reserve_drops_peak,
    fee_usd: round(fee_usd), reserve_usd_peak: round(reserve_usd_peak),
    fee_usd_per_loan_month: round(fee_usd / i.months),
    all_in_usd_per_loan_month: round((fee_usd + reserve_usd_peak) / i.months),
    inputs: { ...i, fee_drops: fee_drops_each, reserve_drops_per_object: reserve_each },
  };
}

/** The fixture loan-year as run on Testnet: 6 legs a month, 2 boarding deposits, 2 impound escrows, 11 role trust lines, 1 NFToken. */
export const FIXTURE_FOOTPRINT: LoanYearFootprint = { legs_per_month: 6, months: 12, boarding_legs: 2, escrows: 2, trust_lines: 11, nftokens: 1, other_transactions: 8 };

/**
 * Production footprint per loan: role accounts (servicer, impound, MIP payable, HUD, payees) are shared across the
 * book, so the per-loan objects are one borrower trust line, one NFToken and the escrows in flight. The 11 trust
 * lines in the fixture are a demo artefact of funding one wallet per role for a single loan.
 */
export const PRODUCTION_FOOTPRINT: LoanYearFootprint = { legs_per_month: 6, months: 12, boarding_legs: 2, escrows: 2, trust_lines: 1, nftokens: 1, other_transactions: 3 };

export interface ScaleNote {
  loans: number;
  transactions_per_month: number;
  /** Wall-clock hours to submit one month's legs serially at one transaction per ledger close. */
  serial_hours_per_month: number;
  /** Hours when legs are batched across accounts, at the stated submissions per ledger. */
  batched_hours_per_month: number;
  reserve_xrp_peak: number;
  fee_xrp_per_month: number;
}

/** How the footprint grows with N loans. `per_ledger` is how many independent-account transactions are submitted per ledger close. */
export function scaleNote(loans: number, per_ledger = 50, footprint: LoanYearFootprint = FIXTURE_FOOTPRINT, fee_drops = REFERENCE_FEE_DROPS, reserve_each = OWNER_RESERVE_DROPS_PER_OBJECT): ScaleNote {
  if (!Number.isInteger(loans) || loans <= 0) throw new RangeError('cost model: loans must be a positive integer');
  if (!Number.isInteger(per_ledger) || per_ledger <= 0) throw new RangeError('cost model: per_ledger must be a positive integer');
  const perMonth = loans * (footprint.legs_per_month + (footprint.escrows * 2) / footprint.months);
  const secondsSerial = perMonth * LEDGER_CLOSE_SECONDS;
  const secondsBatched = Math.ceil(perMonth / per_ledger) * LEDGER_CLOSE_SECONDS;
  const reserveObjects = loans * (footprint.trust_lines + footprint.nftokens + footprint.escrows);
  return {
    loans, transactions_per_month: Math.round(perMonth),
    serial_hours_per_month: round(secondsSerial / 3600, 2), batched_hours_per_month: round(secondsBatched / 3600, 2),
    reserve_xrp_peak: round((reserveObjects * reserve_each) / DROPS_PER_XRP, 2),
    fee_xrp_per_month: round((perMonth * fee_drops) / DROPS_PER_XRP, 4),
  };
}
