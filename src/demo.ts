import { config } from './config.js';
import { hashDocumentBundle } from './domain/hash.js';
import { buildCanonicalFromDocuments, validateCanonical } from './ingest/canonical.js';
import { connect, loadOrFundWallets } from './xrpl/client.js';
import type { Ctx } from './steps/context.js';
import { setupCredentialsAndDomain } from './steps/01-credentials.js';
import { issueNoteToken } from './steps/02-mpt.js';
import { createFundingVault } from './steps/03-vault.js';
import { setupLendingAndOriginate } from './steps/04-lending.js';
import { serviceLoan } from './steps/05-servicing.js';
import { closingEscrow } from './steps/06-escrow.js';
import { writeReport } from './steps/07-report.js';

const log = (m: string) => console.log(m);
const head = (n: number, t: string) => log(`\n[${n}] ${t}`);

async function main() {
  const fullLifecycle = process.argv.includes('--full-lifecycle');
  head(0, 'Ingest documents -> canonical loan JSON -> bundle hash');
  const loan = buildCanonicalFromDocuments(config.documentsDir);
  const issues = validateCanonical(loan);
  if (issues.length) throw new Error(`canonical loan failed validation: ${JSON.stringify(issues)}`);
  const bundle = hashDocumentBundle(config.documentsDir);
  log(`    ${loan.loan.loan_id}  $${loan.loan.principal_amount.toLocaleString()} @ ${loan.loan.annual_interest_rate * 100}% / ${loan.loan.term_months} mo`);
  log(`    ${bundle.files.length} documents, bundle sha256 ${bundle.bundle_sha256}`);

  head(1, `Connect ${config.wss} and fund role wallets`);
  const client = await connect();
  const wallets = await loadOrFundWallets(client, log);
  loan.xrpl.issuer_address = wallets.issuer.classicAddress;
  loan.xrpl.servicer_address = wallets.originator.classicAddress;

  const ctx: Ctx = { client, wallets, loan, bundle, txs: [], ids: {}, notes: [], fullLifecycle, log };
  try {
    head(2, 'KYC credentials + permissioned domain (XLS-70 / XLS-80)');
    await setupCredentialsAndDomain(ctx);
    head(3, 'Issue the note as a permissioned MPT and distribute participations (XLS-33 / XLS-89)');
    await issueNoteToken(ctx);
    head(4, 'Private Single Asset Vault funded by attested depositors (XLS-65)');
    await createFundingVault(ctx);
    head(5, 'LoanBroker + first-loss cover + two-party LoanSet (XLS-66)');
    await setupLendingAndOriginate(ctx);
    head(6, 'Cash-to-close escrow to title (native escrow)');
    await closingEscrow(ctx);
    head(7, `Servicing: LoanPay with PITI memo, impair/unimpair${fullLifecycle ? ', default, delete' : ''}`);
    await serviceLoan(ctx);
  } finally {
    const p = writeReport(ctx);
    log(`\nreport ${p}  (summary: out/latest.md)`);
    await client.disconnect();
  }
  if (ctx.notes.length) {
    log('\nnotes:');
    for (const n of ctx.notes) log(`  - ${n}`);
  }
}

main().catch((e) => {
  console.error('\nDEMO FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
