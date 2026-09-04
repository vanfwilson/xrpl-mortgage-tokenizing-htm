import { LoanManageFlags, type LoanDelete, type LoanManage, type LoanPay } from 'xrpl';
import type { Loan } from 'xrpl/dist/npm/models/ledger/index.js';
import { hex, ledgerEntry, nowRipple, sleep, submit } from '../xrpl/client.js';
import { record, soft, type Ctx } from './context.js';

async function waitUntilRipple(ctx: Ctx, target: number, label: string, maxSec = 150): Promise<void> {
  const start = Date.now();
  while (nowRipple() < target) {
    if ((Date.now() - start) / 1000 > maxSec) throw new Error(`${label}: waited ${maxSec}s`);
    await sleep(5_000);
  }
  await sleep(6_000); // let a validated ledger close past the boundary
}

/**
 * Servicing. Each LoanPay carries the homeowner PITI breakdown in a memo so
 * an auditor can reconcile the on-chain remittance with the servicing file.
 * The broker demonstrates impairment (early warning) and un-impairment.
 * --full-lifecycle additionally waits out the grace period and defaults the
 * loan, exercising first-loss cover, then deletes it.
 */
export async function serviceLoan(ctx: Ctx): Promise<void> {
  const { client, wallets, loan } = ctx;
  const loanId = ctx.ids.loanId!;
  let entry = await ledgerEntry<Loan>(client, loanId);

  // XLS-66: a payment submitted after NextPaymentDueDate is a *late* payment and
  // must carry tfLoanLatePayment with the exact late amount; a payment before the
  // due date is applied to the next cycle. Servicers remit ahead, so we pay ahead.
  for (const period of [1, 2]) {
    await soft(ctx, `LoanPay (period ${period})`, async () => {
      entry = await ledgerEntry<Loan>(client, loanId);
      if (nowRipple() >= entry.NextPaymentDueDate) {
        throw new Error(`period ${period} already due; late-payment path not exercised in this demo`);
      }
      const periodic = Number(entry.PeriodicPayment);
      const fee = Number(entry.LoanServiceFee ?? 0);
      const m = loan.recurring_monthly;
      const pay: LoanPay = {
        TransactionType: 'LoanPay',
        Account: wallets.originator.classicAddress,
        LoanID: loanId,
        Amount: String(Math.ceil(periodic + fee)),
        Memos: [
          {
            Memo: {
              MemoType: hex('htm/servicing'),
              MemoData: hex(
                JSON.stringify({
                  loan_id: loan.loan.loan_id,
                  period,
                  pi: m.principal_and_interest,
                  mip: m.fha_mip,
                  tax: m.property_tax_impound,
                  hoi: m.homeowners_insurance_impound,
                  piti: m.total_piti,
                }),
              ),
            },
          },
        ],
      };
      record(ctx, await submit(client, wallets.originator, pay, 'servicing'));
      entry = await ledgerEntry<Loan>(client, loanId);
      ctx.log(`    after payment ${period}: PrincipalOutstanding ${entry.PrincipalOutstanding}, PaymentRemaining ${entry.PaymentRemaining}, NextPaymentDueDate ${entry.NextPaymentDueDate}`);
    });
  }

  await soft(ctx, 'LoanManage impair/unimpair', async () => {
    const impair: LoanManage = {
      TransactionType: 'LoanManage',
      Account: wallets.broker.classicAddress,
      LoanID: loanId,
      Flags: LoanManageFlags.tfLoanImpair,
    };
    record(ctx, await submit(client, wallets.broker, impair, 'servicing'));
    const unimpair: LoanManage = { ...impair, Flags: LoanManageFlags.tfLoanUnimpair };
    record(ctx, await submit(client, wallets.broker, unimpair, 'servicing'));
  });

  if (!ctx.fullLifecycle) {
    ctx.notes.push('Default path not exercised; run `npm run demo:full` to wait out the grace period and default the loan.');
    return;
  }

  await soft(ctx, 'LoanManage default + LoanDelete', async () => {
    entry = await ledgerEntry<Loan>(client, loanId);
    await waitUntilRipple(ctx, entry.NextPaymentDueDate + entry.GracePeriod, 'grace period', 400);
    const def: LoanManage = {
      TransactionType: 'LoanManage',
      Account: wallets.broker.classicAddress,
      LoanID: loanId,
      Flags: LoanManageFlags.tfLoanDefault,
    };
    record(ctx, await submit(client, wallets.broker, def, 'servicing'));
    const del: LoanDelete = { TransactionType: 'LoanDelete', Account: wallets.broker.classicAddress, LoanID: loanId };
    record(ctx, await submit(client, wallets.broker, del, 'servicing'));
  });
}
