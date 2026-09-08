import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Live-proof assertions over the latest Testnet loan-year run (out/loan-year/run-*.json produced by
 * `npm run loan-year`). Gated on TESTNET=1 so the offline suite never depends on a network run.
 */
const dir = path.join('out', 'loan-year');
const latest = () => {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
  const runs = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter((r) => r.network === 'testnet');
  return runs.at(-1);
};

describe.skipIf(!process.env.TESTNET)('Testnet loan-year proofs', () => {
  const run = latest();
  it('has a Testnet run with the Mainnet-live transaction types only', () => {
    expect(run).toBeDefined();
    const types = new Set(run.transactions.map((t: any) => t.type));
    for (const t of ['AccountSet', 'TrustSet', 'Payment', 'NFTokenMint', 'NFTokenCreateOffer', 'NFTokenAcceptOffer', 'EscrowCreate', 'EscrowFinish', 'EscrowCancel']) expect(types.has(t), t).toBe(true);
    for (const forbidden of ['VaultCreate', 'LoanSet', 'LoanPay', 'MPTokenIssuanceCreate', 'CredentialCreate', 'PermissionedDomainSet', 'Batch']) expect(types.has(forbidden), forbidden).toBe(false);
  });
  it('T9_issuer_preflight: the controlled issuer allows trust-line locking', () => {
    expect(run.proofs.T9_issuer_preflight).toMatch(/allowTrustLineLocking=true/);
  });
  it('T10_early_finish_refused: EscrowFinish before FinishAfter fails; finishes succeed after; cancel path works', () => {
    expect(run.proofs.T10_early_finish).toMatch(/tecNO_PERMISSION|tefNO_PERMISSION|rejected/);
    const finished = run.escrows.filter((e: any) => e.done && e.done !== 'replay');
    expect(finished.length).toBe(3);
    expect(run.proofs.S7_cancel_after).toMatch(/^[0-9A-F]{64}$/);
  });
  it('every non-proof transaction validated with tesSUCCESS', () => {
    const bad = run.transactions.filter((t: any) => t.result !== 'tesSUCCESS' && !/early-finish|master-refused/.test(t.step));
    expect(bad).toEqual([]);
  });
  it('R11: loan-record NFToken transferred to the successor servicer by zero-price offer', () => {
    expect(run.proofs.R11_nftoken_transfer).toMatch(/^[0-9A-F]{64}$/);
  });
  it('reconciliation: bank = subledger = ledger for every leg', () => {
    expect(run.reconciliation.result.unmatched).toEqual([]);
    expect(run.reconciliation.result.matched.length).toBeGreaterThanOrEqual(75);
  });
});
