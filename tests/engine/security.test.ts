import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planMonthlyApplication, scheduleCents } from '../../src/servicing/apply.js';
import { boardLoan, type Authority } from '../../src/servicing/boarding.js';
import { buildCanonicalFromDocuments } from '../../src/ingest/canonical.js';
import { FORBIDDEN_MEMO_KEYS } from '../../src/xrpl/settle.js';

/**
 * Phase F: schema scan and tenant isolation.
 * T6 / R28: no ledger-bound payload builder references a PII field of the canonical loan.
 * Tenant: every posting the engine emits carries company_id and loan_id.
 */
const PAYLOAD_BUILDERS = ['src/xrpl/settle.ts', 'src/xrpl/record.ts', 'src/xrpl/escrow.ts', 'src/xrpl/issuer.ts'];
const PII_ACCESSORS = ['loan.borrower', 'loan.property', 'loan.seller', 'loan.lender', '.mailing_address', '.legal_description', '.apn', '.fha_case_number', '.policy_number', 'note_terms.place_of_payment'];

describe('Phase F security and privacy', () => {
  it('T6_no_pii_in_payload_builders: ledger payload code never touches PII accessors', () => {
    for (const f of PAYLOAD_BUILDERS) {
      const src = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !l.includes('FORBIDDEN_MEMO_KEYS =')).join('\n');
      for (const acc of PII_ACCESSORS) expect(src.includes(acc), `${f} references ${acc}`).toBe(false);
    }
    // The forbidden-key list itself guards every memo/URI/Data field at runtime.
    for (const k of ['apn', 'ssn', 'address', 'policy', 'fha', 'borrower']) expect(FORBIDDEN_MEMO_KEYS).toContain(k);
  });
  it('tenant isolation: every engine posting carries company_id and loan_id', () => {
    const loan = buildCanonicalFromDocuments('data/documents');
    const registry: Authority[] = [
      { holder_id: 's', state: 'ID', kind: 'ID_mortgage_servicer', valid_from: '2026-01-01', valid_to: '2030-12-31' },
      { holder_id: 's', state: 'ID', kind: 'HUD_mortgagee', valid_from: '2026-01-01', valid_to: '2030-12-31' },
    ];
    const b = boardLoan({ loan, company_id: 'tenant-A', loan_id: 'L-A', legal_owner_id: 'o', servicer_of_record_id: 's', settlement_date: '2026-09-01', annual_tax_cents: 342_000, annual_hazard_cents: 150_000, registry, profile: 'test' });
    const row = scheduleCents(b.terms)[0];
    const plan = planMonthlyApplication({ terms: b.terms, row, escrow: { tax: 28_500, hazard: 12_500 }, mip_cents: 18_428, receipt: { company_id: 'tenant-A', loan_id: 'L-A', received_at: '2026-11-01T00:00:00Z', amount_cents: 336_501, bank_ref: 'x' }, suspense_balance_cents: 0, fees_outstanding_cents: 0 });
    for (const p of [...b.opening_postings, ...plan.postings]) { expect(p.company_id).toBe('tenant-A'); expect(p.loan_id).toBe('L-A'); }
  });
  it('R27_no_operator_keys: the key module never writes seeds to disk and the drill disables the master only after a regular-key proof', () => {
    const src = fs.readFileSync('src/xrpl/keys.ts', 'utf8');
    expect(src.includes('writeFileSync')).toBe(false);
    expect(src.indexOf('regularKeyProof')).toBeLessThan(src.indexOf('asfDisableMaster'));
  });
  it('S3_no_vault_lending_types: no vault, lending or participation transaction types remain in src/', () => {
    const files = fs.readdirSync('src', { recursive: true }).map(String).filter((f) => f.endsWith('.ts'));
    for (const f of files) {
      const src = fs.readFileSync(`src/${f}`, 'utf8');
      for (const bad of ['VaultCreate', 'LoanSet', 'LoanPay', 'LoanBrokerSet', 'CredentialCreate', 'PermissionedDomainSet']) expect(src.includes(bad), `src/${f} contains ${bad}`).toBe(false);
    }
  });
});
