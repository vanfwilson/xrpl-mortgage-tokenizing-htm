import { round2, toCents } from '../domain/loan-math.js';
import type { CanonicalLoan } from '../ingest/canonical.js';

/**
 * The four legs of one borrower payment on a fixed-rate FHA loan. P&I is the note's fixed
 * amount for the life of the loan; the tax and hazard legs are the analysed escrow deposit;
 * MIP is remitted monthly to HUD from its own payable (never escrowed with hazard).
 * HOA, home warranty and credit life are deliberately out of scope: the homeowner pays them directly.
 */
export interface PaymentSplit {
  principal_and_interest: number;   // Note s.3 / CD p.1 Loan Terms
  property_tax_impound: number;     // CD p.1 Estimated Taxes, Insurance & Assessments
  hazard_insurance_impound: number; // CD p.1 Homeowner's Insurance
  fha_mip: number;                  // CD p.1 Projected Payments -> Mortgage Insurance
}

export interface ScannedCdData {
  monthly_piti: number;
  base_principal_and_interest: number;
  monthly_property_tax_impound: number;
  monthly_hazard_insurance: number;
  monthly_fha_mip: number;
}

/** Split one inbound borrower payment into the four ledger destinations; refuse if the legs do not balance to the cent. */
export function calculateAutomatedPaymentSplit(scanned: ScannedCdData): PaymentSplit {
  const split: PaymentSplit = {
    principal_and_interest: round2(scanned.base_principal_and_interest),
    property_tax_impound: round2(scanned.monthly_property_tax_impound),
    hazard_insurance_impound: round2(scanned.monthly_hazard_insurance),
    fha_mip: round2(scanned.monthly_fha_mip),
  };
  const sumCents = Object.values(split).reduce((a, b) => a + toCents(b), 0);
  if (sumCents !== toCents(scanned.monthly_piti)) {
    throw new Error(`Audit Failure: split ${sumCents / 100} does not balance to borrower payment ${scanned.monthly_piti}`);
  }
  return split;
}

export const scannedCdFromLoan = (loan: CanonicalLoan): ScannedCdData => ({
  monthly_piti: loan.servicing.monthly_total_sweep,
  base_principal_and_interest: loan.servicing.principal_and_interest,
  monthly_property_tax_impound: loan.servicing.property_tax_impound,
  monthly_hazard_insurance: loan.servicing.hazard_insurance_impound,
  monthly_fha_mip: loan.servicing.fha_mip,
});
