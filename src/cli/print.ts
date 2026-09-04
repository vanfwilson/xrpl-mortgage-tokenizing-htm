/**
 * npm run print  -> out/print/*.pdf and out/print/closing-package-stack.pdf
 * The four-document servicing package: CFPB Closing Disclosure (overlay on the official blank),
 * Form 3200 Note, Form 3013 Deed of Trust, recorded Warranty Deed, plus the period-1
 * servicing statement the scan-back test reads. Merged into one printable stack.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { config } from '../config.js';
import { buildCanonicalFromDocuments } from '../ingest/canonical.js';
import { overlayClosingDisclosure } from '../pdf/overlay.js';
import { deedOfTrust, promissoryNote3200, servicingStatement, warrantyDeed } from '../pdf/generated.js';

const loan = buildCanonicalFromDocuments(config.documentsDir);
const read = (n: string) => JSON.parse(fs.readFileSync(path.join(config.documentsDir, n), 'utf8'));
const dir = path.join(config.outDir, 'print');
fs.mkdirSync(dir, { recursive: true });
const anchor = `HTM-SCAN ${loan.loan.loan_id}`;
const blank = (n: string) => path.join('forms', 'blank', n);

const jobs: Array<[string, () => Promise<number>]> = [
  ['01-closing-disclosure.pdf', () => overlayClosingDisclosure(loan, read('01-closing-disclosure.json'), blank('cfpb-closing-disclosure-blank.pdf'), path.join(dir, '01-closing-disclosure.pdf'), anchor)],
  ['02-note-form-3200.pdf', () => promissoryNote3200(loan, read('02-promissory-note-3200.json'), path.join(dir, '02-note-form-3200.pdf'), anchor)],
  ['03-deed-of-trust-form-3013.pdf', () => deedOfTrust(loan, read('03-deed-of-trust-3013.json'), path.join(dir, '03-deed-of-trust-form-3013.pdf'), anchor)],
  ['04-warranty-deed-recorded.pdf', () => warrantyDeed(loan, read('04-warranty-deed-recorded.json'), path.join(dir, '04-warranty-deed-recorded.pdf'), anchor)],
  ['05-servicing-statement-period-1.pdf', () => servicingStatement(loan, 1, loan.loan.first_payment_date, loan.loan.first_payment_date, path.join(dir, '05-servicing-statement-period-1.pdf'), anchor)],
];

const merged = await PDFDocument.create();
for (const [name, fn] of jobs) {
  const pages = await fn();
  const src = await PDFDocument.load(fs.readFileSync(path.join(dir, name)), { ignoreEncryption: true });
  const copied = await merged.copyPages(src, src.getPageIndices());
  copied.forEach((p) => merged.addPage(p));
  console.log(`  ${name.padEnd(44)} ${pages} page(s)`);
}
const stack = path.join(dir, 'closing-package-stack.pdf');
fs.writeFileSync(stack, await merged.save());
console.log(`stack ${stack}  ${merged.getPageCount()} pages`);
