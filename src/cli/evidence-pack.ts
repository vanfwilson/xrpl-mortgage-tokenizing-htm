/**
 * RS2 (roast 2026-09-10): the examiner-ready evidence pack.
 *
 *   npm run evidence -- [path/to/run.json] [--tests tests] [--out out/evidence]
 *
 * Turns one loan-year run record into a folder a bank compliance officer can open without the codebase:
 * a control map (every R/S/T control with the tests that carry its name), every settlement leg with its
 * explorer link and journal status, the escrow analysis, the statements with delivery evidence, the tax
 * forms, the reconciliation, the business-event chain head, and a SHA-256 manifest over all of it.
 *
 * `buildEvidencePack` is pure (run record + test sources in, file map out) so it is unit-tested offline;
 * the CLI only reads and writes files.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CONTROL_IDS = [
  ...Array.from({ length: 31 }, (_, i) => `R${String(i + 1).padStart(2, '0')}`),
  // Settlement-safety controls as numbered in docs/architecture.md (the gaps are amendments removed in v2.0).
  'S2', 'S3', 'S5', 'S7', 'S8', 'S10', 'S11',
  ...Array.from({ length: 14 }, (_, i) => `T${i + 1}`),
] as const;

export interface TestSource { file: string; text: string }
export interface ControlCoverage { control: string; tests: string[] }

/** Scan test sources for `it('<CONTROL>_...` names. A control is covered when at least one test name starts with it. */
export function controlCoverage(sources: readonly TestSource[], controls: readonly string[] = CONTROL_IDS): ControlCoverage[] {
  const names: Array<{ file: string; name: string }> = [];
  for (const s of sources) {
    for (const m of s.text.matchAll(/\bit\(\s*(['"`])([^'"`]+)\1/g)) names.push({ file: s.file, name: m[2] });
  }
  return controls.map((control) => ({
    control,
    tests: names.filter((n) => n.name.split(/\s+/).some((token) => token === control || token.startsWith(`${control}_`))).map((n) => `${n.file}: ${n.name}`),
  }));
}

/** Read every *.test.ts under a directory (recursively) as test sources. */
export function readTestSources(dir: string): TestSource[] {
  const out: TestSource[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.test\.ts$/.test(e.name) && !e.name.startsWith('._')) out.push({ file: path.relative(process.cwd(), p), text: fs.readFileSync(p, 'utf8') });
    }
  };
  walk(dir);
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

const csvCell = (v: unknown): string => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header: readonly string[], rows: readonly unknown[][]): string => [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n') + '\n';
const json = (v: unknown): string => JSON.stringify(v ?? null, null, 2) + '\n';
export const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

// The run record is treated as loosely typed input: older records (docs/demo/run.json) lack v2 sections and the pack says so.
type Run = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface EvidencePack {
  run: string;
  files: Record<string, string>;
  /** Controls with no test carrying their name. Empty for a v2.0 checkout. */
  uncovered_controls: string[];
  journaled_legs: { total: number; validated: number; not_validated: number };
}

export function buildEvidencePack(run: Run, tests: readonly TestSource[], generatedAt = new Date().toISOString()): EvidencePack {
  if (!run || typeof run.run !== 'string' || typeof run.loan !== 'string') throw new Error('evidence pack: run record must carry `run` and `loan`');
  const coverage = controlCoverage(tests);
  const uncovered = coverage.filter((c) => c.tests.length === 0).map((c) => c.control);
  const txs: Run[] = Array.isArray(run.transactions) ? run.transactions : [];
  const legs = txs.filter((t) => t.journal !== undefined);
  const journaled = { total: legs.length, validated: legs.filter((t) => t.journal === 'validated').length, not_validated: legs.filter((t) => t.journal !== 'validated').length };
  const periods: Run[] = Array.isArray(run.periods) ? run.periods : [];
  const missing: string[] = [];
  const section = <T>(key: string, v: T | undefined): T | null => { if (v === undefined) missing.push(key); return v ?? null; };

  const files: Record<string, string> = {};
  files['control-map.csv'] = csv(['control', 'covered', 'test_count', 'tests'], coverage.map((c) => [c.control, c.tests.length > 0 ? 'yes' : 'no', c.tests.length, c.tests.join(' | ')]));
  files['settlement-legs.csv'] = csv(['step', 'type', 'account', 'result', 'journal', 'ledger_index', 'hash', 'explorer'], txs.map((t) => [t.step, t.type, t.account, t.result, t.journal ?? '', t.ledgerIndex ?? '', t.hash, t.explorer]));
  files['periods.csv'] = csv(['period', 'due', 'received', 'total_due_cents', 'principal_cents', 'interest_cents', 'tax_cents', 'hazard_cents', 'mip_cents'], periods.map((p) => [p.period, p.due, p.received, p.total_due_cents, p.legs?.principal, p.legs?.interest, p.legs?.tax, p.legs?.hazard, p.legs?.mip]));
  files['escrow-analysis.json'] = json({ initial: section('boarding.initial_analysis', run.boarding?.initial_analysis), annual: section('year_end.analysis', run.year_end?.analysis), recovery: run.year_end?.recovery ?? null, year_two_monthly_escrow_cents: run.year_end?.year_two_monthly_escrow_cents ?? null });
  files['statements.json'] = json(section('statements', run.statements));
  files['tax-forms.json'] = json({ form_1098: section('form_1098', run.form_1098), form_1099_int: run.year_end?.form_1099_int ?? null });
  files['reconciliation.json'] = json(section('reconciliation', run.reconciliation));
  files['event-log.json'] = json(section('event_log', run.event_log));
  files['escrows.json'] = json(run.escrows ?? []);
  files['transfer.json'] = json(section('transfer', run.transfer));
  files['proofs.json'] = json(run.proofs ?? {});
  files['clock-mapping.json'] = json(run.clock ?? null);

  const lines = [
    `# Evidence pack for loan ${run.loan}`, '',
    `Run \`${run.run}\` on network \`${run.network ?? 'unknown'}\`, recorded ${run.ran_at ?? 'unknown'}; pack generated ${generatedAt}.`,
    run.document_bundle_sha256 ? `Closing-document bundle SHA-256: \`${run.document_bundle_sha256}\`.` : 'Closing-document bundle hash: not present in this run record.', '',
    '## What is in this folder', '',
    '- `control-map.csv`: every regulatory (R), settlement-safety (S) and tie-out (T) control with the automated tests that carry its name.',
    '- `settlement-legs.csv`: every ledger transaction in the run with engine result, journal status and explorer link.',
    '- `periods.csv`: the monthly cycles with the exact-cent split of each receipt.',
    '- `escrow-analysis.json`: initial and annual 12 CFR 1024.17 analyses with the elected option.',
    '- `statements.json`: initial and annual escrow statements and the periodic statement, with delivery evidence.',
    '- `tax-forms.json`: Form 1098 boxes per year and the 1099-INT decision.',
    '- `reconciliation.json`: the bank / subledger / ledger three-way match and the hash-chained reconciliation events.',
    '- `event-log.json`: count, head hash and types of the append-only business-event chain.',
    '- `escrows.json`, `transfer.json`, `proofs.json`, `clock-mapping.json`: impound escrows, the servicing-transfer manifest, named proofs, and the business-date to ledger-time mapping.',
    '- `MANIFEST.sha256`: SHA-256 of every file above; re-hash to prove the folder is unaltered.', '',
    '## Summary', '',
    `- Ledger transactions: ${txs.length}; journaled settlement legs: ${journaled.total} (validated ${journaled.validated}, not validated ${journaled.not_validated}).`,
    `- Monthly cycles: ${periods.length}.`,
    `- Controls: ${coverage.length}; without a named test: ${uncovered.length === 0 ? 'none' : uncovered.join(', ')}.`,
    run.reconciliation?.result ? `- Three-way match: ${run.reconciliation.result.matched?.length ?? 0} matched, ${run.reconciliation.result.unmatched?.length ?? 0} unmatched; bank-authoritative balance ${run.reconciliation.result.authoritative_balance_cents} cents.` : '- Three-way match: not present in this run record.',
    missing.length ? `- Sections absent from this run record (older format): ${missing.join(', ')}.` : '- All v2.0 sections present.', '',
    '## How to verify', '',
    '1. Open any hash in `settlement-legs.csv` on the explorer; the memo carries only `{v, loan, period, leg, cents, run}`.',
    '2. Re-run `npm run loan-year:replay` on the same closing documents; the periods and analyses must match this folder cent for cent.',
    '3. Re-hash the files and compare with `MANIFEST.sha256`.', '',
  ];
  files['README.md'] = lines.join('\n');
  const manifestNames = Object.keys(files).sort();
  files['MANIFEST.sha256'] = manifestNames.map((n) => `${sha256Hex(files[n])}  ${n}`).join('\n') + '\n';
  return { run: run.run, files, uncovered_controls: uncovered, journaled_legs: journaled };
}

export function latestRunFile(dir = path.join('out', 'loan-year')): string {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^run-.*\.json$/.test(f) && !f.startsWith('._')) : [];
  if (files.length === 0) throw new Error(`evidence pack: no run-*.json under ${dir}; run \`npm run loan-year:replay\` first`);
  files.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
  return path.join(dir, files[0]);
}

export function writeEvidencePack(pack: EvidencePack, outRoot = path.join('out', 'evidence')): string {
  const dir = path.join(outRoot, pack.run);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(pack.files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}

function main(argv: string[]): void {
  const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const positional = argv.filter((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--')));
  const runFile = positional[0] ?? latestRunFile();
  const run = JSON.parse(fs.readFileSync(runFile, 'utf8')) as Run;
  const pack = buildEvidencePack(run, readTestSources(flag('--tests') ?? 'tests'));
  const dir = writeEvidencePack(pack, flag('--out'));
  console.log(`evidence pack for ${pack.run}: ${Object.keys(pack.files).length} files in ${dir}`);
  console.log(`  journaled legs ${pack.journaled_legs.validated}/${pack.journaled_legs.total} validated; uncovered controls: ${pack.uncovered_controls.length === 0 ? 'none' : pack.uncovered_controls.join(', ')}`);
  if (pack.journaled_legs.not_validated > 0) process.exitCode = 2;
}

if (process.argv[1] && /evidence-pack\.(ts|js)$/.test(process.argv[1])) main(process.argv.slice(2));
