/**
 * Servicing engine types. Every money field is INTEGER CENTS. Every record carries the tenant
 * boundary (`company_id`, `loan_id`). Dates are ISO `YYYY-MM-DD`; instants are ISO 8601 UTC.
 */
export type Cents = number;
export type IsoDate = string;
export type IsoInstant = string;

export type UsState = 'ID' | 'CA';

export interface Tenant { company_id: string; loan_id: string }

/** Subledger purposes. `closing_escrow` is deliberately absent (R01). */
export type Account =
  | 'collection'
  | 'suspense'
  | 'note_holder'
  | 'tax'
  | 'hazard'
  | 'mip'
  | 'fees'
  | 'advance'
  | 'refund'
  | 'loss_draft'
  | 'hud';

export const ESCROW_PURPOSES = ['tax', 'hazard'] as const;
export type EscrowPurpose = (typeof ESCROW_PURPOSES)[number];

export interface Posting extends Tenant {
  account: Account;
  /** Positive = credit to the account, negative = debit. */
  cents: Cents;
  period?: number;
  leg: string;
  effective_date: IsoDate;
  bank_ref?: string;
  ledger_hash?: string;
}

export interface LoanTerms extends Tenant {
  state: UsState;
  loan_type: 'FHA' | 'Conventional' | 'VA' | 'USDA';
  credit_purpose: 'consumer';
  note_amount_cents: Cents;
  annual_rate: number;
  term_months: number;
  origination_date: IsoDate;
  first_payment_date: IsoDate;
  payment_due_day: number;
  monthly_pi_cents: Cents;
  late_charge_cents: Cents;
  grace_days: number;
  /** Funding bank that owns the note. Token transfers never change this (R18, R31). */
  legal_owner_id: string;
  servicer_of_record_id: string;
}

export interface ScheduleRow { period: number; due_date: IsoDate; interest_cents: Cents; principal_cents: Cents; balance_after_cents: Cents }

export interface Receipt extends Tenant {
  received_at: IsoInstant;
  amount_cents: Cents;
  bank_ref: string;
}

export interface VerifiedBill extends Tenant {
  purpose: EscrowPurpose;
  payee_id: string;
  cents: Cents;
  due_date: IsoDate;
  /** True only when the bill was read from the payee's document, never from a forecast. */
  verified: boolean;
  source_ref: string;
}
