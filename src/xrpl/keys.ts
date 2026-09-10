import { AccountSetAsfFlags, Wallet, multisign, type AccountSet, type Client, type SetRegularKey, type SignerListSet, type TransactionMetadata } from 'xrpl';
import type { Role } from '../config.js';
import { config } from '../config.js';
import { record, type Ctx } from '../steps/context.js';
import { submit, submitExpectingFailure, type TxRecord } from './client.js';

/**
 * R27 / production key management: HSM-held regular keys, 2-of-3 signer lists across bank roles, and
 * lsfDisableMaster only after a recovery drill proves the regular key signs. Manila operators never hold keys.
 */

/** R27/R28: 2-of-3 signer list. Bank-controlled signers only; Manila operator identities never appear here. */
export function buildTwoOfThree(account: string, bankSigners: readonly [string, string, string]): SignerListSet {
  const unique = new Set(bankSigners);
  if (unique.size !== 3) throw new Error('R27: a 2-of-3 signer list needs three distinct signer accounts');
  if (bankSigners.includes(account)) throw new Error('R27: the account cannot be its own signer');
  return {
    TransactionType: 'SignerListSet',
    Account: account,
    SignerQuorum: 2,
    SignerEntries: bankSigners.map((Account) => ({ SignerEntry: { Account, SignerWeight: 1 } })),
  };
}

export async function setSignerList(ctx: Ctx, on: Role, signers: Array<{ role: Role; weight: number }>, quorum: number): Promise<string> {
  const { client, wallets } = ctx;
  const tx: SignerListSet = {
    TransactionType: 'SignerListSet', Account: wallets[on].classicAddress, SignerQuorum: quorum,
    SignerEntries: signers.map((s) => ({ SignerEntry: { Account: wallets[s.role].classicAddress, SignerWeight: s.weight } })),
  };
  return record(ctx, await submit(client, wallets[on], tx, 'keys')).hash;
}

/**
 * Submit an already multisigned blob. With `expectFailure` a non-tes engine result (which xrpl.js surfaces
 * as a thrown error for tef and tem codes that never reach a validated ledger) is captured instead of thrown.
 */
async function submitMultisigned(client: Client, blob: string, step: string, type: string, account: string, expectFailure: boolean): Promise<TxRecord> {
  try {
    const res = await client.submitAndWait(blob);
    const meta = res.result.meta as TransactionMetadata | undefined;
    const result = typeof meta === 'object' && meta ? meta.TransactionResult : 'unknown';
    const rec: TxRecord = { step, type, account, hash: res.result.hash, result, explorer: `${config.explorer}/transactions/${res.result.hash}`, ledgerIndex: res.result.ledger_index, meta };
    if (!expectFailure && result !== 'tesSUCCESS') throw new Error(`${type} (multisigned) failed with ${result} (${rec.explorer})`);
    return rec;
  } catch (e) {
    if (!expectFailure) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    const m = msg.match(/\b(te[cfmls][A-Z_]+)\b/);
    return { step, type, account, hash: '', result: m ? m[1] : `rejected: ${msg.slice(0, 80)}`, explorer: '' };
  }
}

/** Autofilled no-op AccountSet marked for multisigning (SigningPubKey ''), fee sized for up to three signers. */
async function prepareMultisigNoop(client: Client, account: string): Promise<AccountSet> {
  const prepared = await client.autofill<AccountSet>({ TransactionType: 'AccountSet', Account: account, SigningPubKey: '' });
  const baseFee = Number(prepared.Fee ?? '10');
  prepared.Fee = String(Math.max(40, (Number.isFinite(baseFee) ? baseFee : 10) * (1 + 3)));
  return prepared;
}

/** Submit a multisigned blob and return the PRELIMINARY engine result without waiting for a ledger. */
async function submitMultisignedPreliminary(client: Client, blob: string, step: string, type: string, account: string): Promise<TxRecord> {
  try {
    const res = await client.submit(blob);
    const result = res.result.engine_result;
    const hash = (res.result.tx_json as { hash?: string }).hash ?? '';
    return { step, type, account, hash: result === 'tesSUCCESS' ? hash : '', result, explorer: result === 'tesSUCCESS' ? `${config.explorer}/transactions/${hash}` : '' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const m = msg.match(/\b(te[cfmls][A-Z_]+)\b/);
    return { step, type, account, hash: '', result: m ? m[1] : `rejected: ${msg.slice(0, 80)}`, explorer: '' };
  }
}

export interface MultisigDrillResult {
  signerListHash: string;
  /** Engine result of the one-signer attempt (expected tefBAD_QUORUM). */
  oneSignerResult: string;
  /** Validated hash of the two-signer transaction (tesSUCCESS). */
  twoSignersHash: string;
  twoSignersResult: string;
}

/**
 * R27 multisig recovery drill: set a 2-of-3 signer list on `on`, then prove that (i) a no-op AccountSet
 * signed by ONE signer is refused (quorum not met) and (ii) the same transaction signed by TWO signers
 * validates. The master key stays usable; disableMasterDrill is a separate proof.
 */
export async function multisigRecoveryDrill(ctx: Ctx, on: Role, signers: readonly [Role, Role, Role]): Promise<MultisigDrillResult> {
  const { client, wallets } = ctx;
  const account = wallets[on].classicAddress;
  const signerWallets = signers.map((r) => wallets[r]);
  const list = buildTwoOfThree(account, [signerWallets[0].classicAddress, signerWallets[1].classicAddress, signerWallets[2].classicAddress]);
  const signerListHash = record(ctx, await submit(client, wallets[on], list, 'keys:signer-list')).hash;

  // One-signer attempt: submitted WITHOUT waiting for validation. A below-quorum multisig is refused with a
  // tef code at submission time; waiting for it would only burn the LastLedgerSequence window (observed on
  // Testnet 2026-09-10: the two-signer blob then expired with tefMAX_LEDGER). Fee must cover (1 + signers) x base.
  const oneSignerPrepared = await prepareMultisigNoop(client, account);
  const oneSignerBlob = multisign([signerWallets[0].sign(oneSignerPrepared, true).tx_blob]);
  const oneSigner = await submitMultisignedPreliminary(client, oneSignerBlob, 'keys:one-signer-refused', 'AccountSet', account);
  ctx.txs.push(oneSigner);
  ctx.log(`    1-of-3 multisig (below quorum): ${oneSigner.result}`);
  if (oneSigner.result === 'tesSUCCESS') throw new Error('R27: a single signer satisfied a 2-of-3 signer list; drill failed');

  // Two-signer proof: a FRESH autofill so Sequence and LastLedgerSequence reflect the ledger now, both signers
  // sign the same prepared transaction, and validation is awaited.
  const twoSignersPrepared = await prepareMultisigNoop(client, account);
  const twoSignersBlob = multisign([signerWallets[0].sign(twoSignersPrepared, true).tx_blob, signerWallets[1].sign(twoSignersPrepared, true).tx_blob]);
  const twoSigners = record(ctx, await submitMultisigned(client, twoSignersBlob, 'keys:two-signers', 'AccountSet', account, false));
  return { signerListHash, oneSignerResult: oneSigner.result, twoSignersHash: twoSigners.hash, twoSignersResult: twoSigners.result };
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
