import { LoanManageFlags, type EscrowCreate, type LoanManage, type LoanPay, type Payment } from 'xrpl';
import type { Loan } from 'xrpl/dist/npm/models/ledger/index.js';
import { config } from '../config.js';
import { calculateAutomatedPaymentSplit, scannedCdFromLoan } from '../servicing/split.js';
import { ADA_COUNTY_TAX_INSTALLMENTS, evaluateImpound, finishAfterForDeadline } from '../servicing/impound-scheduler.js';
import { hex, ledgerEntry, nowRipple, submit, usdToDrops } from '../xrpl/client.js';
import { record, soft, type Ctx } from './context.js';

/**
 * Monthly servicing loop: the homeowner's sweep lands at the servicer and is split
 * into exactly three legs (audited to the cent before anything is submitted):
 *   1. P&I               -> LoanPay against the vault-funded loan (lender / lienholder vault)
 *   2. Property tax      -> Payment to the Tax Impound sub-account
 *   3. Hazard + FHA MIP  -> Payment to the Insurance Impound sub-account
 * Then the impounds are time-locked to their payees with native escrows that release on
 * the statutory dates (Ada County Dec 20 / Jun 20; carrier renewal), which is the
 * "auto-disburse" mechanism without any custom contract code.
 */
export async function serviceLoan(ctx: Ctx): Promise<void> {
  const { client, wallets, loan } = ctx;
  const loanId = ctx.ids.loanId!;
  const split = calculateAutomatedPaymentSplit(scannedCdFromLoan(loan));
  ctx.log(`    split audited: P&I ${split.lender_p_i_vault} | tax ${split.tax_impound_vault} | insurance ${split.insurance_impound_vault} = ${loan.servicing.monthly_total_sweep}`);
  const memo = (type: string, data: Record<string, unknown>) => [{ Memo: { MemoType: hex(type), MemoData: hex(JSON.stringify(data)) } }];

  for (let period = 1; period <= config.demoLoan.sweepsToRun; period++) {
    await soft(ctx, `sweep period ${period}`, async () => {
      const entry = await ledgerEntry<Loan>(client, loanId);
      if (nowRipple() >= entry.NextPaymentDueDate) throw new Error('period already due; late path not exercised in demo');
      // 0. Borrower sweep: homeowner -> servicer for the full monthly amount.
      const sweep: Payment = {
        TransactionType: 'Payment', Account: wallets.homeowner.classicAddress, Destination: wallets.servicer.classicAddress,
        Amount: usdToDrops(loan.servicing.monthly_total_sweep),
        Memos: memo('htm/sweep', { loan_id: loan.loan.loan_id, period, piti: loan.servicing.monthly_total_sweep }),
      };
      record(ctx, await submit(client, wallets.homeowner, sweep, 'servicing'));
      // 1. P&I -> lender vault via LoanPay (amount is the ledger's periodic due; memo carries the USD P&I).
      const pay: LoanPay = {
        TransactionType: 'LoanPay', Account: wallets.servicer.classicAddress, LoanID: loanId,
        Amount: String(Math.ceil(Number(entry.PeriodicPayment) + Number(entry.LoanServiceFee ?? 0))),
        Memos: memo('htm/pi', { loan_id: loan.loan.loan_id, period, pi_usd: split.lender_p_i_vault }),
      };
      record(ctx, await submit(client, wallets.servicer, pay, 'servicing'));
      // 2. Tax impound.
      const tax: Payment = {
        TransactionType: 'Payment', Account: wallets.servicer.classicAddress, Destination: wallets.taxImpound.classicAddress,
        Amount: usdToDrops(split.tax_impound_vault), Memos: memo('htm/tax-impound', { loan_id: loan.loan.loan_id, period, usd: split.tax_impound_vault, apn: loan.property.apn }),
      };
      record(ctx, await submit(client, wallets.servicer, tax, 'servicing'));
      // 3. Insurance impound (hazard + FHA MIP).
      const ins: Payment = {
        TransactionType: 'Payment', Account: wallets.servicer.classicAddress, Destination: wallets.insuranceImpound.classicAddress,
        Amount: usdToDrops(split.insurance_impound_vault), Memos: memo('htm/insurance-impound', { loan_id: loan.loan.loan_id, period, usd: split.insurance_impound_vault, ...loan.servicing.insurance_detail }),
      };
      record(ctx, await submit(client, wallets.servicer, ins, 'servicing'));
      const after = await ledgerEntry<Loan>(client, loanId);
      ctx.log(`    period ${period}: PrincipalOutstanding ${after.PrincipalOutstanding} drops, PaymentRemaining ${after.PaymentRemaining}`);
    });
  }

  // Impound disbursement scheduling -> native time-locked escrows to the payees.
  await soft(ctx, 'impound escrows', async () => {
    const swept = config.demoLoan.sweepsToRun;
    const taxPlan = { kind: 'tax' as const, payee: 'Ada County Treasurer', monthly_impound: loan.servicing.property_tax_impound, annual_total: loan.servicing.property_tax_impound * 12, installments: ADA_COUNTY_TAX_INSTALLMENTS };
    const insPlan = { kind: 'insurance' as const, payee: 'Hazard carrier / HUD', monthly_impound: loan.servicing.insurance_impound, annual_total: loan.servicing.insurance_impound * 12, installments: [{ due: '09-01', description: 'Hazard policy renewal + FHA MIP annual remittance' }] };
    for (const [plan, from, to] of [[taxPlan, wallets.taxImpound, wallets.countyTreasurer], [insPlan, wallets.insuranceImpound, wallets.insuranceCarrier]] as const) {
      const balanceUsd = plan.monthly_impound * swept; // what the demo actually swept into the sub-account
      const next = evaluateImpound(plan, balanceUsd)[0];
      ctx.log(`    ${plan.kind} impound: balance ${balanceUsd.toFixed(2)} USD, next ${next.description} due ${next.deadline} (${next.days_remaining}d), projected ${next.projected_balance_at_deadline} vs ${next.amount_due} -> ${next.status}`);
      // Lock what has accumulated so far to the payee; it can only be released on/after the statutory date.
      const esc: EscrowCreate = {
        TransactionType: 'EscrowCreate', Account: from.classicAddress, Destination: to.classicAddress,
        Amount: usdToDrops(balanceUsd), FinishAfter: finishAfterForDeadline(next.deadline),
        Memos: memo(`htm/${plan.kind}-disbursement`, { loan_id: loan.loan.loan_id, due: next.deadline, usd: balanceUsd, payee: plan.payee }),
      };
      const r = record(ctx, await submit(client, from, esc, 'servicing'));
      ctx.ids[plan.kind === 'tax' ? 'taxEscrowTx' : 'insuranceEscrowTx'] = r.hash;
    }
  });

  await soft(ctx, 'LoanManage impair/unimpair', async () => {
    const impair: LoanManage = { TransactionType: 'LoanManage', Account: wallets.broker.classicAddress, LoanID: loanId, Flags: LoanManageFlags.tfLoanImpair };
    record(ctx, await submit(client, wallets.broker, impair, 'servicing'));
    record(ctx, await submit(client, wallets.broker, { ...impair, Flags: LoanManageFlags.tfLoanUnimpair }, 'servicing'));
  });
}
