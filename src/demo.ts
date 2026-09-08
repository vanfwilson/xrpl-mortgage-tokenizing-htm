/**
 * npm run demo -> ingest the four closing documents, run every tie-out, hash the bundle.
 * The ledger loan-year proof lives in `npm run loan-year` (Phase D/E of the servicing rebuild).
 */
import { config } from './config.js';
import { hashDocumentBundle } from './domain/hash.js';
import { buildCanonicalFromDocuments, validateCanonical } from './ingest/canonical.js';

const loan = buildCanonicalFromDocuments(config.documentsDir);
const issues = validateCanonical(loan);
if (issues.length) {
  console.error('canonical loan failed validation:');
  for (const i of issues) console.error(`  ${i.field}: ${i.message}`);
  process.exit(1);
}
const bundle = hashDocumentBundle(config.documentsDir);
const s = loan.servicing;
console.log(`${loan.loan.loan_id}  $${loan.loan.principal_amount.toLocaleString()} @ ${loan.loan.annual_interest_rate * 100}% / ${loan.loan.term_months} mo`);
console.log(`payment $${s.monthly_total_sweep} = P&I ${s.principal_and_interest} + tax ${s.property_tax_impound} + hazard ${s.hazard_insurance_impound} + MIP ${s.fha_mip}`);
console.log(`${bundle.files.length} documents, bundle sha256 ${bundle.bundle_sha256}`);
console.log('all tie-outs pass (P&I, base + UFMIP, closing costs, cash to close, four legs, FHA LTV/MIP/late charge, recording dates)');
