import type { CanonicalLoan } from '../ingest/canonical.js';

/**
 * XLS-89 MPT metadata (short keys). Hard limit: 1024 bytes when hex-decoded.
 * We keep it minimal and put the document-bundle hash in `ai` so the token
 * is bound to the exact paper it represents.
 */
export interface Xls89Metadata {
  t: string; // ticker, <= 6 chars A-Z0-9
  n: string; // name
  d?: string; // description
  i: string; // icon URL
  ac: 'rwa' | 'memes' | 'wrapped' | 'gaming' | 'defi' | 'other';
  as?: 'stablecoin' | 'commodity' | 'real_estate' | 'private_credit' | 'equity' | 'treasury' | 'other';
  in: string; // issuer name
  us?: Array<{ u: string; c: 'website' | 'social' | 'docs' | 'other'; t: string }>;
  ai?: Record<string, string | number>;
}

export const MAX_METADATA_BYTES = 1024;

export function buildMptMetadata(loan: CanonicalLoan, bundleSha256: string): Xls89Metadata {
  return {
    t: 'HTMN1',
    n: 'HTM Mortgage Participation Note 1',
    d: 'Permissioned participation certificate in one FHA 30-yr fixed residential mortgage note. Devnet demo.',
    i: 'https://hightechmortgage.com/wp-content/uploads/2026/08/cropped-Gemini_Generated_Image_p2d1rap2d1rap2d1-1.avif',
    ac: 'rwa',
    as: 'private_credit',
    in: 'High Tech Mortgage, Inc.',
    us: [
      { u: 'https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm', c: 'docs', t: 'Reference implementation' },
      { u: 'https://hightechmortgage.com/tokenized-mortgages/', c: 'website', t: 'HTM' },
    ],
    ai: {
      loan_id: loan.loan.loan_id,
      note_usd: loan.loan.principal_amount,
      rate: loan.loan.annual_interest_rate,
      term_m: loan.loan.term_months,
      maturity: loan.loan.maturity_date,
      lien: loan.security_instrument.lien_position,
      state: loan.property.address.state,
      docs_sha256: bundleSha256,
      scale: 'units=USD cents',
    },
  };
}

export function encodeMetadataHex(meta: Xls89Metadata): string {
  const json = JSON.stringify(meta);
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > MAX_METADATA_BYTES) {
    throw new RangeError(`MPT metadata is ${bytes} bytes; XLS-33 limit is ${MAX_METADATA_BYTES}`);
  }
  return Buffer.from(json, 'utf8').toString('hex').toUpperCase();
}

export function decodeMetadataHex(hexStr: string): Xls89Metadata {
  return JSON.parse(Buffer.from(hexStr, 'hex').toString('utf8')) as Xls89Metadata;
}
