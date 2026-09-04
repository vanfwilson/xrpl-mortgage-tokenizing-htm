/**
 * npm run signatures -> assets/signatures/signature-sheet.pdf (+ .png)
 * One line per signer in the package, showing the hand assigned to each name.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PDFDocument, rgb } from 'pdf-lib';
import { pens, signature } from '../pdf/common.js';

const signers: Array<[string, string]> = [
  ['Jordan A. Sandbox', 'Borrower / buyer / grantee'], ['Jane Q. Placeholder', 'Seller / grantor'],
  ['R. Originator', 'Loan originator, Sandbox Lending Corp.'], ['A. Closer', 'Escrow officer, Sandbox Title & Escrow'],
  ['N. Public', 'Notary Public for Idaho'], ['D. Recorder', 'Deputy Recorder, Ada County'],
  ['R. Agent', "Buyer's agent, Sandbox Realty Group"], ['S. Agent', "Seller's agent, Placeholder Properties"],
];
const dir = path.join('assets', 'signatures'); fs.mkdirSync(dir, { recursive: true });
const doc = await PDFDocument.create();
const page = doc.addPage([612, 792]);
const { font, bold, scripts } = await pens(doc);
page.drawText('Signature sheet - synthetic signers used across the closing package', { x: 54, y: 740, size: 13, font: bold });
page.drawText('Rendered from each name in a handwriting font (SIL OFL, assets/fonts/). Same person = same hand on every page.', { x: 54, y: 722, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
let y = 670;
for (const [name, role] of signers) {
  signature(page, name, 60, y, 220, { scripts });
  page.drawLine({ start: { x: 54, y: y - 2 }, end: { x: 320, y: y - 2 }, thickness: 0.8 });
  page.drawText(`${name}  -  ${role}`, { x: 54, y: y - 13, size: 8.5, font });
  y -= 70;
}
fs.writeFileSync(path.join(dir, 'signature-sheet.pdf'), await doc.save());
try { execFileSync('pdftoppm', ['-r', '110', '-png', '-singlefile', path.join(dir, 'signature-sheet.pdf'), path.join(dir, 'signature-sheet')]); } catch { /* preview optional */ }
console.log(`wrote ${dir}/signature-sheet.pdf (+png)`);
