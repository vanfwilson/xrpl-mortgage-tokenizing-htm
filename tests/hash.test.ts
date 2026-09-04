import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashDocumentBundle } from '../src/domain/hash.js';

describe('document bundle hash', () => {
  it('is deterministic and covers every fixture', () => {
    const a = hashDocumentBundle('data/documents');
    const b = hashDocumentBundle('data/documents');
    expect(a.bundle_sha256).toBe(b.bundle_sha256);
    expect(a.files.map((f) => f.name)).toEqual([
      '01-urla-1003.json', '02-closing-disclosure.json', '03-settlement-statement.json',
      '04-fha-amendatory-clause.json', '05-deed-of-trust.json', '06-warranty-deed.json',
    ]);
  });
  it('changes when any page changes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-'));
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one');
    const h1 = hashDocumentBundle(dir).bundle_sha256;
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one ');
    expect(hashDocumentBundle(dir).bundle_sha256).not.toBe(h1);
  });
});
