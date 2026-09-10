import type { CanonicalLoan } from '../ingest/canonical.js';
import { buildLoanRecordMint } from '../xrpl/record.js';
import { buildIssuedUsdPayment, type SettlementLeg } from '../xrpl/settle.js';

export function toXrplPayloads(loan: CanonicalLoan, docsSha256: string) {
  const run = 'IDEMPOTENCY_KEY', issuer = '<TEST_USD_ISSUER>', account = '<SERVICER_ACCOUNT>';
  const vals: Array<[SettlementLeg, number, string]> = [
    ['pi', loan.servicing.principal_and_interest, '<NOTE_HOLDER>'],
    ['tax', loan.servicing.property_tax_impound, '<TAX_IMPOUND>'],
    ['hazard', loan.servicing.hazard_insurance_impound, '<HAZARD_IMPOUND>'],
    ['mip', loan.servicing.fha_mip_payable, '<MIP_PAYABLE>'],
  ];
  return {
    label: 'controlled Testnet USD; not RLUSD, a deposit or borrower funds',
    record: buildLoanRecordMint(account, { schema: 'htm.loan-record', version: 1, loan: loan.loan.loan_id, sha256: docsSha256, ptr: 'ipfs://CID' }),
    settlement: vals.map(([leg, usd, destination]) => buildIssuedUsdPayment(account, destination, issuer, { v: 1, loan: loan.loan.loan_id, period: '2026-11', leg, cents: Math.round(usd * 100), run })),
  };
}
