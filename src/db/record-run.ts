/**
 * Mirror a Devnet run into htm_mortgages (xrpl_objects, xrpl_transactions, servicing tx hashes,
 * impound escrow hashes). Ledger stays authoritative; this is the reconciliation copy.
 * usage: npm run db:record [out/run-<ts>.json] | scripts/db-apply.sh -
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { HTM_COMPANY_ID, SAMPLE_LOAN_ID } from './seed.js';

const q = (v: unknown) => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;

const file = process.argv[2] ?? fs.readdirSync(config.outDir).filter((f) => /^run-.*\.json$/.test(f)).sort().map((f) => path.join(config.outDir, f)).at(-1);
if (!file) throw new Error('no run file');
const run = JSON.parse(fs.readFileSync(file, 'utf8'));
const C = q(HTM_COMPANY_ID), L = q(SAMPLE_LOAN_ID);
const net = /devnet/.test(run.network) ? 'devnet' : /altnet|testnet/.test(run.network) ? 'testnet' : 'mainnet';
const out: string[] = ['begin;', 'set search_path = htm_mortgages, public;'];
const objs: Array<[string, string | undefined, string | undefined]> = [
  ['permissioned_domain', run.ids.domainId, run.accounts.broker],
  ['mpt_issuance', run.ids.mptIssuanceId, run.accounts.issuer],
  ['vault', run.ids.vaultId, run.accounts.broker],
  ['vault_share_mpt', run.ids.vaultShareMptId, undefined],
  ['loan_broker', run.ids.loanBrokerId, run.accounts.broker],
  ['loan', run.ids.loanId, run.accounts.servicer],
];
for (const [kind, id, owner] of objs) {
  if (!id) continue;
  out.push(`insert into xrpl_objects (company_id, loan_id, network, kind, ledger_id, owner_address, docs_sha256, details) values (${C}, ${L}, ${q(net)}, ${q(kind)}, ${q(id)}, ${q(owner ?? null)}, ${q(run.document_bundle_sha256)}, ${j({ ran_at: run.ran_at, accounts: run.accounts })}) on conflict (network, kind, ledger_id) do update set details = excluded.details;`);
}
for (const t of run.transactions) {
  out.push(`insert into xrpl_transactions (tx_hash, company_id, loan_id, network, step, tx_type, account, result, ledger_index, explorer_url) values (${q(t.hash)}, ${C}, ${L}, ${q(net)}, ${q(t.step)}, ${q(t.type)}, ${q(t.account)}, ${q(t.result)}, ${q(t.ledgerIndex ?? null)}, ${q(t.explorer)}) on conflict (tx_hash) do nothing;`);
}
// Servicing legs: sweep(Payment homeowner) -> LoanPay -> Payment tax -> Payment insurance, repeated per period.
const legs = run.transactions.filter((t: any) => t.step === 'servicing' && ['Payment', 'LoanPay'].includes(t.type));
let period = 0;
for (let i = 0; i + 3 < legs.length + 1 && legs[i]?.type === 'Payment' && legs[i]?.account === run.accounts.homeowner; i += 4) {
  period += 1;
  const [sweep, pi, tax, ins] = legs.slice(i, i + 4);
  out.push(`update servicing_payments set sweep_tx_hash = ${q(sweep.hash)}, pi_tx_hash = ${q(pi?.hash)}, tax_tx_hash = ${q(tax?.hash)}, insurance_tx_hash = ${q(ins?.hash)}, status = 'remitted', received_at = coalesce(received_at, now()), amount_received = coalesce(amount_received, amount_due) where loan_id = ${L} and period_no = ${period};`);
}
const esc = run.transactions.filter((t: any) => t.type === 'EscrowCreate');
for (const e of esc) {
  const kind = e.account === run.accounts.taxImpound ? 'tax' : e.account === run.accounts.insuranceImpound ? 'insurance' : null;
  if (!kind) continue;
  out.push(`update impound_accounts set xrpl_address = ${q(e.account)}, payee_xrpl_address = ${q(kind === 'tax' ? run.accounts.countyTreasurer : run.accounts.insuranceCarrier)} where loan_id = ${L} and kind = ${q(kind)};`);
  out.push(`update impound_disbursements d set status = 'escrowed', escrow_tx_hash = ${q(e.hash)} from impound_accounts a where a.impound_id = d.impound_id and a.loan_id = ${L} and a.kind = ${q(kind)} and d.due_date = (select min(due_date) from impound_disbursements d2 where d2.impound_id = a.impound_id and d2.status = 'scheduled');`);
}
out.push('commit;');
process.stdout.write(out.join('\n') + '\n');
