import { describe, expect, it } from 'vitest';
import { Client } from 'xrpl';
import { config } from '../../src/config.js';

/** Live check: the amendments this repo depends on are enabled on the target network. */
describe.skipIf(!process.env.DEVNET)('network amendments', () => {
  it('has the Mainnet-live amendments the servicing layer uses', async () => {
    const client = new Client(config.wss);
    await client.connect();
    const res = await client.request({ command: 'feature' } as never);
    const features = Object.values((res as { result: { features: Record<string, { name: string; enabled: boolean }> } }).result.features);
    const enabled = new Set(features.filter((f) => f.enabled).map((f) => f.name));
    await client.disconnect();
    for (const n of ['MPTokensV1', 'NonFungibleTokensV1_1', 'TokenEscrow', 'fixTokenEscrowV1', 'Credentials', 'PermissionedDomains']) {
      expect(enabled.has(n), n).toBe(true);
    }
  });
});
