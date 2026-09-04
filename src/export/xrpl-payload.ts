import { MPTokenIssuanceCreateFlags as F } from 'xrpl';
import { buildMptMetadata, encodeMetadataHex } from '../domain/metadata.js';
import { toTenthBps, usdToMptUnits } from '../domain/loan-math.js';
import type { CanonicalLoan } from '../ingest/canonical.js';

/**
 * The unsigned XRPL transaction templates this loan produces, with account
 * placeholders. Useful for reviewers and for the DB (xrpl_objects.details).
 */
export function toXrplPayloads(loan: CanonicalLoan, docsSha256: string) {
  const A = {
    issuer: '<ISSUER_ACCOUNT>', broker: '<LENDING_DESK_ACCOUNT>', originator: '<WAREHOUSE_BORROWER_ACCOUNT>',
  };
  return {
    scale_note: 'Devnet demo: 1 XRP = US$10,000; MPT units = USD cents',
    MPTokenIssuanceCreate: {
      TransactionType: 'MPTokenIssuanceCreate', Account: A.issuer, AssetScale: 2,
      MaximumAmount: usdToMptUnits(loan.loan.principal_amount), TransferFee: 0,
      Flags: F.tfMPTRequireAuth | F.tfMPTCanLock | F.tfMPTCanClawback | F.tfMPTCanEscrow | F.tfMPTCanTransfer,
      MPTokenMetadata: encodeMetadataHex(buildMptMetadata(loan, docsSha256)),
      _metadata_decoded: buildMptMetadata(loan, docsSha256),
    },
    VaultCreate: { TransactionType: 'VaultCreate', Account: A.broker, Asset: { currency: 'XRP' }, Flags: 'tfVaultPrivate', DomainID: '<DOMAIN_ID>', WithdrawalPolicy: 1, AssetsMaximum: '0' },
    LoanBrokerSet: { TransactionType: 'LoanBrokerSet', Account: A.broker, VaultID: '<VAULT_ID>', ManagementFeeRate: 100, DebtMaximum: '0', CoverRateMinimum: 10000, CoverRateLiquidation: 5000 },
    LoanSet: {
      TransactionType: 'LoanSet', Account: A.broker, Counterparty: A.originator, LoanBrokerID: '<LOAN_BROKER_ID>',
      PrincipalRequested: String(Math.round((loan.loan.principal_amount / 10_000) * 1_000_000)),
      InterestRate: toTenthBps(loan.loan.annual_interest_rate), LateInterestRate: toTenthBps(0.05),
      PaymentTotal: loan.loan.term_months, PaymentInterval: 2_592_000, GracePeriod: 1_296_000,
      LoanServiceFee: '2500', LatePaymentFee: String(Math.round((loan.loan.monthly_principal_and_interest * 0.05 / 10_000) * 1_000_000)),
      Flags: 'tfLoanOverpayment',
    },
    LoanPay_template: {
      TransactionType: 'LoanPay', Account: A.originator, LoanID: '<LOAN_ID>', Amount: '<PeriodicPayment + LoanServiceFee in drops>',
      Memos: [{ Memo: { MemoType: 'htm/pi', MemoData: { loan_id: loan.loan.loan_id, period: '<n>', pi_usd: loan.servicing.principal_and_interest } } }],
    },
    sweep_split_template: {
      note: 'Homeowner sweep -> servicer, then three legs. Amounts in USD; ledger drops at 1 XRP = $10,000.',
      sweep_usd: loan.servicing.monthly_total_sweep,
      legs: [
        { leg: 'lender_p_i_vault', tx: 'LoanPay', usd: loan.servicing.principal_and_interest, destination: '<LOAN_ID> (vault-funded loan)' },
        { leg: 'tax_impound_vault', tx: 'Payment', usd: loan.servicing.property_tax_impound, destination: '<TAX_IMPOUND_ACCOUNT>', disburse_to: '<COUNTY_TREASURER_ACCOUNT>', schedule: ['12-20', '06-20'] },
        { leg: 'insurance_impound_vault', tx: 'Payment', usd: loan.servicing.insurance_impound, destination: '<INSURANCE_IMPOUND_ACCOUNT>', disburse_to: '<CARRIER_ACCOUNT>', schedule: ['09-01'] },
      ],
    },
  };
}
