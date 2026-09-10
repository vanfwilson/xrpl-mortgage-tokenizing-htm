import type { EscrowCancel, EscrowCreate, EscrowFinish, IssuedCurrencyAmount } from 'xrpl';
import { toRippleTime } from './client.js';
import { assertIssuerLocking } from './issuer.js';
export function buildTokenEscrow(input: { account: string; destination: string; issuer: string; amountCents: number; finishAfterUnix: number; cancelAfterUnix: number; issuerInfo: Parameters<typeof assertIssuerLocking>[0]; allowlist: readonly string[] }): EscrowCreate {
  assertIssuerLocking(input.issuerInfo);
  if (!input.allowlist.includes(input.destination)) throw new Error('escrow destination not allowlisted');
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || input.cancelAfterUnix <= input.finishAfterUnix) throw new RangeError('invalid escrow amount/window');
  const amount: IssuedCurrencyAmount = { currency: 'USD', issuer: input.issuer, value: (input.amountCents / 100).toFixed(2) };
  return { TransactionType: 'EscrowCreate', Account: input.account, Destination: input.destination, Amount: amount, FinishAfter: toRippleTime(input.finishAfterUnix), CancelAfter: toRippleTime(input.cancelAfterUnix) };
}
export function buildEscrowFinish(account: string, owner: string, offerSequence: number): EscrowFinish { return { TransactionType: 'EscrowFinish', Account: account, Owner: owner, OfferSequence: offerSequence }; }
export function buildEscrowCancel(account: string, owner: string, offerSequence: number): EscrowCancel { return { TransactionType: 'EscrowCancel', Account: account, Owner: owner, OfferSequence: offerSequence }; }
export const escrowOwnerReserveDrops = (count: number) => { if (!Number.isInteger(count) || count < 0) throw new RangeError('count'); return count * 200_000; };
