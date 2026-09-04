import type { Client } from 'xrpl';
import type { Wallets, TxRecord } from '../xrpl/client.js';
import type { CanonicalLoan } from '../ingest/canonical.js';
import type { BundleManifest } from '../domain/hash.js';

export interface Ctx {
  client: Client;
  wallets: Wallets;
  loan: CanonicalLoan;
  bundle: BundleManifest;
  txs: TxRecord[];
  ids: {
    domainId?: string;
    mptIssuanceId?: string;
    vaultId?: string;
    vaultShareMptId?: string;
    loanBrokerId?: string;
    loanId?: string;
    escrowSequence?: number;
  };
  notes: string[];
  fullLifecycle: boolean;
  log: (msg: string) => void;
}

export const record = (ctx: Ctx, r: import('../xrpl/client.js').TxRecord) => {
  ctx.txs.push(r);
  ctx.log(`    ${r.type.padEnd(24)} ${r.result}  ${r.explorer}`);
  return r;
};

/** Run a non-critical step; record the failure and keep going. */
export async function soft(ctx: Ctx, label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.notes.push(`${label}: ${msg}`);
    ctx.log(`    ! ${label} skipped: ${msg}`);
  }
}
