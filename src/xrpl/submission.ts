import type { Client, Payment, TransactionMetadata, Wallet } from 'xrpl';
import type { SettlementTransport } from './settlement-journal.js';

const engineResult = (meta: unknown): string =>
  typeof meta === 'object' && meta !== null && 'TransactionResult' in meta ? (meta as TransactionMetadata).TransactionResult : 'unknown';

/**
 * Ledger transport for the settlement journal. Run one sequenced sender per account.
 * `prepare` autofills + signs exactly once; `submitOrFind` first asks the ledger for the
 * stored hash (survives timeouts and restarts) and only then submits the same blob.
 */
export class XrplSettlementTransport implements SettlementTransport {
  constructor(private readonly client: Client, private readonly wallet: Wallet) {}

  async prepare(tx: Payment): Promise<{ signedBlob: string; hash: string }> {
    const signed = this.wallet.sign(await this.client.autofill(tx));
    return { signedBlob: signed.tx_blob, hash: signed.hash };
  }

  async submitOrFind(blob: string, hash: string): Promise<{ validated: boolean; result: string }> {
    try {
      const found = (await this.client.request({ command: 'tx', transaction: hash })).result;
      if (found.validated) return { validated: true, result: engineResult(found.meta) };
    } catch (error) {
      if ((error as { data?: { error?: string } }).data?.error !== 'txnNotFound') throw error;
    }
    const submitted = (await this.client.submitAndWait(blob)).result;
    return { validated: submitted.validated === true, result: engineResult(submitted.meta) };
  }
}
