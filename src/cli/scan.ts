/**
 * npm run scan -- <scanned.pdf|png> [--loan MORT-2026-88492X]
 * OCR the scan, repair text, extract fields, compare to the canonical loan,
 * and if the stack contains a servicing statement, emit LoanPay inputs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { buildCanonicalFromDocuments } from '../ingest/canonical.js';
import { extractFields, normalizeOcrText } from '../ingest/normalize.js';
import { ocrFile } from '../scan/ocr.js';
import { compareToLoan, extractServicingStatement, loanPayInputs } from '../scan/compare.js';

const input = process.argv[2];
if (!input || !fs.existsSync(input)) { console.error('usage: npm run scan -- <file.pdf|png>'); process.exit(2); }
const loan = buildCanonicalFromDocuments(config.documentsDir);
const pages = ocrFile(input);
const raw = pages.map((p) => p.text).join('\n\f\n');
const normalized = normalizeOcrText(raw);
const fields = extractFields(raw);
const matches = compareToLoan(fields, loan);
const statement = extractServicingStatement(normalized);
const pay = loanPayInputs(statement, loan);
const report = {
  input, pages: pages.map((p) => ({ page: p.page, confidence: p.confidence, chars: p.text.length })),
  extracted: fields, matches, servicing_statement: statement, loan_pay: pay,
};
fs.mkdirSync(path.join(config.outDir, 'scan'), { recursive: true });
const base = path.basename(input).replace(/\.[^.]+$/, '');
fs.writeFileSync(path.join(config.outDir, 'scan', `${base}.ocr.txt`), raw);
fs.writeFileSync(path.join(config.outDir, 'scan', `${base}.report.json`), JSON.stringify(report, null, 2));
console.log(`pages ${pages.length}  mean confidence ${Math.round(pages.reduce((a, p) => a + (p.confidence ?? 0), 0) / pages.length)}`);
for (const m of matches) console.log(`  ${m.match ? 'OK  ' : 'MISS'} ${m.field.padEnd(18)} expected ${String(m.expected).padEnd(18)} scanned ${m.scanned ?? '-'}`);
console.log(`servicing statement ${JSON.stringify(statement)}`);
console.log(`LoanPay gates ${JSON.stringify(pay.gates)} -> ${pay.ok ? 'READY' : 'BLOCKED'}`);
console.log(`report out/scan/${base}.report.json`);
