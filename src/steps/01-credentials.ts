import type { CredentialAccept, CredentialCreate, PermissionedDomainSet } from 'xrpl';
import { createdNodeId, hex, submit, TxError, type TxRecord } from '../xrpl/client.js';
import type { SubmittableTransaction, Wallet } from 'xrpl';
import { record, type Ctx } from './context.js';

export const CREDENTIAL_TYPE = hex('HTM_ACCREDITED_KYC_2026');

/** Credentials persist across runs on reused wallets; treat tecDUPLICATE as already done. */
async function submitIdempotent(ctx: Ctx, wallet: Wallet, tx: SubmittableTransaction): Promise<TxRecord> {
  try {
    return record(ctx, await submit(ctx.client, wallet, tx, 'credentials'));
  } catch (e) {
    if (e instanceof TxError && e.record.result === 'tecDUPLICATE') {
      ctx.log(`    ${tx.TransactionType.padEnd(24)} already exists (tecDUPLICATE), continuing`);
      return e.record;
    }
    throw e;
  }
}

/**
 * Investor eligibility as on-ledger credentials (XLS-70) gathered into a
 * permissioned domain (XLS-80). The vault and, in production, the MPT use
 * this domain so only attested holders can participate.
 */
export async function setupCredentialsAndDomain(ctx: Ctx): Promise<void> {
  const { client, wallets } = ctx;
  for (const role of ['investorA', 'investorB'] as const) {
    const create: CredentialCreate = {
      TransactionType: 'CredentialCreate',
      Account: wallets.kyc.classicAddress,
      Subject: wallets[role].classicAddress,
      CredentialType: CREDENTIAL_TYPE,
      URI: hex('https://hightechmortgage.com/kyc/demo'),
    };
    await submitIdempotent(ctx, wallets.kyc, create);
    const accept: CredentialAccept = {
      TransactionType: 'CredentialAccept',
      Account: wallets[role].classicAddress,
      Issuer: wallets.kyc.classicAddress,
      CredentialType: CREDENTIAL_TYPE,
    };
    await submitIdempotent(ctx, wallets[role], accept);
  }
  const domain: PermissionedDomainSet = {
    TransactionType: 'PermissionedDomainSet',
    Account: wallets.broker.classicAddress, // domain, vault and LoanBroker share one owner (XLS-66 rule)
    AcceptedCredentials: [
      { Credential: { Issuer: wallets.kyc.classicAddress, CredentialType: CREDENTIAL_TYPE } },
    ],
  };
  const r = record(ctx, await submit(client, wallets.broker, domain, 'credentials'));
  ctx.ids.domainId = createdNodeId(r.meta, 'PermissionedDomain');
  ctx.log(`    DomainID ${ctx.ids.domainId}`);
}
