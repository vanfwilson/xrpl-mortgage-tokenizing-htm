/**
 * npm run loan-year [-- <canonical.json>] [--no-ledger] [--step <seconds>] [--key-drill]
 *
 * One full servicing year for the boarded loan (Phase E):
 *   Track 1  deterministic replay with an injected business clock (always runs)
 *   Track 2  Testnet proof with statutory dates mapped to near-future ledger timestamps (unless --no-ledger)
 * Outputs: out/loan-year/run-<ts>.json, out/latest.md, docs/escrow-analysis-example.md, docs/form-1098-example.json,
 * docs/clock-mapping-manifest.json and docs/testnet-run.md (Testnet only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { config, WALLET_ROLES, type Role } from './config.js';
import { hashDocumentBundle, sha256Hex } from './domain/hash.js';
import { buildCanonicalFromDocuments, validateCanonical, type CanonicalLoan } from './ingest/canonical.js';
import { analyzeEscrowYear, escrowDepositWithRecovery, type EscrowAnalysis, type ProjectedDisbursement } from './servicing/analysis.js';
import { planMonthlyApplication, scheduleCents, type ApplicationPlan } from './servicing/apply.js';
import { boardLoan, type Authority } from './servicing/boarding.js';
import { addDays, addMonths, disbursementCalendar, rippleTimeAt } from './servicing/calendar.js';
import { ensureDisbursement, type DisbursementDecision } from './servicing/disburse.js';
import { appendReconciliationEvent, threeWayMatch, verifyChain, type Entry, type ReconciliationEvent } from './servicing/reconcile.js';
import { annualEscrowStatement, annualStatementRows, initialEscrowStatement, periodicStatement, renderStatementPdf } from './servicing/statements.js';
import { buildAnnualEscrowStatement, buildInitialEscrowStatement, recordStatementDelivery, type ActivityEntry } from './servicing/escrow-statements.js';
import { build1098, build1099INT } from './servicing/tax.js';
import { servicingTransferCase } from './servicing/transfer.js';
import type { Cents, IsoDate, Posting, VerifiedBill } from './servicing/types.js';
import type { Ctx } from './steps/context.js';
import { connect, loadOrFundWallets, nowRipple, waitForLedgerTime } from './xrpl/client.js';
import { attemptEarlyFinish, cancelEscrow, createImpoundEscrow, finishEscrow, reserveForObjects } from './xrpl/escrow.js';
import { bootstrapIssuer, issueTestUsd, openTrustLines, preflightIssuerLocking } from './xrpl/issuer.js';
import { disableMasterDrill, multisigRecoveryDrill } from './xrpl/keys.js';
import { formatBankReceiptCsv, parseBankReceiptCsv, rowsFromEntries } from './servicing/bank-receipts.js';
import { InMemoryEventStore, PostgresEventStore, type EventStore } from './db/event-store.js';
import { verifyEventChain } from './servicing/event-log.js';
import { mintLoanRecord, transferLoanRecord } from './xrpl/record.js';
import { settlePayment, type Leg } from './xrpl/settle.js';
import { PGlite } from '@electric-sql/pglite';
import { PostgresSettlementStore } from './db/settlement-store.js';
import { settleOnce } from './xrpl/settlement-journal.js';
import { buildLegPayment } from './xrpl/settle.js';

const args = process.argv.slice(2);
const noLedger = args.includes('--no-ledger');
const keyDrill = args.includes('--key-drill');
const stepArg = args.indexOf('--step');
const STEP = stepArg >= 0 ? Number(args[stepArg + 1]) : 45; // ledger seconds per business month (Track 2)
const canonicalPath = args.find((a) => a.endsWith('.json'));
const log = (m: string) => console.log(m);
const head = (n: string, t: string) => log(`\n[${n}] ${t}`);
const usd = (c: Cents) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// ---------------------------------------------------------------------------
// Track 1: business-clock replay (pure; no ledger)
// ---------------------------------------------------------------------------
const loan: CanonicalLoan = canonicalPath ? JSON.parse(fs.readFileSync(canonicalPath, 'utf8')) : buildCanonicalFromDocuments(config.documentsDir);
const issues = validateCanonical(loan);
if (issues.length) { console.error('canonical loan failed validation', issues); process.exit(2); }
const bundle = canonicalPath && fs.existsSync(canonicalPath.replace(/\.canonical\.json$/, '.bundle.json'))
  ? JSON.parse(fs.readFileSync(canonicalPath.replace(/\.canonical\.json$/, '.bundle.json'), 'utf8'))
  : hashDocumentBundle(config.documentsDir);
const parties = JSON.parse(fs.readFileSync(path.join('data', 'servicing-parties.json'), 'utf8'));

const COMPANY = 'htm-demo';
const OPAQUE_LOAN = 'HTM-' + sha256Hex(loan.loan.loan_id).slice(0, 12);
const registry: Authority[] = [
  { holder_id: 'bank-subservicer', state: 'ID', kind: 'ID_mortgage_servicer', valid_from: '2026-01-01', valid_to: '2031-12-31' },
  { holder_id: 'bank-subservicer', state: 'CA', kind: 'bank_exempt', valid_from: '2026-01-01', valid_to: '2031-12-31' },
  { holder_id: 'bank-subservicer', state: 'ID', kind: 'HUD_mortgagee', valid_from: '2026-01-01', valid_to: '2031-12-31' },
];
const annualTax = Math.round(parties.county_treasurer.annual_tax * 100), annualHazard = Math.round(parties.hazard_insurance_carrier.annual_premium * 100);
const boarded = boardLoan({ loan, company_id: COMPANY, loan_id: OPAQUE_LOAN, legal_owner_id: 'funding-bank', servicer_of_record_id: 'bank-subservicer', settlement_date: loan.closing.closing_date, annual_tax_cents: annualTax, annual_hazard_cents: annualHazard, registry, profile: 'test' });
const { terms } = boarded;
const schedule = scheduleCents(terms);
const MIP = Math.round(loan.servicing.fha_mip * 100);
const yearStart = terms.first_payment_date;
const yearEnd = addDays(addMonths(yearStart, 12), -1);

head('1', `Board ${loan.loan.loan_id} as ${OPAQUE_LOAN}: ${usd(terms.note_amount_cents)} @ ${terms.annual_rate * 100}% / ${terms.term_months}, P&I ${usd(terms.monthly_pi_cents)} fixed`);
const disbursements: ProjectedDisbursement[] = disbursementCalendar('ID', parties.hazard_insurance_carrier.renewal, yearStart, yearEnd).map((d) => ({ purpose: d.purpose, due: d.due, cents: d.purpose === 'tax' ? annualTax / 2 : annualHazard, description: d.description }));
const openingEscrow = boarded.opening_postings.reduce((a, p) => a + p.cents, 0);
const initial = analyzeEscrowYear({ computation_year_start: yearStart, starting_balance_cents: openingEscrow, disbursements, borrower_current: true, state: 'ID' });
const initialStmt = initialEscrowStatement({ settlement_date: loan.closing.closing_date, opening_balance_cents: openingEscrow, monthly_escrow_cents: initial.new_monthly_escrow_cents, disbursements });
const initialAnalysisInput = { computation_year_start: yearStart, starting_balance_cents: openingEscrow, disbursements, borrower_current: true, state: 'ID' as const };
const initialDocument = buildInitialEscrowStatement({ company_id: COMPANY, loan_id: OPAQUE_LOAN, principal_interest_cents: terms.monthly_pi_cents, settlement_date: loan.closing.closing_date, generated_on: loan.closing.closing_date, analysis_input: initialAnalysisInput });
const initialDelivery = recordStatementDelivery(initialDocument, { on: loan.closing.closing_date, method: 'mail', evidenceId: `mail-log:initial:${loan.closing.escrow_file_number}` });
log(`    initial analysis: monthly escrow ${usd(initial.monthly_deposit_cents)}, cushion ${usd(initial.cushion_cents)}, target ${usd(initial.target_starting_balance_cents)}, opening ${usd(openingEscrow)} -> ${initial.classification} ${usd(initial.shortage_cents)}; year-1 option: do nothing (12 CFR 1024.17(f)(3)); statement due ${initialStmt.due_by}`);
const escrowSplit = { tax: Math.round(loan.servicing.property_tax_impound * 100), hazard: Math.round(loan.servicing.hazard_insurance_impound * 100) };

// Subledger (integer cents) and the simulated bank mirror.
const bal: Record<string, Cents> = { collection: 0, suspense: 0, note_holder: 0, tax: 0, hazard: 0, mip: 0, hud: 0, fees: 0, advance: 0, refund: 0 };
const postings: Posting[] = [];
const post = (p: Posting) => { postings.push(p); bal[p.account] = (bal[p.account] ?? 0) + p.cents; };
for (const p of boarded.opening_postings) post(p);
const bank: Entry[] = [], sub: Entry[] = [], ledger: Entry[] = [];
const bills: VerifiedBill[] = disbursements.map((d, i) => ({ company_id: COMPANY, loan_id: OPAQUE_LOAN, purpose: d.purpose, payee_id: d.purpose === 'tax' ? 'ada-county-treasurer' : 'hazard-carrier', cents: d.cents, due_date: d.due, verified: true, source_ref: `bill-${i + 1}` }));
const decisions: Array<{ bill: VerifiedBill; decision: DisbursementDecision; period: number }> = [];
const plans: ApplicationPlan[] = [];
const applications: Array<{ period: number; due: IsoDate; received: IsoDate; interest: Cents; principal: Cents }> = [];
const advances: Array<{ bill: string; cents: Cents; on: IsoDate }> = [];

// ---------------------------------------------------------------------------
// Track 2 setup (optional)
// ---------------------------------------------------------------------------
let ctx: Ctx | undefined;
let journalPg: PGlite | undefined;
let eventStore: EventStore = new InMemoryEventStore();
const logEvent = (type: string, data: unknown) => eventStore.append(COMPANY, OPAQUE_LOAN, { type, data });
const RUN = `run-${Date.now().toString(36)}`;
const manifest: Array<{ business_date: IsoDate; ripple_time: number; iso: string; what: string; clamped?: boolean }> = [];
let t0 = 0;
const mapTime = (iso: IsoDate) => {
  const [y, m, d] = iso.split('-').map(Number);
  const [y0, m0] = yearStart.split('-').map(Number);
  const months = (y - y0) * 12 + (m - m0);
  return Math.floor(t0 + (months + (d - 1) / 31) * STEP);
};
const note = (business_date: IsoDate, what: string, ripple_time = mapTime(business_date), clamped = false) => manifest.push({ business_date, ripple_time, iso: new Date((ripple_time + 946_684_800) * 1000).toISOString(), what, ...(clamped ? { clamped } : {}) });
/** S7/T10: a FinishAfter must be in the future when the escrow is created; if the mapped statutory instant has already passed on the ledger clock, clamp forward and say so in the manifest. */
const futureFinish = (mapped: number) => Math.max(mapped, nowRipple() + 10);
/** S7 on the ledger track: CancelAfter window in seconds; at least four business months of mapped time and never under 240 s. */
const CANCEL_WINDOW = Math.max(240, STEP * 4);
const memo = (period: string, leg: Leg, cents: Cents) => ({ v: 1 as const, loan: OPAQUE_LOAN, period, leg, cents, run: RUN });
const PAYEES: readonly Role[] = ['countyTreasurer', 'insuranceCarrier', 'hud'];
interface OpenEscrow { bill: VerifiedBill; owner: string; sequence: number; hash: string; finish_after: number; cancel_after: number; from: Role; to: Role; done?: string; cancelled?: string }
const escrows: OpenEscrow[] = [];
const proofs: Record<string, string> = {};

/** Posting date the simulated custodian stamps on each bank entry: settlement date for boarding, the cycle's due date otherwise. */
const bankPostedOn = new Map<string, IsoDate>();
async function pay(from: Role, to: Role, cents: Cents, period: string, leg: Leg, key: string): Promise<string | undefined> {
  sub.push({ ref: key, cents }); bank.push({ ref: key, cents });
  bankPostedOn.set(key, /^\d{4}-\d{2}$/.test(period) ? `${period}-01` : loan.closing.closing_date);
  if (!ctx) return undefined;
  const h = await settlePayment(ctx, from, to, cents, memo(period, leg, cents), key);
  ledger.push({ ref: key, cents });
  return h;
}

async function main() {
  if (!noLedger) {
    head('2', `Connect ${config.wss} (${config.network}); fund ${WALLET_ROLES.length} role wallets`);
    const client = await connect();
    const wallets = await loadOrFundWallets(client, log);
    const journalDir = path.join(config.outDir, 'loan-year', `journal-${RUN}`);
    fs.mkdirSync(journalDir, { recursive: true });
    const pg = new PGlite(journalDir);
    await pg.exec('create schema if not exists htm_mortgages;');
    await pg.exec(fs.readFileSync(path.join('db', '005_settlement_journal.sql'), 'utf8'));
    await pg.exec(fs.readFileSync(path.join('db', '006_servicing_event_log.sql'), 'utf8'));
    eventStore = new PostgresEventStore(pg);
    ctx = { client, wallets, loan, bundle, txs: [], ids: {}, notes: [], log, journal: new PostgresSettlementStore(pg), tenant: { companyId: COMPANY, loanId: OPAQUE_LOAN } };
    journalPg = pg;
    head('3', 'Controlled test-USD issuer: trust-line locking BEFORE any trust line (S5); trust lines; test USD');
    await bootstrapIssuer(ctx);
    proofs.T9_issuer_preflight = `allowTrustLineLocking=true on ${ctx.ids.issuer}`;
    await openTrustLines(ctx);
    await issueTestUsd(ctx, 'homeowner', 12 * (terms.monthly_pi_cents + escrowSplit.tax + escrowSplit.hazard + MIP) + 50_000);
    await issueTestUsd(ctx, 'servicer', openingEscrow + 100_000); // initial deposit + advance capital
    head('4', 'Loan-record NFToken (S2): hash + opaque id + pointer only');
    const id = await mintLoanRecord(ctx, { v: 1, loan: OPAQUE_LOAN, sha256: bundle.bundle_sha256, ptr: `cas://htm/${OPAQUE_LOAN}/v1` });
    log(`    NFTokenID ${id}`);
  }
  await logEvent('boarding', { terms, opening_postings: boarded.opening_postings, initial_analysis: { classification: initial.classification, shortage_cents: initial.shortage_cents, monthly_deposit_cents: initial.monthly_deposit_cents }, initial_statement_due: initialStmt.due_by });
  head('5', `Boarding deposits (R04): tax ${usd(boarded.opening_postings[0].cents)}, hazard ${usd(boarded.opening_postings[1].cents)}`);
  await pay('servicer', 'taxImpound', boarded.opening_postings[0].cents, 'boarding', 'initial_deposit', `${RUN}:boarding:tax`);
  await pay('servicer', 'hazardImpound', boarded.opening_postings[1].cents, 'boarding', 'initial_deposit', `${RUN}:boarding:hazard`);

  if (ctx) { t0 = nowRipple() + 10; note(yearStart, 'business clock origin (period 1 due date), set after setup', t0); }
  head('6', `Twelve monthly cycles ${yearStart} .. ${yearEnd} (business clock; ${noLedger ? 'no ledger' : `${STEP}s per month on ${config.network}`})`);
  let early = false;
  for (let p = 1; p <= 12; p++) {
    const row = schedule[p - 1];
    const period = row.due_date.slice(0, 7);
    const due = row.interest_cents + row.principal_cents + escrowSplit.tax + escrowSplit.hazard + MIP;
    const receipt = { company_id: COMPANY, loan_id: OPAQUE_LOAN, received_at: `${row.due_date}T15:00:00Z`, amount_cents: due, bank_ref: `ach:${period}` };
    const plan = planMonthlyApplication({ terms, row, escrow: escrowSplit, mip_cents: MIP, receipt, suspense_balance_cents: bal.suspense, fees_outstanding_cents: 0 });
    if (!plan.ok) throw new Error(plan.reason);
    for (const x of plan.postings) post(x);
    plans.push(plan); applications.push({ period: p, due: row.due_date, received: plan.effective_date, interest: plan.legs.interest, principal: plan.legs.principal });
    log(`  period ${String(p).padStart(2)} ${row.due_date}: receipt ${usd(due)} = P ${usd(plan.legs.principal)} + I ${usd(plan.legs.interest)} + tax ${usd(plan.legs.tax)} + hazard ${usd(plan.legs.hazard)} + MIP ${usd(plan.legs.mip)}`);
    if (ctx) { note(row.due_date, `period ${p} due date`); await waitForLedgerTime(ctx.client, mapTime(row.due_date), log); }
    // Finish any escrow whose statutory date has passed on the business clock. Done BEFORE the period's payment legs so the
    // finish lands as close to FinishAfter as possible (the six legs take ~100 s of Testnet time).
    for (const e of escrows) {
      if (e.done || e.cancelled) continue;
      if (e.bill.due_date <= row.due_date) {
        if (ctx) { await waitForLedgerTime(ctx.client, e.finish_after, log); e.done = await finishEscrow(ctx, 'servicer', e.owner, e.sequence); } else e.done = 'replay';
        post({ company_id: COMPANY, loan_id: OPAQUE_LOAN, account: e.bill.purpose, cents: -e.bill.cents, leg: 'escrow_finish', effective_date: e.bill.due_date, period: p });
        log(`    escrow finished ${e.bill.purpose} ${e.bill.due_date} ${usd(e.bill.cents)} -> ${e.to}${e.done !== 'replay' ? ` ${e.done.slice(0, 12)}…` : ''}`);
      }
    }
    await pay('homeowner', 'servicer', due, period, 'receipt', `${RUN}:${period}:receipt`);
    await pay('servicer', 'noteHolder', plan.legs.interest + plan.legs.principal, period, 'pi', `${RUN}:${period}:pi`);
    await pay('servicer', 'taxImpound', plan.legs.tax, period, 'tax', `${RUN}:${period}:tax`);
    await pay('servicer', 'hazardImpound', plan.legs.hazard, period, 'hazard', `${RUN}:${period}:hazard`);
    await pay('servicer', 'mipPayable', plan.legs.mip, period, 'mip', `${RUN}:${period}:mip`);
    await pay('mipPayable', 'hud', plan.legs.mip, period, 'mip_remit', `${RUN}:${period}:mip_remit`);
    post({ company_id: COMPANY, loan_id: OPAQUE_LOAN, account: 'mip', cents: -plan.legs.mip, leg: 'mip_remit', effective_date: row.due_date, period: p });
    post({ company_id: COMPANY, loan_id: OPAQUE_LOAN, account: 'hud', cents: plan.legs.mip, leg: 'mip_remit', effective_date: row.due_date, period: p });
    await logEvent('application', { period: p, due: row.due_date, received: plan.effective_date, legs: plan.legs, total_due_cents: plan.total_due_cents });

    // Near-term verified bills: advance if short (R10), then a fully funded escrow (S7).
    const monthEnd = addDays(addMonths(row.due_date, 1), -1);
    for (const bill of bills) {
      if (decisions.some((d) => d.bill === bill)) continue;
      const balance = bal[bill.purpose];
      const d = ensureDisbursement({ bill, purpose_balance_cents: balance, borrower_days_overdue: 0, escrows_in_flight: escrows.filter((e) => !e.done && !e.cancelled).length, max_in_flight: config.escrow.maxInFlight, today: row.due_date, cancel_after_days: config.escrow.cancelAfterDays, near_term_days: 31 });
      if (d.action === 'forecast_only') continue;
      decisions.push({ bill, decision: d, period: p });
      await logEvent('disbursement_decision', { bill: { purpose: bill.purpose, due: bill.due_date, cents: bill.cents, source_ref: bill.source_ref }, decision: d, period: p });
      log(`    bill ${bill.purpose} ${bill.due_date} ${usd(bill.cents)}: balance ${usd(balance)} -> ${d.action}${d.advance_cents ? ` (advance ${usd(d.advance_cents)})` : ''}`);
      if (d.action === 'refuse') continue;
      if (d.advance_cents > 0) {
        advances.push({ bill: bill.source_ref, cents: d.advance_cents, on: monthEnd });
        post({ company_id: COMPANY, loan_id: OPAQUE_LOAN, account: 'advance', cents: d.advance_cents, leg: 'servicer_advance', effective_date: monthEnd, period: p });
        post({ company_id: COMPANY, loan_id: OPAQUE_LOAN, account: bill.purpose, cents: d.advance_cents, leg: 'servicer_advance', effective_date: monthEnd, period: p });
        await pay('servicer', bill.purpose === 'tax' ? 'taxImpound' : 'hazardImpound', d.advance_cents, period, 'advance', `${RUN}:${period}:advance:${bill.source_ref}`);
      }
      const from: Role = bill.purpose === 'tax' ? 'taxImpound' : 'hazardImpound';
      const to: Role = bill.purpose === 'tax' ? 'countyTreasurer' : 'insuranceCarrier';
      const mapped = ctx ? mapTime(bill.due_date) : rippleTimeAt(bill.due_date);
      const finish_after = ctx ? futureFinish(mapped) : mapped;
      // Ledger track: the cancel window must outlast one full cycle of Testnet work (six validated legs plus waits,
      // observed ~100 s at 45 s/month on 2026-09-10) or a finish attempted in the next period lands after CancelAfter
      // and rippled refuses it with tecNO_PERMISSION. Production maps this to due + 45 days (config.escrow.cancelAfterDays).
      const cancel_after = ctx ? finish_after + CANCEL_WINDOW : rippleTimeAt(addDays(bill.due_date, config.escrow.cancelAfterDays));
      if (ctx) {
        note(bill.due_date, `${bill.purpose} bill FinishAfter`, finish_after, finish_after !== mapped); note(addDays(bill.due_date, config.escrow.cancelAfterDays), `${bill.purpose} bill CancelAfter (FinishAfter + ${CANCEL_WINDOW}s)`, cancel_after);
        const e = await createImpoundEscrow(ctx, { from, to, cents: bill.cents, finish_after, cancel_after, memo: memo(period, bill.purpose, bill.cents), allowlist: PAYEES });
        escrows.push({ bill, ...e, finish_after, cancel_after, from, to });
        if (!early) { early = true; proofs.T10_early_finish = await attemptEarlyFinish(ctx, 'servicer', e.owner, e.sequence); }
      } else escrows.push({ bill, owner: from, sequence: 0, hash: 'replay', finish_after, cancel_after, from, to });
    }
  }
  // Any escrow still open after period 12 (none expected); leave a note.
  for (const e of escrows) if (!e.done && !e.cancelled) log(`    escrow still open ${e.bill.purpose} ${e.bill.due_date}`);

  // Corrected-bill decrease path (S7): a small adjustment escrow that is cancelled after CancelAfter.
  if (ctx) {
    head('7', 'Corrected-bill path (S7): adjustment escrow cancelled after CancelAfter; funds return to the impound');
    const fa = nowRipple() + 8, ca = fa + 12;
    const adj = await createImpoundEscrow(ctx, { from: 'hazardImpound', to: 'insuranceCarrier', cents: 5_000, finish_after: fa, cancel_after: ca, memo: memo(yearEnd.slice(0, 7), 'hazard', 5_000), allowlist: PAYEES });
    await waitForLedgerTime(ctx.client, ca + 1, log);
    const cancelled = await cancelEscrow(ctx, 'servicer', adj.owner, adj.sequence);
    proofs.S7_cancel_after = cancelled;
    ctx.notes.push(`adjustment escrow ${adj.hash.slice(0, 12)}… cancelled after CancelAfter: ${cancelled.slice(0, 12)}…`);
  }

  head('8', 'Year-end escrow analysis (12 CFR 1024.17), statements, tax forms');
  const escrowBalanceForAnalysis = bal.tax + bal.hazard - bal.advance;
  const yearTwoStart = addDays(yearEnd, 1);
  const yearTwo = analyzeEscrowYear({
    computation_year_start: yearTwoStart, starting_balance_cents: escrowBalanceForAnalysis,
    disbursements: disbursementCalendar('ID', parties.hazard_insurance_carrier.renewal, yearTwoStart, addDays(addMonths(yearTwoStart, 12), -1)).map((d) => ({ purpose: d.purpose, due: d.due, cents: d.purpose === 'tax' ? annualTax / 2 : annualHazard })),
    borrower_current: true, state: 'ID',
  });
  const recovery = yearTwo.shortage_cents > 0 ? { shortage_months: 12 } : {};
  const yearTwoDeposit = escrowDepositWithRecovery(yearTwo, recovery);
  const annualStmt = annualEscrowStatement(yearTwo);
  const yearTwoInput = { computation_year_start: yearTwoStart, starting_balance_cents: escrowBalanceForAnalysis, disbursements: disbursementCalendar('ID', parties.hazard_insurance_carrier.renewal, yearTwoStart, addDays(addMonths(yearTwoStart, 12), -1)).map((d) => ({ purpose: d.purpose, due: d.due, cents: d.purpose === 'tax' ? annualTax / 2 : annualHazard, description: d.description })), borrower_current: true, state: 'ID' as const };
  const activity: ActivityEntry[] = [
    ...postings.filter((x) => (x.account === 'tax' || x.account === 'hazard') && x.leg === 'escrow_deposit').map((x, i) => ({ on: x.effective_date, kind: 'deposit' as const, cents: x.cents, reference: `deposit:${x.period}:${x.account}:${i}`, description: `monthly ${x.account} escrow deposit` })),
    ...escrows.filter((e) => e.done).map((e) => ({ on: e.bill.due_date, kind: e.bill.purpose, cents: -e.bill.cents, reference: `disbursement:${e.bill.source_ref}`, description: `${e.bill.purpose} paid to ${e.to}` })),
  ];
  const annualDocument = buildAnnualEscrowStatement({
    company_id: COMPANY, loan_id: OPAQUE_LOAN, principal_interest_cents: terms.monthly_pi_cents, generated_on: addDays(yearEnd, 5),
    prior_year_start: yearStart, prior_year_end: yearEnd, prior_monthly_escrow_cents: initial.monthly_deposit_cents, prior_projection_evidence_id: `initial-analysis:${RUN}`,
    opening_balance_cents: openingEscrow, closing_balance_cents: escrowBalanceForAnalysis, activity, next: yearTwoInput,
    election: yearTwo.shortage_cents > 0 ? 'equal_monthly_payments' : 'do_nothing', recovery_months: yearTwo.shortage_cents > 0 ? 12 : undefined,
    difference_explanation: `Year-1 election was do-nothing on the ${usd(initial.shortage_cents)} initial shortage (12 CFR 1024.17(f)(3)); the December tax installment was short and the servicer advanced ${usd(advances.reduce((a, x) => a + x.cents, 0))} under 1024.17(k)(1); the account ran negative until the January deposit. Disbursements matched the projection.`,
  });
  const annualDelivery = recordStatementDelivery(annualDocument, { on: addDays(yearEnd, 6), method: 'mail', evidenceId: `mail-log:annual:${RUN}` });
  log(`    annual escrow statement: ${annualDocument.kind} generated ${annualDocument.generated_on}, due ${annualDocument.due_by}, delivered ${annualDelivery.delivered_on} (${annualDelivery.status})`);
  await logEvent('escrow_analysis', { computation_year_start: yearTwo.computation_year_start, classification: yearTwo.classification, shortage_cents: yearTwo.shortage_cents, surplus_cents: yearTwo.surplus_cents, deficiency_cents: yearTwo.deficiency_cents, recovery, year_two_monthly_escrow_cents: yearTwoDeposit, annual_statement_due: annualStmt.due_by });
  log(`    tax ${usd(bal.tax)} + hazard ${usd(bal.hazard)} - advances ${usd(bal.advance)} = ${usd(escrowBalanceForAnalysis)} vs target ${usd(yearTwo.target_starting_balance_cents)} -> ${yearTwo.classification} ${usd(yearTwo.shortage_cents || yearTwo.surplus_cents || yearTwo.deficiency_cents)}; year-2 escrow ${usd(yearTwoDeposit)}/month (${JSON.stringify(recovery)}); statement due ${annualStmt.due_by}`);
  // California profile, off-ledger illustration only (R23): same balances, 2 % interest.
  const caInterest = analyzeEscrowYear({ computation_year_start: yearTwoStart, starting_balance_cents: escrowBalanceForAnalysis, disbursements: yearTwo.trial_balances.length ? disbursements : [], borrower_current: true, state: 'CA', prior_year_balances: postings.filter((x) => x.account === 'tax' || x.account === 'hazard').map((x) => ({ date: x.effective_date, balance_cents: 0 })).length ? dailyBalances() : [] }).california_interest_cents;
  const f1099 = build1099INT(Number(yearEnd.slice(0, 4)), caInterest, 'bank-subservicer');
  log(`    California profile: 2% interest ${usd(caInterest)} -> 1099-INT ${f1099.required ? 'required' : 'not required'}`);
  const periodic1 = periodicStatement({ terms, row: schedule[0], escrow_cents: escrowSplit.tax + escrowSplit.hazard, mip_cents: MIP, fees_due_cents: 0, statement_date: addDays(yearStart, -16), since_last: { principal: 0, interest: 0, escrow: 0, mip: 0, fees: 0, suspense: 0 }, ytd: { principal: 0, interest: 0, escrow: 0, mip: 0, fees: 0 }, activity: [], suspense_balance_cents: 0, days_delinquent: 0, contact: 'bank-subservicer' });
  const y1 = Number(yearStart.slice(0, 4)), y2 = y1 + 1;
  const interestIn = (y: number) => applications.filter((a) => a.received.startsWith(String(y))).reduce((a, x) => a + x.interest, 0);
  const principalJan1 = (y: number) => { const before = schedule.filter((r) => r.due_date < `${y}-01-01`); return before.length ? before.at(-1)!.balance_after_cents : terms.note_amount_cents; };
  const mipIn = (y: number) => applications.filter((a) => a.received.startsWith(String(y))).length * MIP;
  const escrowPaid = (y: number) => escrows.filter((e) => e.done && e.bill.due_date.startsWith(String(y))).reduce((a, e) => a + e.bill.cents, 0);
  const form1098 = [y1, y2].map((y) => build1098({ year: y, terms, interest_received_cents: interestIn(y), principal_jan1_cents: principalJan1(y), refund_of_prior_year_interest_cents: 0, mip_received_cents: mipIn(y), points_paid_cents: 0, taxes_paid_from_escrow_cents: escrows.filter((e) => e.done && e.bill.purpose === 'tax' && e.bill.due_date.startsWith(String(y))).reduce((a, e) => a + e.bill.cents, 0), insurance_paid_from_escrow_cents: escrowPaid(y) - escrows.filter((e) => e.done && e.bill.purpose === 'tax' && e.bill.due_date.startsWith(String(y))).reduce((a, e) => a + e.bill.cents, 0), filer: { name: 'bank-subservicer', is_first_recipient: true }, mip_reportable: () => true, property_address_same_as_mailing: true, properties_secured: 1 }));
  for (const f of form1098) log(`    Form 1098 ${f.year}: box 1 ${usd(f.boxes[1])} box 2 ${usd(f.boxes[2])} box 5 ${usd(f.boxes[5])} box 10 ${f.boxes[10] === null ? '-' : usd(f.boxes[10])} required=${f.required} furnish by ${f.calendar.furnish_to_borrower_by}`);

  head('9', 'Servicing transfer (R11) and reconciliation (R14/R22)');
  const transfer = servicingTransferCase(addDays(yearEnd, 1));
  if (ctx) { const t = await transferLoanRecord(ctx, ctx.ids.loanRecordNFTokenId!, 'servicer', 'transfereeServicer'); proofs.R11_nftoken_transfer = t.accept; }
  await logEvent('servicing_transfer', { transfer, nftoken_transfer: proofs.R11_nftoken_transfer ?? null });
  // RS1: the bank side of the match is a receipt FILE in the documented contract (docs/architecture.md §7c), written
  // here by the simulated custodian and parsed back by the same parser a subservicer's export would go through.
  const bankFile = path.join(config.outDir, 'loan-year', `${RUN}-bank-receipts.csv`);
  fs.mkdirSync(path.dirname(bankFile), { recursive: true });
  fs.writeFileSync(bankFile, formatBankReceiptCsv(rowsFromEntries(bank, OPAQUE_LOAN, (ref) => bankPostedOn.get(ref) ?? loan.closing.closing_date)));
  const bankFromFile = parseBankReceiptCsv(fs.readFileSync(bankFile, 'utf8'), { loan_ref: OPAQUE_LOAN });
  log(`    bank receipt file: ${bankFromFile.rows.length} postings parsed from ${path.relative('.', bankFile)} (net ${usd(bankFromFile.net_cents)})`);
  const recon = threeWayMatch({ bank: bankFromFile.entries, subledger: sub, ledger: ctx ? ledger : sub });
  const events: ReconciliationEvent[] = [];
  events.push(appendReconciliationEvent(undefined, { company_id: COMPANY, loan_id: OPAQUE_LOAN }, new Date().toISOString(), recon));
  log(`    three-way match: ${recon.matched.length} matched, ${recon.unmatched.length} unmatched; bank-authoritative balance ${usd(recon.authoritative_balance_cents)}; chain ok=${verifyChain(events)}`);
  if (!recon.reconciled) throw new Error('R14: unreconciled legs');

  if (ctx && journalPg) {
    head('9b', 'Journal restart proof (S11): reopen the store, replay one leg, expect no signing and no submission');
    await journalPg.close();
    const reopened = new PGlite(path.join(config.outDir, 'loan-year', `journal-${RUN}`));
    const store = new PostgresSettlementStore(reopened);
    const period = schedule[0].due_date.slice(0, 7);
    const tx = buildLegPayment(ctx, 'homeowner', 'servicer', schedule[0].interest_cents + schedule[0].principal_cents + escrowSplit.tax + escrowSplit.hazard + MIP, memo(period, 'receipt', schedule[0].interest_cents + schedule[0].principal_cents + escrowSplit.tax + escrowSplit.hazard + MIP));
    const job = await settleOnce({ companyId: COMPANY, loanId: OPAQUE_LOAN, run: RUN, leg: `${RUN}:${period}:receipt` }, tx, store, { prepare: async () => { throw new Error('duplicate signing attempted'); }, submitOrFind: async () => { throw new Error('duplicate submission attempted'); } });
    proofs.S11_journal_restart = `${job.status} ${job.hash}`;
    log(`    replay after reopen: ${job.status} ${job.hash.slice(0, 12)}… (no signing, no submission)`);
    await reopened.close();
    journalPg = undefined;
  }
  if (ctx && keyDrill) {
    head('10', 'Key drills (R27): 2-of-3 signer list (one signature refused, two validate), then regular key + lsfDisableMaster');
    const m = await multisigRecoveryDrill(ctx, 'transfereeServicer', ['servicer', 'noteHolder', 'issuer']);
    proofs.R27_multisig_one_signer = m.oneSignerResult; proofs.R27_multisig_two_signers = `${m.twoSignersResult} ${m.twoSignersHash}`;
    const d = await disableMasterDrill(ctx, 'transfereeServicer'); proofs.R27_key_drill = d.hashes.masterRefused;
    await logEvent('key_drill', { multisig: m, master_refused: d.hashes.masterRefused });
  }
  // R14: the business-event chain verifies end to end (and, on the ledger track, after a store reopen).
  const chain = await eventStore.read(COMPANY, OPAQUE_LOAN);
  verifyEventChain(chain);
  proofs.R14_event_chain = `${chain.length} events, head ${chain.at(-1)?.eventHash.slice(0, 16)}…`;

  // ------------------------------------------------------------------------- outputs
  const outDir = path.join(config.outDir, 'loan-year'); fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(path.join(config.outDir, 'statements'), { recursive: true });
  await renderStatementPdf('Annual Escrow Account Statement (12 CFR 1024.17(i))', annualStatementRows(yearTwo), path.join(config.outDir, 'statements', 'annual-escrow-statement.pdf'), OPAQUE_LOAN);
  await renderStatementPdf('Initial Escrow Account Statement (12 CFR 1024.17(g))', [['Settlement date', initialStmt.settlement_date], ['Due by', initialStmt.due_by], ['Opening balance', usd(initialStmt.opening_balance_cents)], ['Monthly escrow', usd(initialStmt.monthly_escrow_cents)]], path.join(config.outDir, 'statements', 'initial-escrow-statement.pdf'), OPAQUE_LOAN);
  const balances = { ...bal };
  const run = {
    network: noLedger ? 'replay' : config.network, ran_at: new Date().toISOString(), run: RUN, loan: OPAQUE_LOAN, document_bundle_sha256: bundle.bundle_sha256,
    accounts: ctx ? Object.fromEntries(WALLET_ROLES.map((r) => [r, ctx!.wallets[r].classicAddress])) : {}, ids: ctx?.ids ?? {}, proofs,
    clock: { step_seconds: STEP, origin_ripple_time: t0, manifest },
    boarding: { terms, opening_postings: boarded.opening_postings, initial_analysis: initial, initial_statement: initialStmt },
    periods: plans.map((p, i) => ({ period: i + 1, due: p.due_date, received: p.effective_date, legs: p.legs, total_due_cents: p.total_due_cents })),
    disbursements: decisions.map((d) => ({ ...d.bill, decision: d.decision, period: d.period })), advances,
    escrows: escrows.map(({ bill, ...e }) => ({ purpose: bill.purpose, due: bill.due_date, cents: bill.cents, ...e })),
    year_end: { balances, escrow_balance_for_analysis: escrowBalanceForAnalysis, analysis: yearTwo, recovery, year_two_monthly_escrow_cents: yearTwoDeposit, annual_statement_due: annualStmt.due_by, california_interest_cents: caInterest, form_1099_int: f1099 },
    statements: { initial: initialStmt, initial_document: initialDocument, initial_delivery: initialDelivery, annual_document: annualDocument, annual_delivery: annualDelivery, periodic_1: periodic1 },
    form_1098: form1098, transfer, reconciliation: { result: recon, events },
    reserve_drops_for_objects: reserveForObjects(escrows.length + 1),
    event_log: { count: chain.length, head_hash: chain.at(-1)?.eventHash ?? null, types: chain.map((e) => JSON.parse(e.payloadJson).type) },
    transactions: ctx ? ctx.txs.map(({ meta: _m, ...t }) => t) : [], notes: ctx?.notes ?? [],
  };
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(outDir, `${RUN}-${ts}.json`), JSON.stringify(run, null, 2));
  fs.writeFileSync(path.join(config.outDir, 'latest.md'), runMarkdown(run));
  fs.writeFileSync(path.join('docs', 'escrow-analysis-example.md'), analysisMarkdown(initial, yearTwo, yearTwoDeposit, escrowBalanceForAnalysis, advances, caInterest));
  fs.writeFileSync(path.join('docs', 'form-1098-example.json'), JSON.stringify({ note: 'Synthetic loan; 1098 data for the demo loan year. Box 1 reconciles to interest applied by receipt date; Box 2 is principal at January 1.', forms: form1098 }, null, 2));
  if (ctx) {
    fs.writeFileSync(path.join('docs', 'clock-mapping-manifest.json'), JSON.stringify({ network: config.network, run: RUN, step_seconds: STEP, origin_ripple_time: t0, rule: 'ripple_time = origin + (months since period-1 due + (day-1)/31) * step_seconds', manifest }, null, 2));
    if (journalPg) await journalPg.close();
    if (config.network === 'testnet') fs.writeFileSync(path.join('docs', 'demo', 'run.json'), JSON.stringify({ network: run.network, ran_at: run.ran_at, run: run.run, loan: run.loan, document_bundle_sha256: run.document_bundle_sha256, accounts: run.accounts, ids: run.ids, proofs: run.proofs, escrows: run.escrows, periods: run.periods, year_end: { analysis: run.year_end.analysis, year_two_monthly_escrow_cents: run.year_end.year_two_monthly_escrow_cents }, form_1098: run.form_1098, transactions: run.transactions }, null, 2));
    if (config.network === 'testnet') fs.writeFileSync(path.join('docs', 'testnet-run.md'), '# Testnet loan-year run\n\nLatest run of `npm run loan-year` on XRPL Testnet (Mainnet-live transaction types only; statutory dates mapped per docs/clock-mapping-manifest.json). Every hash links to the explorer.\n\n' + runMarkdown(run).replace(/^# .*\n/, ''));
    await ctx.client.disconnect();
  }
  log(`\nDONE ${RUN}: ${run.transactions.length} ledger transactions; out/latest.md; docs/escrow-analysis-example.md; docs/form-1098-example.json${ctx ? '; docs/testnet-run.md' : ''}`);

  function dailyBalances() {
    // Daily tax+hazard balance series for the California interest illustration (from postings).
    const days: Array<{ date: IsoDate; balance_cents: Cents }> = [];
    let b = 0;
    for (const x of postings.filter((x) => x.account === 'tax' || x.account === 'hazard').sort((a, c) => a.effective_date.localeCompare(c.effective_date))) { b += x.cents; days.push({ date: x.effective_date, balance_cents: b }); }
    return days;
  }
}

function runMarkdown(run: any): string {
  const L: string[] = [`# Loan-year run ${run.ran_at} (${run.network})`, '', `Loan ${run.loan} · documents sha256 \`${run.document_bundle_sha256}\` · run ${run.run}`, ''];
  if (Object.keys(run.accounts).length) { L.push('## Accounts', ...Object.entries(run.accounts).map(([r, a]) => `- ${r}: [${a}](${config.explorer}/accounts/${a})`), ''); }
  if (Object.keys(run.ids).length) L.push('## Ledger objects', ...Object.entries(run.ids).map(([k, v]) => `- ${k}: \`${v}\``), '');
  L.push('## Proofs', ...Object.entries(run.proofs).map(([k, v]) => `- ${k}: ${v}`), '');
  L.push('## Periods', '| period | due | received | P | I | tax | hazard | MIP | total |', '|---|---|---|---|---|---|---|---|---|', ...run.periods.map((p: any) => `| ${p.period} | ${p.due} | ${p.received} | ${usd(p.legs.principal)} | ${usd(p.legs.interest)} | ${usd(p.legs.tax)} | ${usd(p.legs.hazard)} | ${usd(p.legs.mip)} | ${usd(p.total_due_cents)} |`), '');
  L.push('## Disbursements', '| purpose | due | amount | decision | advance | escrow create | finish | cancel |', '|---|---|---|---|---|---|---|---|', ...run.disbursements.map((d: any) => { const e = run.escrows.find((x: any) => x.due === d.due_date && x.purpose === d.purpose); return `| ${d.purpose} | ${d.due_date} | ${usd(d.cents)} | ${d.decision.action} | ${d.decision.advance_cents ? usd(d.decision.advance_cents) : '-'} | ${e ? link(e.hash) : '-'} | ${e?.done ? link(e.done) : '-'} | ${e?.cancelled ? link(e.cancelled) : '-'} |`; }), '');
  const a = run.year_end.analysis;
  L.push('## Year-end analysis', `- escrow balance for analysis: ${usd(run.year_end.escrow_balance_for_analysis)} (advances outstanding ${usd(run.year_end.balances.advance)})`, `- target ${usd(a.target_starting_balance_cents)}, cushion ${usd(a.cushion_cents)} -> ${a.classification} ${usd(a.shortage_cents || a.surplus_cents || a.deficiency_cents)}`, `- year-2 monthly escrow ${usd(run.year_end.year_two_monthly_escrow_cents)} (${JSON.stringify(run.year_end.recovery)}); annual statement due ${run.year_end.annual_statement_due}`, `- California profile interest ${usd(run.year_end.california_interest_cents)}; 1099-INT required=${run.year_end.form_1099_int.required}`, '');
  L.push('## Form 1098', ...run.form_1098.map((f: any) => `- ${f.year}: box1 ${usd(f.boxes[1])} box2 ${usd(f.boxes[2])} box5 ${usd(f.boxes[5])} box10 ${f.boxes[10] === null ? '-' : usd(f.boxes[10])} required=${f.required} furnish by ${f.calendar.furnish_to_borrower_by}`), '');
  L.push('## Servicing transfer (R11)', `- effective ${run.transfer.transfer_date}; transferor notice by ${run.transfer.transferor_notice_due}; transferee notice by ${run.transfer.transferee_notice_due}; misdirected-payment grace until ${run.transfer.grace_until}`, '');
  L.push('## Reconciliation', `- ${run.reconciliation.result.matched.length} legs matched across bank, subledger and ledger; ${run.reconciliation.result.unmatched.length} unmatched; bank-authoritative balance ${usd(run.reconciliation.result.authoritative_balance_cents)}; chain hash ${run.reconciliation.events.at(-1).hash.slice(0, 16)}…`, `- owner reserve for ledger objects this year: ${run.reserve_drops_for_objects / 1e6} XRP`, '');
  if (run.transactions.length) L.push('## Transactions', '| step | type | result | tx |', '|---|---|---|---|', ...run.transactions.map((t: any) => `| ${t.step} | ${t.type} | ${t.result} | ${t.hash ? link(t.hash) : '-'} |`), '');
  if (run.notes.length) L.push('## Notes', ...run.notes.map((n: string) => `- ${n}`), '');
  return L.join('\n');
  function link(h: string) { return h && h.length === 64 ? `[${h.slice(0, 12)}…](${config.explorer}/transactions/${h})` : h; }
}

function analysisMarkdown(initial: EscrowAnalysis, y2: EscrowAnalysis, y2deposit: Cents, balance: Cents, adv: Array<{ bill: string; cents: Cents; on: IsoDate }>, ca: Cents): string {
  const tb = (a: EscrowAnalysis) => ['| month | deposit | disbursed | balance |', '|---|---|---|---|', ...a.trial_balances.map((t) => `| ${t.date.slice(0, 7)} | ${usd(t.deposit_cents)} | ${usd(t.disbursed_cents)} | ${usd(t.balance_cents)} |`)].join('\n');
  return [
    '# Escrow analysis example (12 CFR 1024.17, aggregate method)', '', 'Synthetic Idaho FHA loan; every figure is integer cents reconciled by `npm run loan-year`.', '',
    '## Initial analysis at settlement (R02, R03, R05, R08)', '', `Annual disbursements ${usd(initial.annual_disbursements_cents)} (tax ${usd(initial.annual_disbursements_cents - 150_000)} in two halves, hazard $1,500.00). Monthly deposit ${usd(initial.monthly_deposit_cents)}. Cushion cap one-sixth = ${usd(initial.cushion_cents)}.`, '', tb(initial), '',
    `Lowest projected balance ${usd(initial.lowest_balance_cents)} in month ${initial.lowest_month}; target starting balance ${usd(initial.target_starting_balance_cents)}. Opening balance from the Closing Disclosure initial deposit ${usd(initial.starting_balance_cents)} -> **${initial.classification} ${usd(initial.shortage_cents)}** (one month or more). Options under 1024.17(f)(3): ${initial.shortage_options.map((o) => o.kind).join(', ')}. Year 1 election: do nothing; the December bill is covered by a servicer advance under 1024.17(k)(1).`, '',
    '## Servicer advances during the year (R10)', '', ...(adv.length ? adv.map((a) => `- ${a.on}: ${usd(a.cents)} advanced for ${a.bill}`) : ['- none']), '',
    '## Year-end analysis (R02, R07/R08/R09)', '', `Escrow balance for analysis = tax + hazard − advances outstanding = ${usd(balance)}. Target ${usd(y2.target_starting_balance_cents)} -> **${y2.classification} ${usd(y2.shortage_cents || y2.surplus_cents || y2.deficiency_cents)}**.`, '', tb(y2), '',
    `Options: ${y2.shortage_options.map((o) => `${o.kind}${o.min_months ? ` (≥ ${o.min_months} months)` : ''}`).join(', ') || 'n/a'}. Election: equal monthly payments over 12 months -> year-2 monthly escrow ${usd(y2deposit)}. Annual statement due ${y2.annual_statement_due} (R06).`, '',
    '## Surplus case (R07)', '', 'Had the opening balance been $1,770.00 (target + $60.00), the analysis would classify a surplus of $60.00; with the borrower current it is refunded within 30 days (12 CFR 1024.17(f)(2)(i)). A $49.99 surplus may be refunded or credited.', '',
    '## California profile (R23, R30)', '', `Same balances under Cal. Civ. Code 2954.8: 2 % simple interest = ${usd(ca)}, credited annually; Form 1099-INT ${ca >= 1_000 ? 'required' : 'not required'} ($10 threshold).`, '',
  ].join('\n');
}

main().catch((e) => { console.error('\nLOAN-YEAR FAILED:', e instanceof Error ? e.stack ?? e.message : e); process.exit(1); });
