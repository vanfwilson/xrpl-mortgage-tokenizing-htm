import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface BundleManifest {
  algorithm: 'sha256';
  files: Array<{ name: string; bytes: number; sha256: string }>;
  bundle_sha256: string;
}

export const sha256Hex = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

/**
 * Deterministic hash of a document bundle: hash each file, then hash the
 * sorted "name:sha256" lines. Any edit to any page changes bundle_sha256.
 */
export function hashDocumentBundle(dir: string): BundleManifest {
  const names = fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith('.') && fs.statSync(path.join(dir, f)).isFile())
    .sort();
  const files = names.map((name) => {
    const buf = fs.readFileSync(path.join(dir, name));
    return { name, bytes: buf.length, sha256: sha256Hex(buf) };
  });
  const bundle_sha256 = sha256Hex(files.map((f) => `${f.name}:${f.sha256}`).join('\n'));
  return { algorithm: 'sha256', files, bundle_sha256 };
}
