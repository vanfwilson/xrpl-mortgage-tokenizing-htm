import { AccountSetAsfFlags, TrustSetFlags, type AccountSet, type Payment, type TrustSet } from 'xrpl';
import type { Client } from 'xrpl';
import { config, WALLET_ROLES, type Role } from '../config.js';
import { record, type Ctx } from '../steps/context.js';
import { submit, usdAmount } from './client.js';

/**
 * S5: the settlement asset on the test network is a controlled USD issuer created here. Trust-line locking
 * (TokenEscrow for issued currencies) must be enabled on the issuer BEFORE any trust line exists. RLUSD's
 * issuers have this flag off on Mainnet and Testnet (checked 2026-09-08), so RLUSD is never used.
 */

/** lsfAllowTrustLineLocking bit in AccountRoot.Flags (xrpl.js AccountRootFlags.lsfAllowTrustLineLocking). */
export const LSF_ALLOW_TRUST_LINE_LOCKING = 0x40000000;
export const DEFAULT_TRUST_LIMIT = '100000000';

// ---- pure builders (unit-testable, no network) -------------------------------------------------------

/** S5: must validate before any TrustSet exists. */
export function buildEnableTrustLineLocking(account: string): AccountSet {
  return { TransactionType: 'AccountSet', Account: account, SetFlag: AccountSetAsfFlags.asfAllowTrustLineLocking };
}

/** Standard issuer setting required for holder-to-holder issued-currency payments. */
export function buildEnableDefaultRipple(account: string): AccountSet {
  return { TransactionType: 'AccountSet', Account: account, SetFlag: AccountSetAsfFlags.asfDefaultRipple };
}

/** Holder-side USD trust line to the controlled issuer. */
export function buildUsdTrustLine(account: string, issuer: string, limit: string = DEFAULT_TRUST_LIMIT): TrustSet {
  return { TransactionType: 'TrustSet', Account: account, LimitAmount: { currency: config.settlement.currency, issuer, value: limit } };
}

/**
 * Repair an issuer-side NoRipple flag left on a line that was created before DefaultRipple was set. The
 * issuer submits a TrustSet against the holder with limit 0 (issuers extend no credit) and tfClearNoRipple.
 */
export function buildClearIssuerNoRipple(issuer: string, holder: string): TrustSet {
  return {
    TransactionType: 'TrustSet',
    Account: issuer,
    LimitAmount: { currency: config.settlement.currency, issuer: holder, value: '0' },
    Flags: TrustSetFlags.tfClearNoRipple,
  };
}

// ---- preflight ---------------------------------------------------------------------------------------

/** Minimal structural view of an `account_info` result (xrpl.js AccountInfoResponse['result']). */
export interface AccountInfoLike {
  validated?: boolean;
  account_flags?: { allowTrustLineLocking?: boolean } & Record<string, boolean | undefined>;
  account_data?: { Account?: string; Flags?: number };
}

/**
 * S5 identity + flag check. Throws unless the result is from a VALIDATED ledger, describes exactly the
 * expected issuer account, and has allowTrustLineLocking set (decoded account_flags or raw Flags bit).
 */
export function assertIssuerLocking(info: AccountInfoLike, expectedIssuer: string): true {
  if (info.validated !== true) throw new Error('S5: issuer preflight refused: account_info is not from a validated ledger');
  const account = info.account_data?.Account;
  if (account !== expectedIssuer) throw new Error(`S5: issuer preflight refused: account_info is for ${account ?? 'unknown'}, expected ${expectedIssuer}`);
  const flagSet = info.account_flags?.allowTrustLineLocking === true || ((info.account_data?.Flags ?? 0) & LSF_ALLOW_TRUST_LINE_LOCKING) !== 0;
  if (!flagSet) throw new Error('S5: issuer preflight refused: allowTrustLineLocking=false');
  return true;
}

export interface IssuerPreflight { ok: boolean; flags: Record<string, boolean>; validated: boolean; reason?: string }

export async function preflightIssuerLocking(client: Client, issuer: string): Promise<IssuerPreflight> {
  const res = await client.request({ command: 'account_info', account: issuer, ledger_index: 'validated' });
  const info = res.result as unknown as AccountInfoLike;
  const flags = { ...((info.account_flags ?? {}) as Record<string, boolean>) };
  if (flags.allowTrustLineLocking === undefined) flags.allowTrustLineLocking = ((info.account_data?.Flags ?? 0) & LSF_ALLOW_TRUST_LINE_LOCKING) !== 0;
  const validated = info.validated === true;
  try {
    assertIssuerLocking(info, issuer);
    return { ok: true, flags, validated };
  } catch (e) {
    return { ok: false, flags, validated, reason: e instanceof Error ? e.message : String(e) };
  }
}

// ---- steps -------------------------------------------------------------------------------------------

export async function bootstrapIssuer(ctx: Ctx): Promise<void> {
  const { client, wallets } = ctx;
  const issuer = wallets.issuer.classicAddress;
  const before = await preflightIssuerLocking(client, issuer);
  // Locking flag FIRST (S5: before any trust line), then DefaultRipple.
  if (!before.ok) record(ctx, await submit(client, wallets.issuer, buildEnableTrustLineLocking(issuer), 'issuer'));
  if (!before.flags.defaultRipple) record(ctx, await submit(client, wallets.issuer, buildEnableDefaultRipple(issuer), 'issuer'));
  const after = await preflightIssuerLocking(client, issuer);
  if (!after.ok) throw new Error(after.reason ?? 'S5: issuer allowTrustLineLocking is false after AccountSet; refusing to continue');
  ctx.ids.issuer = issuer;
  ctx.log(`    issuer ${issuer} allowTrustLineLocking=${after.ok} defaultRipple=${after.flags.defaultRipple === true} validated=${after.validated} (${config.settlement.label})`);
}

/** Issuer-side view of one holder's USD line (account_lines from the issuer's perspective). */
async function issuerSideLine(client: Client, issuer: string, holder: string): Promise<{ no_ripple?: boolean } | undefined> {
  const res = await client.request({ command: 'account_lines', account: issuer, peer: holder, ledger_index: 'validated' });
  return res.result.lines.find((l) => l.currency === config.settlement.currency);
}

/**
 * Every non-issuer role opens a USD trust line so it can hold, pay and receive escrowed test USD. After each
 * TrustSet the issuer-side line is inspected: a line created before DefaultRipple carries NoRipple on the
 * issuer side, which would break holder-to-holder payments, so it is repaired with tfClearNoRipple.
 */
export async function openTrustLines(ctx: Ctx, roles: readonly Role[] = WALLET_ROLES): Promise<void> {
  const { client, wallets } = ctx;
  const issuer = wallets.issuer.classicAddress;
  for (const role of roles) {
    if (role === 'issuer') continue;
    const holder = wallets[role].classicAddress;
    record(ctx, await submit(client, wallets[role], buildUsdTrustLine(holder, issuer), 'issuer'));
    const line = await issuerSideLine(client, issuer, holder);
    if (line?.no_ripple === true) {
      ctx.log(`    repairing issuer-side NoRipple on ${role} line (${holder})`);
      record(ctx, await submit(client, wallets.issuer, buildClearIssuerNoRipple(issuer, holder), 'issuer:noripple-repair'));
      const check = await issuerSideLine(client, issuer, holder);
      if (check?.no_ripple === true) throw new Error(`S5: issuer-side NoRipple still set on ${role} line after tfClearNoRipple`);
    }
  }
}

/** Issue test USD to a role. Test value only: not a deposit, not borrower money. */
export async function issueTestUsd(ctx: Ctx, to: Role, cents: number): Promise<string> {
  const { client, wallets } = ctx;
  const tx: Payment = { TransactionType: 'Payment', Account: wallets.issuer.classicAddress, Destination: wallets[to].classicAddress, Amount: usdAmount(wallets.issuer.classicAddress, cents) };
  return record(ctx, await submit(client, wallets.issuer, tx, 'issuer')).hash;
}
