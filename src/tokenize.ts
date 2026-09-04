/**
 * npm run tokenize -- <scanned.pdf|png> [--service] [--fill-from-fixtures]
 *
 * Paper in, token out. OCR the scanned close-of-escrow package, rebuild the loan record
 * from the paper alone, hash the scan itself into the token metadata, then issue the note
 * as a permissioned MPT, fund it through the XLS-65 vault and XLS-66 loan on Devnet.
 * --service additionally runs the monthly sweep loop. Stops (exit 2) if the paper is missing a
 * required field, unless --fill-from-fixtures is given (each filled field is reported).
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { sha256Hex } from './domain/hash.js';
import { buildCanonicalFromDocuments, validateCanonical } from './ingest/canonical.js';
import { buildCanonicalFromScan } from './ingest/from-scan.js';
import { ocrFile } from './scan/ocr.js';
import { connect, loadOrFundWallets } from './xrpl/client.js';
import type { Ctx } from './steps/context.js';
import { setupCredentialsAndDomain } from './steps/01-credentials.js';
import { issueNoteToken } from './steps/02-mpt.js';
import { createFundingVault } from './steps/03-vault.js';
import { setupLendingAndOriginate } from './steps/04-lending.js';
import { serviceLoan } from './steps/05-servicing.js';
import { writeReport } from './steps/07-report.js';

const log = (m: string) => console.log(m);
const head = (n: number, t: string) => log(`\n[${n}] ${t}`);

async function main() {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith('--'));
  if (!input || !fs.existsSync(input)) { console.error('usage: npm run tokenize -- <scan.pdf|png> [--service] [--fill-from-fixtures]'); process.exit(2); }
  const service = args.includes('--service'), fill = args.includes('--fill-from-fixtures');
  const base = path.basename(input).replace(/\.[^.]+$/, '');
  const outDir = path.join(config.outDir, 'tokenize'); fs.mkdirSync(outDir, { recursive: true });

  head(0, `OCR ${input}`);
  const pages = ocrFile(input);
  log(`    ${pages.length} pages, mean confidence ${Math.round(pages.reduce((a, p) => a + (p.confidence ?? 0), 0) / pages.length)}%`);
  fs.writeFileSync(path.join(outDir, `${base}.ocr.txt`), pages.map((p) => p.text).join('\n\f\n'));

  head(1, 'Rebuild the loan record from the paper');
  const built = buildCanonicalFromScan(pages.map((p) => p.text));
  for (const p of built.pages) log(`    page ${p.page}: ${p.kind}`);
  let loan = built.loan;
  if (built.missing.length) {
    log(`    paper did not yield: ${built.missing.join(', ')}`);
    if (!fill) { console.error('\nSTOP: required fields missing from the scan. Rescan, or pass --fill-from-fixtures for a test run.'); process.exit(2); }
    const fx = buildCanonicalFromDocuments(config.documentsDir);
    for (const k of built.missing) {
      const [a, b, c] = k.split('.');
      const src = c ? (fx as any)[a][b][c] : (fx as any)[a][b];
      if (c) (loan as any)[a][b][c] = src; else (loan as any)[a][b] = src;
      built.provenance[k] = 'derived';
      log(`    filled ${k} = ${JSON.stringify(src)} from fixtures`);
    }
  }
  const issues = validateCanonical(loan);
  if (issues.length) { console.error('\nSTOP: scanned figures do not tie out:'); for (const i of issues) console.error(`  ${i.field}: ${i.message}`); process.exit(2); }
  log(`    ${loan.loan.loan_id}  $${loan.loan.principal_amount.toLocaleString()} @ ${loan.loan.annual_interest_rate * 100}% / ${loan.loan.term_months} mo  sweep $${loan.servicing.monthly_total_sweep} = ${loan.servicing.principal_and_interest} + ${loan.servicing.property_tax_impound} + ${loan.servicing.insurance_impound}`);
  log('    all tie-outs pass (P&I, UFMIP, closing costs, cash to close, sweep, LTV, late charge, recording dates)');
  fs.writeFileSync(path.join(outDir, `${base}.canonical.json`), JSON.stringify({ ...loan, _provenance: built.provenance }, null, 2));

  // The token is bound to THIS scan: hash of the scanned file (and of each OCR'd page).
  const scanBytes = fs.readFileSync(input);
  const bundle = {
    algorithm: 'sha256' as const,
    files: [{ name: path.basename(input), bytes: scanBytes.length, sha256: sha256Hex(scanBytes) }, ...pages.map((p) => ({ name: `page-${p.page}.ocr.txt`, bytes: p.text.length, sha256: sha256Hex(p.text) }))],
    bundle_sha256: sha256Hex(scanBytes),
  };
  log(`    scan sha256 ${bundle.bundle_sha256}  (goes into the token metadata)`);

  head(2, `Connect ${config.wss} and fund role wallets`);
  const client = await connect();
  const wallets = await loadOrFundWallets(client, log);
  loan.xrpl.issuer_address = wallets.issuer.classicAddress; loan.xrpl.servicer_address = wallets.servicer.classicAddress;
  const ctx: Ctx = { client, wallets, loan, bundle, txs: [], ids: {}, notes: [`tokenized from scan ${path.basename(input)}`, `provenance: ${JSON.stringify(built.provenance)}`], fullLifecycle: false, log };
  try {
    head(3, 'KYC credentials + permissioned domain (XLS-70 / XLS-80)'); await setupCredentialsAndDomain(ctx);
    head(4, 'Issue the mortgage note token with the MPT standard (XLS-33 / XLS-89), bound to the scan hash'); await issueNoteToken(ctx);
    head(5, 'Private Single Asset Vault (XLS-65)'); await createFundingVault(ctx);
    head(6, 'LoanBroker + two-party LoanSet (XLS-66)'); await setupLendingAndOriginate(ctx);
    if (service) { head(7, 'Servicing sweeps (optional)'); await serviceLoan(ctx); }
    else ctx.notes.push('Servicing not run (add --service). The mortgage is tokenized and funded at this point.');
  } finally {
    const p = writeReport(ctx);
    log(`\nreport ${p}  (summary: out/latest.md)`);
    await client.disconnect();
  }
  log(`\nTOKENIZED: MPT ${ctx.ids.mptIssuanceId}  vault ${ctx.ids.vaultId?.slice(0, 16)}…  loan ${ctx.ids.loanId?.slice(0, 16)}…`);
}
main().catch((e) => { console.error('\nTOKENIZE FAILED:', e instanceof Error ? e.message : e); process.exit(1); });
