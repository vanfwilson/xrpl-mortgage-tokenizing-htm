import { VaultCreateFlags, VaultWithdrawalPolicy, type VaultCreate, type VaultDeposit } from 'xrpl';
import type { Vault } from 'xrpl/dist/npm/models/ledger/index.js';
import { createdNodeId, hex, ledgerEntry, submit, xrpToDrops } from '../xrpl/client.js';
import { record, type Ctx } from './context.js';

/**
 * Funding side (XLS-65). A private Single Asset Vault gated by the KYC domain
 * pools depositor capital. On Devnet the asset is XRP standing in for a
 * dollar stablecoin such as RLUSD; 1 XRP == US$10,000 at demo scale.
 */
export async function createFundingVault(ctx: Ctx): Promise<void> {
  const { client, wallets } = ctx;
  const create: VaultCreate = {
    TransactionType: 'VaultCreate',
    Account: wallets.broker.classicAddress, // LoanBrokerSet requires Account == Vault.Owner
    Asset: { currency: 'XRP' },
    Flags: VaultCreateFlags.tfVaultPrivate,
    DomainID: ctx.ids.domainId!,
    WithdrawalPolicy: VaultWithdrawalPolicy.vaultStrategyFirstComeFirstServe,
    AssetsMaximum: '0',
    Data: hex(JSON.stringify({ n: 'HTM Warehouse Funding Vault (Devnet)', w: 'https://hightechmortgage.com/tokenized-mortgages/' })),
  };
  const r = record(ctx, await submit(client, wallets.broker, create, 'vault'));
  ctx.ids.vaultId = createdNodeId(r.meta, 'Vault');
  const vault = await ledgerEntry<Vault>(client, ctx.ids.vaultId);
  ctx.ids.vaultShareMptId = vault.ShareMPTID;
  ctx.log(`    VaultID ${ctx.ids.vaultId}`);
  ctx.log(`    share MPT ${vault.ShareMPTID}`);

  for (const role of ['investorA', 'investorB'] as const) {
    const dep: VaultDeposit = {
      TransactionType: 'VaultDeposit',
      Account: wallets[role].classicAddress,
      VaultID: ctx.ids.vaultId,
      Amount: xrpToDrops(30), // 30 XRP each == $300,000 demo scale
    };
    record(ctx, await submit(client, wallets[role], dep, 'vault'));
  }
  const after = await ledgerEntry<Vault>(client, ctx.ids.vaultId);
  ctx.log(`    vault AssetsTotal ${after.AssetsTotal} drops, AssetsAvailable ${after.AssetsAvailable}`);
}
