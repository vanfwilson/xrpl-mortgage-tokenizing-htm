import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { buildCanonicalFromDocuments, validateCanonical } from '../ingest/canonical.js';
import { hashDocumentBundle } from '../domain/hash.js';
import { extractFields } from '../ingest/normalize.js';

const canonical = buildCanonicalFromDocuments(config.documentsDir);
const issues = validateCanonical(canonical);
const bundle = hashDocumentBundle(config.documentsDir);
fs.mkdirSync(config.outDir, { recursive: true });
fs.writeFileSync(path.join(config.outDir, 'canonical-loan.json'), JSON.stringify(canonical, null, 2));
fs.writeFileSync(path.join(config.outDir, 'document-bundle.json'), JSON.stringify(bundle, null, 2));

const noisy = fs.readFileSync(path.join('data', 'ocr-samples', 'noisy-scan.txt'), 'utf8');
const fields = extractFields(noisy);

console.log(`canonical loan  ${canonical.loan.loan_id}  ${canonical.loan.principal_amount} USD @ ${canonical.loan.annual_interest_rate * 100}%`);
console.log(`document bundle ${bundle.files.length} files  sha256 ${bundle.bundle_sha256}`);
console.log(`ocr sample      ${JSON.stringify(fields)}`);
if (issues.length) {
  console.error('VALIDATION ISSUES');
  for (const i of issues) console.error(`  ${i.field}: ${i.message}`);
  process.exit(1);
}
console.log('validation      OK (P&I, UFMIP, ledger tie-out, cash to close, PITI, LTV)');
