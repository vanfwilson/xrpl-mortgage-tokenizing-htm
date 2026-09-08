/**
 * Mirror a loan-year run into htm_mortgages (xrpl_objects, xrpl_transactions, subledger legs, escrow bills,
 * reconciliation events). The bank's books stay authoritative; this is the reconciliation copy.
 * usage: npm run db:record [out/loan-year/run-<id>.json] | scripts/db-apply.sh -
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { HTM_COMPANY_ID, SAMPLE_LOAN_ID } from './seed.js';

const q = (v: unknown) => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;

const dir = path.join(config.outDir, 'loan-year');
const file = process.argv[2] ?? (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(dir, f)).at(-1) : undefined);
if (!file) throw new Error('no loan-year run file');
const run = JSON.parse(fs.readFileSync(file, 'utf8'));
const C = q(HTM_COMPANY_ID), L = q(SAMPLE_LOAN_ID);
const net = run.network === 'replay' ? 'testnet' : run.network;
const out: string[] = ['begin;', 'set search_path = htm_mortgages, public;'];

if (run.ids?.loanRecordNFTokenId) {
  out.push(`insert into xrpl_objects (company_id, loan_id, network, kind, ledger_id, owner_address, docs_sha256, details) values (${C}, ${L}, ${q(net)}, 'nftoken', ${q(run.ids.loanRecordNFTokenId)}, ${q(run.accounts.servicer ?? null)}, ${q(run.document_bundle_sha256)}, ${j({ ran_at: run.ran_at, run: run.run })}) on conflict (network, kind, ledger_id) do update set details = excluded.details;`);
  out.push(`insert into loan_document_versions (company_id, loan_id, version, bundle_sha256, pointer, effective_from, nftoken_id) values (${C}, ${L}, 1, ${q(run.document_bundle_sha256)}, ${q(`cas://htm/${run.loan}/v1`)}, ${q(run.boarding.terms.origination_date)}, ${q(run.ids.loanRecordNFTokenId)}) on conflict (loan_id, version) do update set nftoken_id = excluded.nftoken_id;`);
}
for (const t of run.transactions ?? []) {
  if (!t.hash) continue;
  out.push(`insert into xrpl_transactions (tx_hash, company_id, loan_id, network, step, tx_type, account, result, ledger_index, explorer_url) values (${q(t.hash)}, ${C}, ${L}, ${q(net)}, ${q(t.step)}, ${q(t.type)}, ${q(t.account)}, ${q(t.result)}, ${q(t.ledgerIndex ?? null)}, ${q(t.explorer)}) on conflict (tx_hash) do nothing;`);
}
for (const p of run.periods ?? []) {
  const l = p.legs;
  out.push(`update servicing_payments set status = 'remitted', received_at = ${q(p.received + 'T15:00:00Z')}, amount_received = ${p.total_due_cents / 100}, principal_part = ${l.principal / 100}, interest_part = ${l.interest / 100}, pi_part = ${(l.principal + l.interest) / 100}, tax_part = ${l.tax / 100}, insurance_part = ${(l.hazard + l.mip) / 100}, escrow_part = ${(l.tax + l.hazard) / 100} where loan_id = ${L} and period_no = ${p.period};`);
  for (const [account, cents, leg] of [['note_holder', l.principal, 'principal'], ['note_holder', l.interest, 'interest'], ['tax', l.tax, 'escrow_deposit'], ['hazard', l.hazard, 'escrow_deposit'], ['mip', l.mip, 'mip_deposit']] as const) {
    out.push(`insert into subledger_entries (company_id, loan_id, account, cents, leg, period_no, effective_date, bank_ref) values (${C}, ${L}, ${q(account)}, ${cents}, ${q(leg)}, ${p.period}, ${q(p.received)}, ${q(`ach:${p.due.slice(0, 7)}`)});`);
  }
}
for (const e of run.escrows ?? []) {
  const d = (run.disbursements ?? []).find((x: any) => x.due_date === e.due && x.purpose === e.purpose);
  out.push(`insert into escrow_bills (company_id, loan_id, purpose, payee_id, cents, due_date, verified, source_ref, decision, escrow_create_hash, escrow_finish_hash, escrow_cancel_hash, finish_after, cancel_after) values (${C}, ${L}, ${q(e.purpose)}, ${q(e.to)}, ${e.cents}, ${q(e.due)}, true, ${q(d?.source_ref ?? null)}, ${q(d?.decision?.action ?? null)}, ${q(e.hash === 'replay' ? null : e.hash)}, ${q(e.done && e.done !== 'replay' ? e.done : null)}, ${q(e.cancelled ?? null)}, to_timestamp(${e.finish_after + 946_684_800}), to_timestamp(${e.cancel_after + 946_684_800})) on conflict (loan_id, purpose, due_date) do update set escrow_create_hash = excluded.escrow_create_hash, escrow_finish_hash = excluded.escrow_finish_hash, decision = excluded.decision;`);
}
for (const a of run.advances ?? []) out.push(`insert into servicer_advances (company_id, loan_id, cents, advanced_on, recovery_option, recovery_months) values (${C}, ${L}, ${a.cents}, ${q(a.on)}, 'equal_monthly_payments', 12);`);
if (run.year_end?.analysis) {
  const a = run.year_end.analysis;
  out.push(`insert into escrow_analyses (company_id, loan_id, computation_year_start, computation_year_end, analysis, classification, chosen_shortage_months, new_monthly_escrow_cents, california_interest_cents) values (${C}, ${L}, ${q(a.computation_year_start)}, ${q(a.computation_year_end)}, ${j(a)}, ${q(a.classification)}, ${run.year_end.recovery?.shortage_months ?? 'null'}, ${run.year_end.year_two_monthly_escrow_cents}, ${run.year_end.california_interest_cents ?? 0}) on conflict (loan_id, computation_year_start) do update set analysis = excluded.analysis;`);
}
for (const f of run.form_1098 ?? []) out.push(`insert into tax_forms (company_id, loan_id, tax_year, form, required, content) values (${C}, ${L}, ${f.year}, '1098', ${f.required}, ${j(f)}) on conflict (loan_id, tax_year, form) do update set content = excluded.content;`);
for (const e of run.reconciliation?.events ?? []) out.push(`insert into reconciliation_events (company_id, loan_id, at, result, prev_hash, hash) values (${C}, ${L}, ${q(e.at)}, ${j(e.result)}, ${q(e.prev_hash)}, ${q(e.hash)}) on conflict (hash) do nothing;`);
out.push('commit;');
process.stdout.write(out.join('\n') + '\n');
