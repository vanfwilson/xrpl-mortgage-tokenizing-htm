import { NFTokenCreateOfferFlags, NFTokenMintFlags, getNFTokenID, type NFTokenAcceptOffer, type NFTokenCreateOffer, type NFTokenMint } from 'xrpl';
import type { Role } from '../config.js';
import { record, type Ctx } from '../steps/context.js';
import { createdNodeId, hex, submit } from './client.js';

/**
 * S2: one XLS-20 NFToken per loan as a non-economic digital-twin handle. The URI carries only the schema
 * version, an opaque loan id, the canonical bundle hash and a content-addressed pointer. No principal
 * units, no cash-flow rights. A transfer is an operational servicing hand-off, never a legal ownership change.
 */
export interface LoanRecordUri { v: 1; loan: string; sha256: string; ptr: string }
export const MAX_URI_BYTES = 256;

export function buildRecordUri(u: LoanRecordUri): string {
  if (!/^[0-9a-f]{64}$/.test(u.sha256)) throw new RangeError('sha256 must be 64 lowercase hex chars');
  if (!/^[A-Za-z0-9_\-:.]+$/.test(u.loan) || u.loan.length > 40) throw new RangeError('loan id must be opaque and short');
  const json = JSON.stringify({ v: u.v, loan: u.loan, sha256: u.sha256, ptr: u.ptr });
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > MAX_URI_BYTES) throw new RangeError(`NFToken URI is ${bytes} bytes; limit ${MAX_URI_BYTES}`);
  return json;
}

export async function mintLoanRecord(ctx: Ctx, u: LoanRecordUri, by: Role = 'servicer'): Promise<string> {
  const { client, wallets } = ctx;
  const tx: NFTokenMint = { TransactionType: 'NFTokenMint', Account: wallets[by].classicAddress, NFTokenTaxon: 0, Flags: NFTokenMintFlags.tfTransferable, URI: hex(buildRecordUri(u)) };
  const r = record(ctx, await submit(client, wallets[by], tx, 'record'));
  const id = getNFTokenID(r.meta!);
  if (!id) throw new Error('NFTokenID not found in mint metadata');
  ctx.ids.loanRecordNFTokenId = id;
  return id;
}

/** Zero-price sell offer to a named transferee, accepted by the transferee (S2, R11 hand-off step). */
export async function transferLoanRecord(ctx: Ctx, nftokenId: string, from: Role, to: Role): Promise<{ offer: string; accept: string }> {
  const { client, wallets } = ctx;
  const offer: NFTokenCreateOffer = { TransactionType: 'NFTokenCreateOffer', Account: wallets[from].classicAddress, NFTokenID: nftokenId, Amount: '0', Destination: wallets[to].classicAddress, Flags: NFTokenCreateOfferFlags.tfSellNFToken };
  const r1 = record(ctx, await submit(client, wallets[from], offer, 'record'));
  const offerId = createdNodeId(r1.meta, 'NFTokenOffer');
  const accept: NFTokenAcceptOffer = { TransactionType: 'NFTokenAcceptOffer', Account: wallets[to].classicAddress, NFTokenSellOffer: offerId };
  const r2 = record(ctx, await submit(client, wallets[to], accept, 'record'));
  return { offer: r1.hash, accept: r2.hash };
}
