import { describe, expect, it } from 'vitest';
import { buildMptMetadata, decodeMetadataHex, encodeMetadataHex, MAX_METADATA_BYTES } from '../src/domain/metadata.js';
import { buildCanonicalFromDocuments } from '../src/ingest/canonical.js';

const loan = buildCanonicalFromDocuments('data/documents');

describe('XLS-89 metadata', () => {
  const meta = buildMptMetadata(loan, 'a'.repeat(64));
  it('has the required XLS-89 keys and an RWA classification', () => {
    expect(meta.t).toMatch(/^[A-Z0-9]{1,6}$/);
    expect(meta.ac).toBe('rwa');
    expect(meta.as).toBe('private_credit');
    expect(meta.in).toBe('High Tech Mortgage, Inc.');
    expect(meta.i).toMatch(/^https:\/\//);
  });
  it('fits the 1024-byte on-ledger limit and round-trips through hex', () => {
    const hex = encodeMetadataHex(meta);
    expect(hex.length / 2).toBeLessThanOrEqual(MAX_METADATA_BYTES);
    expect(decodeMetadataHex(hex)).toEqual(meta);
  });
  it('binds the token to the document bundle hash', () => {
    expect(meta.ai?.docs_sha256).toBe('a'.repeat(64));
    expect(meta.ai?.note_usd).toBe(450_000);
  });
  it('rejects oversize metadata', () => {
    expect(() => encodeMetadataHex({ ...meta, d: 'x'.repeat(1100) })).toThrow(RangeError);
  });
});
