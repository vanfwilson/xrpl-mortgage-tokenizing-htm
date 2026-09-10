import { describe, expect, it } from 'vitest';
import { Client } from 'xrpl';
import { config } from '../../src/config.js';

/** Live check: the amendments this repo depends on are enabled on the target network. */
describe.skipIf(!process.env.DEVNET)('devnet amendments', () => {
  it('has the native servicing rail TokenEscrow and NFToken amendments', async () => {
    const client = new Client('wss://s.devnet.rippletest.net:51233');
    await client.connect();
    const res = await client.request({ command: 'feature' } as never);
    const features = Object.values((res as { result: { features: Record<string, { name: string; enabled: boolean }> } }).result.features);
    const enabled = new Set(features.filter((f) => f.enabled).map((f) => f.name));
    await client.disconnect();
    for (const n of ['NonFungibleTokensV1_1', 'TokenEscrow']) {
      expect(enabled.has(n), n).toBe(true);
    }
  });
});
