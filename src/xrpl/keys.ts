import { AccountSetAsfFlags, type AccountSet, type SetRegularKey, type SignerListSet } from 'xrpl';
/** R27/R28 — Manila operator identities never appear in signer entries. */
export function buildTwoOfThree(account: string, bankSigners: readonly [string, string, string]): SignerListSet { return { TransactionType: 'SignerListSet', Account: account, SignerQuorum: 2, SignerEntries: bankSigners.map((Account) => ({ SignerEntry: { Account, SignerWeight: 1 } })) }; }
export function buildRegularKey(account: string, regularKey: string): SetRegularKey { return { TransactionType: 'SetRegularKey', Account: account, RegularKey: regularKey }; }
export function buildDisableMaster(account: string, recoveryDrillPassed: boolean): AccountSet { if (!recoveryDrillPassed) throw new Error('recovery drill required before disabling master key'); return { TransactionType: 'AccountSet', Account: account, SetFlag: AccountSetAsfFlags.asfDisableMaster }; }
