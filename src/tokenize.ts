import { config } from './config.js';
import { hashDocumentBundle } from './domain/hash.js';
import { buildCanonicalFromDocuments } from './ingest/canonical.js';
import { buildLoanRecordMint } from './xrpl/record.js';

const loan = buildCanonicalFromDocuments(config.documentsDir);
const bundle = hashDocumentBundle(config.documentsDir);
const tx = buildLoanRecordMint('<SERVICER_ACCOUNT>', {
  schema: 'htm.loan-record', version: 1, loan: loan.loan.loan_id,
  sha256: bundle.bundle_sha256, ptr: 'ipfs://<CID>',
});
console.log(JSON.stringify({ warning: 'unsigned template; NFToken is not the note or an ownership interest', tx }, null, 2));
