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
  it('S11_every_leg_journaled: every settlement leg carries journal=validated and the restart replay signed nothing', () => {
    const legs = run.transactions.filter((t: any) => String(t.step).startsWith('servicing:'));
    expect(legs.length).toBeGreaterThanOrEqual(75);
    expect(legs.every((t: any) => t.journal === 'validated')).toBe(true);
    expect(run.proofs.S11_journal_restart).toMatch(/^validated [0-9A-F]{64}$/);
  });
  it('R27_multisig_and_R14_event_chain: one signature refused, two validate; event chain verified', () => {
    expect(run.proofs.R27_multisig_one_signer).toMatch(/tefBAD_QUORUM|tem|rejected/);
    expect(run.proofs.R27_multisig_two_signers).toMatch(/^tesSUCCESS [0-9A-F]{64}$/);
    expect(run.proofs.R14_event_chain).toMatch(/^\d+ events, head [0-9a-f]{16}/);
    expect(run.event_log.count).toBeGreaterThanOrEqual(18);
  });
  it('R05_R06_statement_documents_delivered_on_time', () => {
    expect(run.statements.initial_document.kind).toBe('initial_escrow_statement');
    expect(run.statements.initial_delivery.late).toBe(false);
    expect(run.statements.annual_document.kind).toBe('annual_escrow_statement');
    expect(run.statements.annual_delivery.late).toBe(false);
  });
  it('reconciliation: bank = subledger = ledger for every leg', () => {
    expect(run.reconciliation.result.unmatched).toEqual([]);
    expect(run.reconciliation.result.matched.length).toBeGreaterThanOrEqual(75);
  });
});
