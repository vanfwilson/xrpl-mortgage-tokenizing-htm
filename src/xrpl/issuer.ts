import { AccountSetAsfFlags, TrustSetFlags, type AccountSet, type TrustSet } from 'xrpl';
export const TEST_USD = 'USD';
/** S5 — this must validate before any TrustSet exists. */
export function buildEnableTrustLineLocking(account: string): AccountSet { return { TransactionType: 'AccountSet', Account: account, SetFlag: AccountSetAsfFlags.asfAllowTrustLineLocking }; }
/** Standard issuer setting required for holder-to-holder issued-currency payments. */
export function buildEnableDefaultRipple(account: string): AccountSet { return { TransactionType: 'AccountSet', Account: account, SetFlag: AccountSetAsfFlags.asfDefaultRipple }; }
export function buildUsdTrustLine(account: string, issuer: string, limit = '1000000000'): TrustSet { return { TransactionType: 'TrustSet', Account: account, LimitAmount: { currency: TEST_USD, issuer, value: limit } }; }
/** Repair an issuer-side NoRipple flag left by a line created before DefaultRipple. */
export function buildClearIssuerNoRipple(issuer: string, holder: string): TrustSet { return { TransactionType: 'TrustSet', Account: issuer, LimitAmount: { currency: TEST_USD, issuer: holder, value: '0' }, Flags: TrustSetFlags.tfClearNoRipple }; }
export function assertIssuerLocking(info: { validated?: boolean; account_flags?: { allowTrustLineLocking?: boolean }; account_data?: { Account?: string; Flags?: number; lsfAllowTrustLineLocking?: boolean } }, expectedIssuer?: string) {
  const set = info.account_flags?.allowTrustLineLocking === true || info.account_data?.lsfAllowTrustLineLocking === true || (((info.account_data?.Flags ?? 0) & 0x40000000) !== 0);
  if (!set) throw new Error('issuer preflight refused: allowTrustLineLocking=false');
  if (expectedIssuer && (info.validated !== true || info.account_data?.Account !== expectedIssuer)) throw new Error('issuer preflight refused: validated issuer identity mismatch');
  return true;
}
