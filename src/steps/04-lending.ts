import {
  LoanSetFlags,
  signLoanSetByCounterparty,
  type LoanBrokerCoverDeposit,
  type LoanBrokerSet,
  type LoanSet,
} from 'xrpl';
import type { Loan } from 'xrpl/dist/npm/models/ledger/index.js';
import { config } from '../config.js';
import { toTenthBps } from '../domain/loan-math.js';
import { createdNodeId, hex, ledgerEntry, submitBlob, submit, usdToDrops, xrpToDrops } from '../xrpl/client.js';
import { record, type Ctx } from './context.js';

/**
 * Credit side (XLS-66). HTM Lending Desk registers a LoanBroker on the vault,
 * posts first-loss cover, and originates a fixed-term amortizing loan to HTM
 * Loan Servicing (the on-chain borrower). The homeowner is NOT the on-chain
 * borrower: their off-chain PITI stream is what the warehouse borrower remits
 * against this loan. Terms mirror the note (6.25%) on a compressed schedule.
 */
export async function setupLendingAndOriginate(ctx: Ctx): Promise<void> {
  const { client, wallets, loan } = ctx;
  const brokerSet: LoanBrokerSet = {
    TransactionType: 'LoanBrokerSet',
    Account: wallets.broker.classicAddress,
    VaultID: ctx.ids.vaultId!,
    ManagementFeeRate: 100, // 0.10% of interest to the broker
    DebtMaximum: '0',
    CoverRateMinimum: 10_000, // first-loss capital must cover 10% of DebtTotal
    CoverRateLiquidation: 5_000, // up to 50% of that minimum deployable per default
    Data: hex(JSON.stringify({ n: 'HTM Lending Desk', loan_id: loan.loan.loan_id })),
  };
  const r1 = record(ctx, await submit(client, wallets.broker, brokerSet, 'lending'));
  ctx.ids.loanBrokerId = createdNodeId(r1.meta, 'LoanBroker');
  ctx.log(`    LoanBrokerID ${ctx.ids.loanBrokerId}`);

  const cover: LoanBrokerCoverDeposit = {
    TransactionType: 'LoanBrokerCoverDeposit',
    Account: wallets.broker.classicAddress,
    LoanBrokerID: ctx.ids.loanBrokerId,
    Amount: xrpToDrops(10), // $100,000 demo-scale first-loss capital
  };
  record(ctx, await submit(client, wallets.broker, cover, 'lending'));

  const principalDrops = usdToDrops(loan.loan.principal_amount); // $450,000 -> 45 XRP
  const loanSet: LoanSet = {
    TransactionType: 'LoanSet',
    Account: wallets.broker.classicAddress,
    Counterparty: wallets.servicer.classicAddress, // HTM Loan Servicing is the on-chain borrower
    LoanBrokerID: ctx.ids.loanBrokerId,
    PrincipalRequested: principalDrops,
    InterestRate: toTenthBps(loan.loan.annual_interest_rate), // 6.25% -> 6250
    LateInterestRate: toTenthBps(0.05),
    PaymentTotal: config.demoLoan.paymentTotal,
    PaymentInterval: config.demoLoan.paymentIntervalSec,
    GracePeriod: config.demoLoan.gracePeriodSec,
    LoanOriginationFee: usdToDrops(4_500),
    LoanServiceFee: usdToDrops(25),
    LatePaymentFee: usdToDrops(loan.note_terms.late_charge_amount), // Note s.6: 5% of overdue P&I
    ClosePaymentFee: '0',
    Flags: LoanSetFlags.tfLoanOverpayment,
    Data: hex(JSON.stringify({ loan_id: loan.loan.loan_id, docs: ctx.bundle.bundle_sha256.slice(0, 32) })),
  };
  // Two-party signing: broker signs as Account, warehouse borrower countersigns.
  const prepared = await client.autofill(loanSet, 1);
  const brokerSigned = wallets.broker.sign(prepared);
  const countersigned = signLoanSetByCounterparty(wallets.servicer, brokerSigned.tx_blob);
  const r3 = record(
    ctx,
    await submitBlob(client, countersigned.tx_blob, 'lending', 'LoanSet', wallets.broker.classicAddress),
  );
  ctx.ids.loanId = createdNodeId(r3.meta, 'Loan');
  const entry = await ledgerEntry<Loan>(client, ctx.ids.loanId);
  ctx.log(`    LoanID ${ctx.ids.loanId}`);
  ctx.log(
    `    PrincipalOutstanding ${entry.PrincipalOutstanding} drops, PeriodicPayment ${entry.PeriodicPayment}, ` +
      `PaymentRemaining ${entry.PaymentRemaining}, NextPaymentDueDate ${entry.NextPaymentDueDate}`,
  );
}
