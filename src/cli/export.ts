import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { hashDocumentBundle } from '../domain/hash.js';
import { buildCanonicalFromDocuments } from '../ingest/canonical.js';
import { toMismoSubsetXml } from '../export/mismo.js';

const loan = buildCanonicalFromDocuments(config.documentsDir);
const bundle = hashDocumentBundle(config.documentsDir);
const dir = path.join(config.outDir, 'export');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'canonical-loan.json'), JSON.stringify(loan, null, 2));
fs.writeFileSync(path.join(dir, 'urla-mismo34-subset.xml'), toMismoSubsetXml(loan));
fs.writeFileSync(path.join(dir, 'document-bundle.json'), JSON.stringify(bundle, null, 2));
for (const f of fs.readdirSync(dir)) console.log(`${dir}/${f}`);
