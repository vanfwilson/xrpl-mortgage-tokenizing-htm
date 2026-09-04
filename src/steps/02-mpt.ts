import {
  MPTokenIssuanceCreateFlags as F,
  type MPTokenAuthorize,
  type MPTokenIssuanceCreate,
  type Payment,
} from 'xrpl';
import { buildMptMetadata, encodeMetadataHex } from '../domain/metadata.js';
import { usdToMptUnits } from '../domain/loan-math.js';
import { hex, submit } from '../xrpl/client.js';
import { record, type Ctx } from './context.js';

/**
 * The note becomes ONE MPT issuance (XLS-33). Units are USD cents of unpaid
 * principal, so MaximumAmount == 45,000,000 for a $450,000.00 note. Holders
 * own a pro-rata participation in that note's cash flows; the token does not
 * replace the promissory note or the recorded Deed of Trust.
 */
export async function issueNoteToken(ctx: Ctx): Promise<void> {
  const { client, wallets, loan } = ctx;
  const meta = buildMptMetadata(loan, ctx.bundle.bundle_sha256);
  const create: MPTokenIssuanceCreate = {
    TransactionType: 'MPTokenIssuanceCreate',
    Account: wallets.issuer.classicAddress,
    AssetScale: 2,
    MaximumAmount: usdToMptUnits(loan.loan.principal_amount, 2),
    TransferFee: 0,
    MPTokenMetadata: encodeMetadataHex(meta),
    // RequireAuth = allow-list; CanLock = servicer freeze; CanClawback = court order /
    // error correction; CanEscrow = XLS-85 token escrow; CanTransfer = secondary.
    Flags: F.tfMPTRequireAuth | F.tfMPTCanLock | F.tfMPTCanClawback | F.tfMPTCanEscrow | F.tfMPTCanTransfer,
  };
  const r = record(ctx, await submit(client, wallets.issuer, create, 'mpt'));
  const id = (r.meta as { mpt_issuance_id?: string } | undefined)?.mpt_issuance_id;
  if (!id) throw new Error('mpt_issuance_id missing from MPTokenIssuanceCreate metadata');
  ctx.ids.mptIssuanceId = id;
  ctx.log(`    MPTokenIssuanceID ${id}  (${Buffer.byteLength(JSON.stringify(meta))} bytes metadata)`);

  // Two-sided authorization: holder opts in, issuer allow-lists the holder.
  const split: Array<[keyof typeof wallets, number]> = [['investorA', 0.6], ['investorB', 0.4]];
  for (const [role] of split) {
    const optIn: MPTokenAuthorize = {
      TransactionType: 'MPTokenAuthorize',
      Account: wallets[role].classicAddress,
      MPTokenIssuanceID: id,
    };
    record(ctx, await submit(client, wallets[role], optIn, 'mpt'));
    const allow: MPTokenAuthorize = {
      TransactionType: 'MPTokenAuthorize',
      Account: wallets.issuer.classicAddress,
      MPTokenIssuanceID: id,
      Holder: wallets[role].classicAddress,
    };
    record(ctx, await submit(client, wallets.issuer, allow, 'mpt'));
  }

  // Distribute participations. Memo binds the transfer to the document bundle.
  for (const [role, share] of split) {
    const pay: Payment = {
      TransactionType: 'Payment',
      Account: wallets.issuer.classicAddress,
      Destination: wallets[role].classicAddress,
      Amount: { mpt_issuance_id: id, value: usdToMptUnits(loan.loan.principal_amount * share, 2) },
      Memos: [
        {
          Memo: {
            MemoType: hex('htm/participation'),
            MemoData: hex(JSON.stringify({ loan_id: loan.loan.loan_id, share, docs_sha256: ctx.bundle.bundle_sha256 })),
          },
        },
      ],
    };
    record(ctx, await submit(client, wallets.issuer, pay, 'mpt'));
  }
}
