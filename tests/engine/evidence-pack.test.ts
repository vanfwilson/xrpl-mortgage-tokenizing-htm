import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEvidencePack, CONTROL_IDS, controlCoverage, readTestSources, sha256Hex } from '../../src/cli/evidence-pack.js';

const tests = readTestSources('tests');

describe('RS2 evidence pack', () => {
  it('R14_control_map_every_control_has_a_named_test: R01-R31, the documented S controls, T1-T14 all covered by the offline suite', () => {
    const cov = controlCoverage(tests);
    expect(cov).toHaveLength(CONTROL_IDS.length);
    const uncovered = cov.filter((c) => c.tests.length === 0).map((c) => c.control);
    expect(uncovered).toEqual([]);
    // Prefix matching is exact on the underscore: R1 must not claim R10..R19, T1 must not claim T10..T14.
    const fake = [{ file: 'x', text: "it('T10_only', () => {}); it('R11_only', () => {});" }];
    const c2 = controlCoverage(fake, ['T1', 'T10', 'R1', 'R11']);
    expect(c2.map((c) => c.tests.length)).toEqual([0, 1, 0, 1]);
  });

  it('R14_evidence_pack_from_run_record: the demo run record builds a complete pack with a manifest that re-hashes', () => {
    const run = JSON.parse(fs.readFileSync(path.join('docs', 'demo', 'run.json'), 'utf8'));
    const pack = buildEvidencePack(run, tests, '2026-09-10T00:00:00Z');
    const names = Object.keys(pack.files).sort();
    for (const required of ['README.md', 'MANIFEST.sha256', 'control-map.csv', 'settlement-legs.csv', 'periods.csv', 'escrow-analysis.json', 'statements.json', 'tax-forms.json', 'reconciliation.json', 'event-log.json']) expect(names).toContain(required);
    // Every file except the manifest itself is listed with its SHA-256, and the listed hash matches the content.
    const manifest = pack.files['MANIFEST.sha256'].trim().split('\n').map((l) => l.split(/\s{2}/));
    expect(manifest.map(([, n]) => n).sort()).toEqual(names.filter((n) => n !== 'MANIFEST.sha256'));
    for (const [hash, name] of manifest) expect(sha256Hex(pack.files[name])).toBe(hash);
    expect(pack.files['README.md']).toContain(`loan ${run.loan}`);
    expect(pack.files['settlement-legs.csv'].split('\n').length - 2).toBe(run.transactions.length);
    expect(pack.files['periods.csv'].split('\n').length - 2).toBe(run.periods.length);
    expect(pack.uncovered_controls).toEqual([]);
    // The pack is deterministic for the same run record and generation time.
    expect(buildEvidencePack(run, tests, '2026-09-10T00:00:00Z').files['MANIFEST.sha256']).toBe(pack.files['MANIFEST.sha256']);
  });

  it('R14_evidence_pack_rejects_a_record_without_identity', () => {
    expect(() => buildEvidencePack({} as never, tests)).toThrow(/run/);
  });
});
