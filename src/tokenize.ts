/**
 * npm run tokenize -- <scanned.pdf|png> [--fill-from-fixtures]
 *
 * Paper in, canonical loan record out. OCR the scanned close-of-escrow package, rebuild the loan
 * record from the paper alone, run every tie-out, and hash the scan itself. Stops (exit 2) if the
 * paper is missing a required field, unless --fill-from-fixtures is given (each filled field is reported).
 * The resulting canonical JSON is what the servicing engine boards (`npm run loan-year`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { sha256Hex } from './domain/hash.js';
import { buildCanonicalFromDocuments, validateCanonical } from './ingest/canonical.js';
import { buildCanonicalFromScan } from './ingest/from-scan.js';
import { ocrFile } from './scan/ocr.js';

const log = (m: string) => console.log(m);
const head = (n: number, t: string) => log(`\n[${n}] ${t}`);

function main() {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith('--'));
  if (!input || !fs.existsSync(input)) { console.error('usage: npm run tokenize -- <scan.pdf|png> [--fill-from-fixtures]'); process.exit(2); }
  const fill = args.includes('--fill-from-fixtures');
  const base = path.basename(input).replace(/\.[^.]+$/, '');
  const outDir = path.join(config.outDir, 'tokenize'); fs.mkdirSync(outDir, { recursive: true });

  head(0, `OCR ${input}`);
  const pages = ocrFile(input);
  log(`    ${pages.length} pages, mean confidence ${Math.round(pages.reduce((a, p) => a + (p.confidence ?? 0), 0) / pages.length)}%`);
  fs.writeFileSync(path.join(outDir, `${base}.ocr.txt`), pages.map((p) => p.text).join('\n\f\n'));

  head(1, 'Rebuild the loan record from the paper');
  const built = buildCanonicalFromScan(pages.map((p) => p.text));
  for (const p of built.pages) log(`    page ${p.page}: ${p.kind}`);
  const loan = built.loan;
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
  const s = loan.servicing;
  log(`    ${loan.loan.loan_id}  $${loan.loan.principal_amount.toLocaleString()} @ ${loan.loan.annual_interest_rate * 100}% / ${loan.loan.term_months} mo  payment $${s.monthly_total_sweep} = ${s.principal_and_interest} + ${s.property_tax_impound} + ${s.hazard_insurance_impound} + ${s.fha_mip}`);
  log('    all tie-outs pass (P&I, base + UFMIP, closing costs, cash to close, four legs, FHA LTV/MIP/late charge, recording dates)');
  fs.writeFileSync(path.join(outDir, `${base}.canonical.json`), JSON.stringify({ ...loan, _provenance: built.provenance }, null, 2));

  head(2, 'Fingerprint the paper');
  const scanBytes = fs.readFileSync(input);
  const bundle = {
    algorithm: 'sha256' as const,
    files: [{ name: path.basename(input), bytes: scanBytes.length, sha256: sha256Hex(scanBytes) }, ...pages.map((p) => ({ name: `page-${p.page}.ocr.txt`, bytes: p.text.length, sha256: sha256Hex(p.text) }))],
    bundle_sha256: sha256Hex(scanBytes),
  };
  fs.writeFileSync(path.join(outDir, `${base}.bundle.json`), JSON.stringify(bundle, null, 2));
  log(`    scan sha256 ${bundle.bundle_sha256}  (goes into the loan-record NFToken URI)`);
  log(`\nBOARDED: out/tokenize/${base}.canonical.json  ->  npm run loan-year -- out/tokenize/${base}.canonical.json`);
}
main();
