import type { CanonicalLoan } from '../ingest/canonical.js';

/** Private servicing metadata. PII and property data never enter ledger payloads. */
export function buildComplianceMetadata(loan: CanonicalLoan, bundleSha256: string) {
  return {
    schema: 'htm.servicing-record/1', loan: loan.loan, note_terms: loan.note_terms,
    property: loan.property, servicing: loan.servicing, document_bundle_sha256: bundleSha256,
    non_guarantees: ['ledger event is not legal compliance', 'ledger event is not payee receipt', 'NFToken is not the note or an ownership interest'],
  };
}
