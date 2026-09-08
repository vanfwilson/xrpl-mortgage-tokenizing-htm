import { AccountSetAsfFlags, Wallet, type AccountSet, type SetRegularKey, type SignerListSet } from 'xrpl';
import type { Role } from '../config.js';
import { record, type Ctx } from '../steps/context.js';
import { submit, submitExpectingFailure } from './client.js';

/**
 * R27 / production key management: HSM-held regular keys, 2-of-3 signer lists across bank roles, and
 * lsfDisableMaster only after a recovery drill proves the regular key signs. Manila operators never hold keys.
 */
export async function setSignerList(ctx: Ctx, on: Role, signers: Array<{ role: Role; weight: number }>, quorum: number): Promise<string> {
  const { client, wallets } = ctx;
  const tx: SignerListSet = {
    TransactionType: 'SignerListSet', Account: wallets[on].classicAddress, SignerQuorum: quorum,
    SignerEntries: signers.map((s) => ({ SignerEntry: { Account: wallets[s.role].classicAddress, SignerWeight: s.weight } })),
  };
  return record(ctx, await submit(client, wallets[on], tx, 'keys')).hash;
}

/**
 * Recovery drill on a role account: set a regular key, prove it signs, disable the master, prove the master
 * no longer signs. Returns the regular-key wallet so the caller can keep signing for that role.
 */
export async function disableMasterDrill(ctx: Ctx, on: Role): Promise<{ regular: Wallet; hashes: { setRegularKey: string; regularKeyProof: string; disableMaster: string; masterRefused: string } }> {
  const { client, wallets } = ctx;
  const master = wallets[on];
  const regular = Wallet.generate();
  const set: SetRegularKey = { TransactionType: 'SetRegularKey', Account: master.classicAddress, RegularKey: regular.classicAddress };
  const h1 = record(ctx, await submit(client, master, set, 'keys')).hash;
  // Proof: a no-op AccountSet signed by the regular key (same account address).
  const regularSigner = Wallet.fromSeed(regular.seed!, { masterAddress: master.classicAddress });
  const proof: AccountSet = { TransactionType: 'AccountSet', Account: master.classicAddress };
  const h2 = record(ctx, await submit(client, regularSigner, proof, 'keys')).hash;
  const disable: AccountSet = { TransactionType: 'AccountSet', Account: master.classicAddress, SetFlag: AccountSetAsfFlags.asfDisableMaster };
  const h3 = record(ctx, await submit(client, master, disable, 'keys')).hash;
  const refused = await submitExpectingFailure(client, master, { TransactionType: 'AccountSet', Account: master.classicAddress } as AccountSet, 'keys:master-refused');
  ctx.txs.push(refused);
  ctx.log(`    master key after lsfDisableMaster: ${refused.result}`);
  wallets[on] = regularSigner;
  return { regular: regularSigner, hashes: { setRegularKey: h1, regularKeyProof: h2, disableMaster: h3, masterRefused: refused.result } };
}
