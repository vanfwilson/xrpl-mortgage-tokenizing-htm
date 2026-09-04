import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { hashDocumentBundle } from '../domain/hash.js';
import { buildCanonicalFromDocuments } from '../ingest/canonical.js';
import { toMismoSubsetXml } from '../export/mismo.js';
import { toXrplPayloads } from '../export/xrpl-payload.js';
import { buildComplianceMetadata } from '../export/compliance-metadata.js';

const loan = buildCanonicalFromDocuments(config.documentsDir);
const bundle = hashDocumentBundle(config.documentsDir);
const dir = path.join(config.outDir, 'export');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'canonical-loan.json'), JSON.stringify(loan, null, 2));
fs.writeFileSync(path.join(dir, 'urla-mismo34-subset.xml'), toMismoSubsetXml(loan));
fs.writeFileSync(path.join(dir, 'xrpl-payloads.json'), JSON.stringify(toXrplPayloads(loan, bundle.bundle_sha256), null, 2));
fs.writeFileSync(path.join(dir, 'document-bundle.json'), JSON.stringify(bundle, null, 2));
// Use the latest Devnet run's accounts if one exists, else placeholders.
const runs = fs.readdirSync(config.outDir).filter((f) => /^run-.*\.json$/.test(f)).sort();
const accounts = runs.length ? JSON.parse(fs.readFileSync(path.join(config.outDir, runs.at(-1)!), 'utf8')).accounts : {};
fs.writeFileSync(path.join(dir, 'xls65_compliance.json'), JSON.stringify(buildComplianceMetadata(loan, bundle.bundle_sha256, accounts), null, 2));
for (const f of fs.readdirSync(dir)) console.log(`${dir}/${f}`);
