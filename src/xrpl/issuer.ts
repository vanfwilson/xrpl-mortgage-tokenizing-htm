import { AccountSetAsfFlags, type AccountSet, type Payment, type TrustSet } from 'xrpl';
import type { Client } from 'xrpl';
import { config, WALLET_ROLES, type Role } from '../config.js';
import { record, type Ctx } from '../steps/context.js';
import { accountFlags, submit, usdAmount } from './client.js';

/**
 * S5: the settlement asset on the test network is a controlled USD issuer created here. Trust-line locking
 * (TokenEscrow for issued currencies) must be enabled on the issuer BEFORE any trust line exists. RLUSD's
 * issuers have this flag off on Mainnet and Testnet (checked 2026-09-08), so RLUSD is never used.
 */
export async function preflightIssuerLocking(client: Client, issuer: string): Promise<{ ok: boolean; flags: Record<string, boolean> }> {
  const flags = await accountFlags(client, issuer);
  return { ok: flags.allowTrustLineLocking === true, flags };
}

export async function bootstrapIssuer(ctx: Ctx): Promise<void> {
  const { client, wallets } = ctx;
  const issuer = wallets.issuer.classicAddress;
  const before = await preflightIssuerLocking(client, issuer);
  if (!before.ok) {
    const lock: AccountSet = { TransactionType: 'AccountSet', Account: issuer, SetFlag: AccountSetAsfFlags.asfAllowTrustLineLocking };
    record(ctx, await submit(client, wallets.issuer, lock, 'issuer'));
  }
  if (!before.flags.defaultRipple) {
    const ripple: AccountSet = { TransactionType: 'AccountSet', Account: issuer, SetFlag: AccountSetAsfFlags.asfDefaultRipple };
    record(ctx, await submit(client, wallets.issuer, ripple, 'issuer'));
  }
  const after = await preflightIssuerLocking(client, issuer);
  if (!after.ok) throw new Error('S5: issuer allowTrustLineLocking is false after AccountSet; refusing to continue');
  ctx.ids.issuer = issuer;
  ctx.log(`    issuer ${issuer} allowTrustLineLocking=${after.ok} defaultRipple=${after.flags.defaultRipple === true} (${config.settlement.label})`);
}

/** Every non-issuer role opens a USD trust line so it can hold, pay and receive escrowed test USD. */
export async function openTrustLines(ctx: Ctx, roles: readonly Role[] = WALLET_ROLES): Promise<void> {
  const { client, wallets } = ctx;
  const issuer = wallets.issuer.classicAddress;
  for (const role of roles) {
    if (role === 'issuer') continue;
    const tx: TrustSet = { TransactionType: 'TrustSet', Account: wallets[role].classicAddress, LimitAmount: { currency: config.settlement.currency, issuer, value: '100000000' } };
    record(ctx, await submit(client, wallets[role], tx, 'issuer'));
  }
}

/** Issue test USD to a role. Test value only: not a deposit, not borrower money. */
export async function issueTestUsd(ctx: Ctx, to: Role, cents: number): Promise<string> {
  const { client, wallets } = ctx;
  const tx: Payment = { TransactionType: 'Payment', Account: wallets.issuer.classicAddress, Destination: wallets[to].classicAddress, Amount: usdAmount(wallets.issuer.classicAddress, cents) };
  return record(ctx, await submit(client, wallets.issuer, tx, 'issuer')).hash;
}
