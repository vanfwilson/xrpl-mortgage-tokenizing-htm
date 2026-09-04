import { round2 } from '../domain/loan-math.js';
import type { CanonicalLoan } from '../ingest/canonical.js';

/**
 * The only three fees the auto-payment contract pays. Everything else (HOA, home
 * warranty, credit life) is deliberately out of scope: the homeowner pays those directly.
 */
export interface PaymentSplit {
  lender_p_i_vault: number;        // Closing Disclosure p.1 Loan Terms / Projected Payments
  tax_impound_vault: number;       // CD p.1 Estimated Taxes, Insurance & Assessments
  insurance_impound_vault: number; // CD p.1 (hazard homeowners) + Mortgage Insurance (FHA MIP)
}

export interface ScannedCdData {
  monthly_piti: number;
  base_principal_and_interest: number;
  monthly_property_tax_impound: number;
  monthly_hazard_insurance: number; // hazard + FHA MIP
}

/** Split one inbound borrower sweep into the three ledger destinations; refuse if the rows do not balance. */
export function calculateAutomatedPaymentSplit(scanned: ScannedCdData): PaymentSplit {
  const split: PaymentSplit = {
    lender_p_i_vault: round2(scanned.base_principal_and_interest),
    tax_impound_vault: round2(scanned.monthly_property_tax_impound),
    insurance_impound_vault: round2(scanned.monthly_hazard_insurance),
  };
  const checkSum = round2(Object.values(split).reduce((a, b) => a + b, 0));
  if (Math.abs(checkSum - scanned.monthly_piti) > 0.01) {
    throw new Error(`Audit Failure: split ${checkSum} does not balance to borrower sweep ${scanned.monthly_piti}`);
  }
  return split;
}

export const scannedCdFromLoan = (loan: CanonicalLoan): ScannedCdData => ({
  monthly_piti: loan.servicing.monthly_total_sweep,
  base_principal_and_interest: loan.servicing.principal_and_interest,
  monthly_property_tax_impound: loan.servicing.property_tax_impound,
  monthly_hazard_insurance: loan.servicing.insurance_impound,
});
