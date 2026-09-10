import { NFTokenCreateOfferFlags, NFTokenMintFlags, type NFTokenAcceptOffer, type NFTokenCreateOffer, type NFTokenMint } from 'xrpl';
import { hex } from './client.js';
export interface LoanRecordUri { schema: 'htm.loan-record'; version: 1; loan: string; sha256: string; ptr: string }
export function encodeLoanRecordUri(v: LoanRecordUri) {
  if (!/^[a-f0-9]{64}$/i.test(v.sha256) || !/^[A-Za-z0-9_-]{1,64}$/.test(v.loan)) throw new Error('invalid opaque loan record');
  if (v.schema !== 'htm.loan-record' || v.version !== 1 || !/^ipfs:\/\/[A-Za-z0-9]+$/.test(v.ptr)) throw new Error('content-addressed pointer required');
  const json = JSON.stringify({ schema: v.schema, version: v.version, loan: v.loan, sha256: v.sha256, ptr: v.ptr }); if (Buffer.byteLength(json) > 256) throw new RangeError('NFToken URI exceeds 256 bytes');
  return hex(json);
}
export function buildLoanRecordMint(account: string, uri: LoanRecordUri): NFTokenMint { return { TransactionType: 'NFTokenMint', Account: account, NFTokenTaxon: 0, URI: encodeLoanRecordUri(uri), Flags: NFTokenMintFlags.tfTransferable }; }
export function buildServicingTransferOffer(account: string, nftokenId: string, destination: string): NFTokenCreateOffer { return { TransactionType: 'NFTokenCreateOffer', Account: account, NFTokenID: nftokenId, Amount: '0', Destination: destination, Flags: NFTokenCreateOfferFlags.tfSellNFToken }; }
export function buildAcceptServicingTransfer(account: string, offerId: string): NFTokenAcceptOffer { return { TransactionType: 'NFTokenAcceptOffer', Account: account, NFTokenSellOffer: offerId }; }
