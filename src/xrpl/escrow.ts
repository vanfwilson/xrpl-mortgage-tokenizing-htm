import type { EscrowCancel, EscrowCreate, EscrowFinish } from 'xrpl';
import type { Role } from '../config.js';
import { record, type Ctx } from '../steps/context.js';
import { sleep, submit, submitExpectingFailure, TxError, usdAmount } from './client.js';
import { preflightIssuerLocking } from './issuer.js';
import { buildMemo, type LegMemo } from './settle.js';

/**
 * S7: native TokenEscrow as the date lock for one verified near-term impound bill. FinishAfter is immutable;
 * CancelAfter is bounded; the destination must be on the payee allowlist; the issuer must allow trust-line
 * locking (S5) or the build is refused before anything is signed.
 */
export const OWNER_RESERVE_DROPS_PER_OBJECT = 200_000; // 0.2 XRP (Mainnet and Testnet, 2026-09-08)
export const reserveForObjects = (n: number) => n * OWNER_RESERVE_DROPS_PER_OBJECT;

export interface EscrowBuild { from: Role; to: Role; cents: number; finish_after: number; cancel_after: number; memo: LegMemo; allowlist: readonly Role[] }

export function validateEscrowBuild(b: EscrowBuild): void {
  if (!b.allowlist.includes(b.to)) throw new Error(`S7: destination role '${b.to}' is not on the payee allowlist`);
  if (b.cancel_after <= b.finish_after) throw new RangeError('S7: CancelAfter must be after FinishAfter');
  if (!Number.isInteger(b.cents) || b.cents <= 0) throw new RangeError('escrow amount must be positive integer cents');
  buildMemo(b.memo);
}

export async function createImpoundEscrow(ctx: Ctx, b: EscrowBuild): Promise<{ hash: string; owner: string; sequence: number }> {
  validateEscrowBuild(b);
  const { client, wallets } = ctx;
  const issuer = wallets.issuer.classicAddress;
  const pre = await preflightIssuerLocking(client, issuer);
  if (!pre.ok) throw new Error(`S5: issuer ${issuer} allowTrustLineLocking=false; refusing to build a TokenEscrow`);
  const tx: EscrowCreate = {
    TransactionType: 'EscrowCreate', Account: wallets[b.from].classicAddress, Destination: wallets[b.to].classicAddress,
    Amount: usdAmount(issuer, b.cents), FinishAfter: b.finish_after, CancelAfter: b.cancel_after, Memos: buildMemo(b.memo),
  };
  const r = record(ctx, await submit(client, wallets[b.from], tx, 'escrow'));
  if (r.sequence === undefined) throw new Error('EscrowCreate sequence missing');
  return { hash: r.hash, owner: tx.Account, sequence: r.sequence };
}

export async function finishEscrow(ctx: Ctx, by: Role, owner: string, sequence: number): Promise<string> {
  const { client, wallets } = ctx;
  const tx: EscrowFinish = { TransactionType: 'EscrowFinish', Account: wallets[by].classicAddress, Owner: owner, OfferSequence: sequence };
  // The date lock is evaluated against the parent ledger's close time (10 s resolution); retry briefly if we are early.
  for (let attempt = 1; ; attempt++) {
    try { return record(ctx, await submit(client, wallets[by], tx, 'escrow')).hash; }
    catch (e) {
      if (e instanceof TxError && e.record.result === 'tecNO_PERMISSION' && attempt < 4) { ctx.log(`    EscrowFinish early by ledger clock; retry ${attempt}`); await sleep(12_000); continue; }
      throw e;
    }
  }
}

/** Proof that the date lock holds: an EscrowFinish before FinishAfter must fail. */
export async function attemptEarlyFinish(ctx: Ctx, by: Role, owner: string, sequence: number): Promise<string> {
  const { client, wallets } = ctx;
  const tx: EscrowFinish = { TransactionType: 'EscrowFinish', Account: wallets[by].classicAddress, Owner: owner, OfferSequence: sequence };
  const r = await submitExpectingFailure(client, wallets[by], tx, 'escrow:early-finish');
  ctx.txs.push(r);
  ctx.log(`    EscrowFinish (early)      ${r.result}`);
  return r.result;
}

export async function cancelEscrow(ctx: Ctx, by: Role, owner: string, sequence: number): Promise<string> {
  const { client, wallets } = ctx;
  const tx: EscrowCancel = { TransactionType: 'EscrowCancel', Account: wallets[by].classicAddress, Owner: owner, OfferSequence: sequence };
  for (let attempt = 1; ; attempt++) {
    try { return record(ctx, await submit(client, wallets[by], tx, 'escrow')).hash; }
    catch (e) {
      if (e instanceof TxError && e.record.result === 'tecNO_PERMISSION' && attempt < 4) { ctx.log(`    EscrowCancel early by ledger clock; retry ${attempt}`); await sleep(12_000); continue; }
      throw e;
    }
  }
}
