import { Client, Wallet, type Payment, type TransactionMetadata } from 'xrpl';
import type { SettlementTransport } from './settlement-journal.js';

/** Run one sequenced sender worker per account. Stored signed blobs survive
 * network timeouts; an unknown hash is submitted without rebuilding the tx. */
export class XrplSettlementTransport implements SettlementTransport {
  constructor(private readonly client:Client,private readonly wallet:Wallet) {}
  async prepare(tx:Payment) {
    const signed=this.wallet.sign(await this.client.autofill(tx));
    return {signedBlob:signed.tx_blob,hash:signed.hash};
  }
  async submitOrFind(blob:string,hash:string) {
    try {
      const found=(await this.client.request({command:'tx',transaction:hash})).result;
      if(found.validated)return {validated:true,result:(found.meta as TransactionMetadata).TransactionResult};
    } catch(error) {
      if((error as {data?:{error?:string}}).data?.error!=='txnNotFound')throw error;
    }
    const submitted=(await this.client.submitAndWait(blob)).result;
    return {validated:submitted.validated===true,result:(submitted.meta as TransactionMetadata).TransactionResult};
  }
}
