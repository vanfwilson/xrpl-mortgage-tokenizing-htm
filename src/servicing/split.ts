import { round2 } from '../domain/loan-math.js';
import type { CanonicalLoan } from '../ingest/canonical.js';

/**
 * The only three fees the auto-payment contract pays. Everything else (HOA, home
 * warranty, credit life) is deliberately out of scope: the homeowner pays those directly.
 */
export interface PaymentSplit {
  principal_and_interest: number;
  tax_impound: number;
  hazard_impound: number;
  mip_payable: number;
}

export interface ScannedCdData {
  monthly_piti: number;
  base_principal_and_interest: number;
  monthly_property_tax_impound: number;
  monthly_hazard_insurance: number;
  monthly_fha_mip: number;
}

/** Split one inbound borrower sweep into the three ledger destinations; refuse if the rows do not balance. */
export function calculateAutomatedPaymentSplit(scanned: ScannedCdData): PaymentSplit {
  const split: PaymentSplit = {
    principal_and_interest: round2(scanned.base_principal_and_interest),
    tax_impound: round2(scanned.monthly_property_tax_impound),
    hazard_impound: round2(scanned.monthly_hazard_insurance),
    mip_payable: round2(scanned.monthly_fha_mip),
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
  monthly_hazard_insurance: loan.servicing.hazard_insurance_impound,
  monthly_fha_mip: loan.servicing.fha_mip_payable,
});
