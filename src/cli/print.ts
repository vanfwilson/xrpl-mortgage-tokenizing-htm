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
import { overlayAltaStatement, overlayClosingDisclosure } from '../pdf/overlay.js';
import { fillUrlaBorrower, fillUrlaLender } from '../pdf/fill-urla.js';
import { deedOfTrust, escrowInstructions, fhaAmendatoryClause, noisyOcrTestPage, promissoryNote3200, recorderCertification, servicingStatement, warrantyDeed } from '../pdf/generated.js';

const loan = buildCanonicalFromDocuments(config.documentsDir);
const read = (n: string) => JSON.parse(fs.readFileSync(path.join(config.documentsDir, n), 'utf8'));
const dir = path.join(config.outDir, 'print');
fs.mkdirSync(dir, { recursive: true });
const anchor = `HTM-SCAN ${loan.loan.loan_id}`;
const blank = (n: string) => path.join('forms', 'blank', n);

const sup = (n: string) => JSON.parse(fs.readFileSync(path.join('data', 'supporting', n), 'utf8'));
const out = (n: string) => path.join(dir, n);
/**
 * The complete close-of-escrow package for one homeowner (Jordan A. Sandbox, 123 Sandbox Lane),
 * every signature line signed in blue ink. Documents 03, 07, 08, 09 are the four the tokenizer needs;
 * the rest are the supporting paper a title company hands over and the scanner must cope with.
 */
const jobs: Array<[string, () => Promise<number>]> = [
  ['01-urla-1003-borrower-information.pdf', () => fillUrlaBorrower(loan, sup('urla-1003.json'), blank('urla-1003-borrower-information.pdf'), out('01-urla-1003-borrower-information.pdf'), anchor)],
  ['02-urla-1003-lender-loan-information.pdf', () => fillUrlaLender(loan, blank('urla-1003-lender-loan-information.pdf'), out('02-urla-1003-lender-loan-information.pdf'), anchor)],
  ['03-closing-disclosure.pdf', () => overlayClosingDisclosure(loan, read('01-closing-disclosure.json'), blank('cfpb-closing-disclosure-blank.pdf'), out('03-closing-disclosure.pdf'), anchor)],
  ['04-alta-settlement-statement.pdf', () => overlayAltaStatement(loan, sup('settlement-statement.json'), blank('alta-settlement-statement-borrower.pdf'), out('04-alta-settlement-statement.pdf'), anchor)],
  ['05-escrow-holding-instructions.pdf', () => escrowInstructions(loan, sup('settlement-statement.json'), out('05-escrow-holding-instructions.pdf'), anchor)],
  ['06-fha-amendatory-clause.pdf', () => fhaAmendatoryClause(loan, sup('fha-amendatory-clause.json'), out('06-fha-amendatory-clause.pdf'), anchor)],
  ['07-note-form-3200.pdf', () => promissoryNote3200(loan, read('02-promissory-note-3200.json'), out('07-note-form-3200.pdf'), anchor)],
  ['08-deed-of-trust-form-3013.pdf', () => deedOfTrust(loan, read('03-deed-of-trust-3013.json'), out('08-deed-of-trust-form-3013.pdf'), anchor)],
  ['09-warranty-deed-recorded.pdf', () => warrantyDeed(loan, read('04-warranty-deed-recorded.json'), out('09-warranty-deed-recorded.pdf'), anchor)],
  ['10-county-recorder-certification.pdf', () => recorderCertification(loan, out('10-county-recorder-certification.pdf'), anchor)],
  ['11-servicing-statement-period-1.pdf', () => servicingStatement(loan, 1, loan.loan.first_payment_date, loan.loan.first_payment_date, out('11-servicing-statement-period-1.pdf'), anchor)],
  ['12-ocr-stress-test-page.pdf', () => noisyOcrTestPage(loan, out('12-ocr-stress-test-page.pdf'), anchor)],
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
// Publish the filled set into forms/ (committed) so reviewers see completed documents, not blanks.
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.pdf'))) fs.copyFileSync(path.join(dir, f), path.join('forms', f));
console.log('copied filled forms -> forms/');
