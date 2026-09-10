import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { buildCanonicalFromDocuments, validateCanonical } from './ingest/canonical.js';
import { buildFullYearReplay } from './servicing/replay.js';

const loan = buildCanonicalFromDocuments(config.documentsDir);
const issues = validateCanonical(loan);
if (issues.length) throw new Error(`canonical validation failed: ${JSON.stringify(issues)}`);
const proof = buildFullYearReplay(loan, new Date(`${loan.loan.first_payment_date}T00:00:00Z`));
fs.mkdirSync(config.outDir, { recursive: true });
const file = path.join(config.outDir, 'servicing-year-proof.json');
fs.writeFileSync(file, JSON.stringify(proof, null, 2));
console.log(`${proof.payments.length} exact receipts conserved to the cent; ${proof.events.length} control events -> ${file}`);
