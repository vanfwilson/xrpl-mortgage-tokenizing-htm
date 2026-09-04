import type { CanonicalLoan } from '../ingest/canonical.js';
import { sha256Hex } from '../domain/hash.js';

/**
 * Off-ledger compliance metadata document in the structure from the servicing brief
 * ("XLS-65-Metadata"). It consolidates the four closing documents into one record whose
 * sha256 is what the on-ledger token metadata points at.
 *
 * Standards note: XLS-65 is the Single Asset Vault standard and XLS-89 is the MPT metadata
 * schema; the on-ledger 1024-byte XLS-89 blob (src/domain/metadata.ts) references THIS
 * document by hash rather than embedding it. We keep the brief's top-level key for continuity.
 */
export function buildComplianceMetadata(loan: CanonicalLoan, bundleSha256: string, accounts: Partial<Record<string, string>> = {}) {
  const s = loan.servicing;
  return {
    'XLS-65-Metadata': {
      version: '1.1.0',
      asset_class: 'Real World Asset (RWA)',
      asset_subclass: 'Residential Mortgage Loan Note',
      compliance_standard: 'XLS-65',
      standards_note: 'Token = XLS-33 MPT with XLS-89 metadata; funding = XLS-65 Single Asset Vault; facility = XLS-66 Lending Protocol. This document is hashed into the XLS-89 blob (ai.docs_sha256).',
      token_identifiers: {
        asset_symbol: 'HTMN1',
        loan_number: loan.loan.loan_id,
        legal_description_hash: sha256Hex(loan.property.legal_description),
        underlying_document_bundle_sha256: bundleSha256,
        underlying_document_uri: 'https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm/tree/main/data/documents',
      },
      registry_records: {
        recording_jurisdiction: loan.vesting_deed.recording_office,
        county_document_number: loan.vesting_deed.recording_number,
        recording_date: `${loan.vesting_deed.recording_date}T${loan.vesting_deed.recording_time}-06:00`,
        deed_of_trust_document_number: loan.security_instrument.recording_number,
        deed_of_trust_form: loan.security_instrument.form,
        lien_position: loan.security_instrument.lien_position,
        assessor_parcel_number: loan.property.apn,
        legal_description: loan.property.legal_description,
      },
      loan_terms_fannie_mae_3200: {
        principal_amount_usd: loan.loan.principal_amount,
        annual_interest_rate: loan.loan.annual_interest_rate,
        term_months: loan.loan.term_months,
        origination_date: loan.loan.origination_date,
        first_payment_date: loan.loan.first_payment_date,
        maturity_date: loan.loan.maturity_date,
        payment_due_day_of_month: loan.note_terms.payment_due_day_of_month,
        grace_period_days: loan.note_terms.grace_period_days,
        late_fee_percentage: loan.note_terms.late_charge_percent_of_pi,
        late_fee_usd: loan.note_terms.late_charge_amount,
      },
      escrow_servicing_allocations_cd_p1: {
        monthly_total_borrower_sweep: s.monthly_total_sweep,
        disbursement_rules: {
          principal_and_interest_usd: s.principal_and_interest,
          monthly_property_tax_impound_usd: s.property_tax_impound,
          monthly_hazard_insurance_impound_usd: s.insurance_impound,
          hazard_insurance_detail: s.insurance_detail,
        },
        disbursement_schedule: {
          property_tax: { payee: 'Ada County Treasurer', installments: ['12-20', '06-20'] },
          hazard_insurance: { payee: 'Hazard carrier / HUD FHA MIP', installments: ['09-01'] },
        },
      },
      counterparty_identity_mappings: {
        borrower_wallet: accounts.homeowner ?? '<HOMEOWNER_ACCOUNT>',
        seller_wallet: accounts.seller ?? '<SELLER_ACCOUNT (off-ledger party; paid at closing by title)>',
        lender_lienholder_wallet: accounts.broker ?? '<LENDING_DESK_ACCOUNT>',
        servicer_wallet: accounts.servicer ?? '<SERVICER_ACCOUNT>',
        note_token_issuer_wallet: accounts.issuer ?? '<ISSUER_ACCOUNT>',
        tax_impound_vault_wallet: accounts.taxImpound ?? '<TAX_IMPOUND_ACCOUNT>',
        insurance_impound_vault_wallet: accounts.insuranceImpound ?? '<INSURANCE_IMPOUND_ACCOUNT>',
        county_treasurer_wallet: accounts.countyTreasurer ?? '<COUNTY_TREASURER_ACCOUNT>',
        insurance_carrier_wallet: accounts.insuranceCarrier ?? '<CARRIER_ACCOUNT>',
      },
    },
  };
}
