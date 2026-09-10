import type { Client } from 'xrpl';
import type { Wallets, TxRecord } from '../xrpl/client.js';
import type { CanonicalLoan } from '../ingest/canonical.js';
import type { BundleManifest } from '../domain/hash.js';
import type { SettlementStore } from '../xrpl/settlement-journal.js';

export interface Ctx {
  client: Client;
  wallets: Wallets;
  loan: CanonicalLoan;
  bundle: BundleManifest;
  txs: TxRecord[];
  /** Ledger object identifiers produced by the run (NFTokenID, escrow object ids, issuer address...). */
  ids: Record<string, string | undefined>;
  notes: string[];
  log: (msg: string) => void;
  /** S11 settlement journal: every leg is signed once and persisted before submission. */
  journal?: SettlementStore;
  tenant?: { companyId: string; loanId: string };
}

export const record = (ctx: Ctx, r: TxRecord) => {
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
