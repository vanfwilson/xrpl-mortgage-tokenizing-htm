import type { EscrowCreate, EscrowFinish } from 'xrpl';
import { hex, nowRipple, sleep, submitBlob, submit, usdToDrops } from '../xrpl/client.js';
import { record, soft, type Ctx } from './context.js';

/**
 * Closing funds. The buyer's cash-to-close is locked in a native XRPL escrow
 * to the title company with a time lock (stand-in for "funds good at
 * recording"). Title releases it after the deed records.
 */
export async function closingEscrow(ctx: Ctx): Promise<void> {
  const { client, wallets, loan } = ctx;
  await soft(ctx, 'closing escrow', async () => {
    const create: EscrowCreate = {
      TransactionType: 'EscrowCreate',
      Account: wallets.buyer.classicAddress,
      Destination: wallets.title.classicAddress,
      Amount: usdToDrops(loan.closing.cash_to_close),
      FinishAfter: nowRipple() + 5,
      Memos: [
        {
          Memo: {
            MemoType: hex('htm/cash-to-close'),
            MemoData: hex(JSON.stringify({ file: loan.closing.escrow_file_number, usd: loan.closing.cash_to_close })),
          },
        },
      ],
    };
    const prepared = await client.autofill(create);
    ctx.ids.escrowSequence = prepared.Sequence;
    const signed = wallets.buyer.sign(prepared);
    record(ctx, await submitBlob(client, signed.tx_blob, 'escrow', 'EscrowCreate', create.Account));
    await sleep(12_000);
    const finish: EscrowFinish = {
      TransactionType: 'EscrowFinish',
      Account: wallets.title.classicAddress,
      Owner: wallets.buyer.classicAddress,
      OfferSequence: prepared.Sequence!,
    };
    record(ctx, await submit(client, wallets.title, finish, 'escrow'));
  });
}
