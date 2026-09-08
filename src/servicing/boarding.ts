import { toCents } from '../domain/loan-math.js';
import type { CanonicalLoan } from '../ingest/canonical.js';
import { ESCROW_INTEREST, addDays } from './calendar.js';
import type { Cents, IsoDate, LoanTerms, Posting, UsState } from './types.js';

/**
 * Boarding: turn a validated canonical loan into servicing terms and opening postings.
 * R04  initial escrow deposit from the Closing Disclosure enters the tax/hazard subledgers on day one.
 * R24  California loss-draft proceeds get their own account (Cal. Civ. Code 2954.85), never the impounds.
 * R25  Idaho production profile is blocked until counsel signs the escrow-interest question.
 * R26  no boarding without a current servicing authority for the servicer of record in the property's state.
 * R31  the only owner field is legal_owner_id; there is no third-party ownership ledger.
 */
export interface Authority { holder_id: string; state: UsState; kind: 'bank_exempt' | 'CRMLA' | 'CFL' | 'ID_mortgage_servicer' | 'HUD_mortgagee'; valid_from: IsoDate; valid_to: IsoDate }

export function authorityCheck(registry: Authority[], holderId: string, state: UsState, asOf: IsoDate, needHud: boolean): void {
  const active = registry.filter((a) => a.holder_id === holderId && a.valid_from <= asOf && a.valid_to >= asOf);
  const stateOk = active.some((a) => a.state === state && a.kind !== 'HUD_mortgagee');
  if (!stateOk) throw new Error(`R26: no current servicing authority for ${holderId} in ${state} on ${asOf} (CA DFPI CRMLA/CFL or bank exemption; Idaho Dept. of Finance)`);
  if (needHud && !active.some((a) => a.kind === 'HUD_mortgagee')) throw new Error(`R26: FHA servicing requires a HUD-approved mortgagee; none current for ${holderId} on ${asOf}`);
}

export function idahoInterestGate(state: UsState, profile: 'test' | 'production', counselSigned: boolean): void {
  if (state === 'ID' && profile === 'production' && ESCROW_INTEREST.ID.status === 'unverified' && !counselSigned) {
    throw new Error('R25: Idaho escrow-interest rule is UNVERIFIED; production profile blocked until counsel sign-off is recorded');
  }
}

export interface BoardingInput {
  loan: CanonicalLoan;
  company_id: string;
  loan_id: string;
  legal_owner_id: string;
  servicer_of_record_id: string;
  settlement_date: IsoDate;
  annual_tax_cents: Cents;
  annual_hazard_cents: Cents;
  registry: Authority[];
  profile: 'test' | 'production';
  counsel_idaho_interest_signed?: boolean;
}

export interface Boarded {
  terms: LoanTerms;
  opening_postings: Posting[];
  loss_draft_account: boolean;
  initial_statement_due: IsoDate; // R05 handled in statements.ts; boarding records the clock start
}

export function boardLoan(i: BoardingInput): Boarded {
  const l = i.loan;
  if (l.loan.credit_purpose !== 'consumer') throw new Error('R19: consumer-purpose loans only');
  const state = l.property.address.state as UsState;
  if (state !== 'ID' && state !== 'CA') throw new Error(`unsupported state ${state}`);
  authorityCheck(i.registry, i.servicer_of_record_id, state, i.settlement_date, l.loan.loan_type === 'FHA');
  idahoInterestGate(state, i.profile, i.counsel_idaho_interest_signed ?? false);
  const T = { company_id: i.company_id, loan_id: i.loan_id };
  const terms: LoanTerms = {
    ...T,
    state,
    loan_type: l.loan.loan_type,
    credit_purpose: 'consumer',
    note_amount_cents: toCents(l.loan.principal_amount),
    annual_rate: l.loan.annual_interest_rate,
    term_months: l.loan.term_months,
    origination_date: l.loan.origination_date,
    first_payment_date: l.loan.first_payment_date,
    payment_due_day: l.note_terms.payment_due_day_of_month,
    monthly_pi_cents: toCents(l.loan.monthly_principal_and_interest),
    late_charge_cents: toCents(l.note_terms.late_charge_amount),
    grace_days: l.note_terms.grace_period_days,
    legal_owner_id: i.legal_owner_id,
    servicer_of_record_id: i.servicer_of_record_id,
  };
  // R04: initial escrow deposit split pro-rata by annual disbursements, to the cent.
  const deposit = toCents(l.closing.initial_escrow_deposit);
  const annual = i.annual_tax_cents + i.annual_hazard_cents;
  const taxShare = annual ? Math.round((deposit * i.annual_tax_cents) / annual) : deposit;
  const hazardShare = deposit - taxShare;
  const opening_postings: Posting[] = [
    { ...T, account: 'tax', cents: taxShare, leg: 'initial_escrow_deposit', effective_date: i.settlement_date, bank_ref: `closing:${l.closing.escrow_file_number}` },
    { ...T, account: 'hazard', cents: hazardShare, leg: 'initial_escrow_deposit', effective_date: i.settlement_date, bank_ref: `closing:${l.closing.escrow_file_number}` },
  ];
  return { terms, opening_postings, loss_draft_account: state === 'CA', initial_statement_due: addDays(i.settlement_date, 45) };
}

/** R31: the terms carry a single legal owner and nothing investor-shaped. */
export const FORBIDDEN_TERM_KEYS = ['investors', 'participation', 'participations', 'vault', 'accredited', 'share', 'tranche'];
export function assertNoParticipation(obj: Record<string, unknown>): void {
  const keys = Object.keys(obj).map((k) => k.toLowerCase());
  const hit = keys.find((k) => FORBIDDEN_TERM_KEYS.some((f) => k.includes(f)));
  if (hit) throw new Error(`R31: field '${hit}' implies a participation or investor structure that does not exist in this product`);
}
