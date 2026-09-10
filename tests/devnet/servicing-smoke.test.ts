import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Client, type TransactionMetadata } from 'xrpl';
import { buildEnableTrustLineLocking, buildEnableDefaultRipple, buildUsdTrustLine } from '../../src/xrpl/issuer.js';
import { buildTokenEscrow, buildEscrowFinish } from '../../src/xrpl/escrow.js';

describe.skipIf(!process.env.DEVNET)('Devnet compressed smoke (not Mainnet evidence)', () => {
  it('validates issued USD and a short token escrow window', async () => {
    const client = new Client('wss://s.devnet.rippletest.net:51233');
    const records: unknown[] = [];
    await client.connect();
    try {
      const issuer = (await client.fundWallet()).wallet;
      const owner = (await client.fundWallet()).wallet;
      const payee = (await client.fundWallet()).wallet;
      const send = async (wallet: typeof issuer, tx: any) => {
        const prepared = await client.autofill(tx);
        const result = (await client.submitAndWait(wallet.sign(prepared).tx_blob)).result;
        expect((result.meta as TransactionMetadata).TransactionResult).toBe('tesSUCCESS');
        records.push({ hash: result.hash, type: tx.TransactionType, ledger: result.ledger_index, tx: prepared });
        return prepared.Sequence!;
      };
      await send(issuer, buildEnableTrustLineLocking(issuer.classicAddress));
      await send(issuer, buildEnableDefaultRipple(issuer.classicAddress));
      await send(owner, buildUsdTrustLine(owner.classicAddress, issuer.classicAddress));
      await send(payee, buildUsdTrustLine(payee.classicAddress, issuer.classicAddress));
      await send(issuer, { TransactionType: 'Payment', Account: issuer.classicAddress, Destination: owner.classicAddress, Amount: { currency: 'USD', issuer: issuer.classicAddress, value: '1' } });
      const issuerInfo = (await client.request({ command: 'account_info', account: issuer.classicAddress, ledger_index: 'validated' })).result;
      const now = Math.floor(Date.now()/1000);
      const sequence = await send(owner, buildTokenEscrow({ account: owner.classicAddress, destination: payee.classicAddress, issuer: issuer.classicAddress, amountCents: 100, finishAfterUnix: now+15, cancelAfterUnix: now+180, issuerInfo: issuerInfo as never, allowlist: [payee.classicAddress] }));
      await new Promise(r=>setTimeout(r, 20000));
      await send(owner, buildEscrowFinish(owner.classicAddress, owner.classicAddress, sequence));
      fs.mkdirSync('out', { recursive: true });
      fs.writeFileSync('out/devnet-smoke.json', JSON.stringify({ network: 'devnet', generatedAt: new Date().toISOString(), transactions: records }, null, 2));
    } finally { await client.disconnect(); }
  });
});
