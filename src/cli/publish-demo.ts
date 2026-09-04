/**
 * npm run demo:publish -> copies the latest run report, the printed stack, the scan report and
 * previews into docs/demo/ so the GitHub Pages demo page shows the current state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { config } from '../config.js';

const dest = path.join('docs', 'demo');
fs.mkdirSync(dest, { recursive: true });
const runs = fs.readdirSync(config.outDir).filter((f) => /^run-.*\.json$/.test(f)).sort();
if (!runs.length) throw new Error('no out/run-*.json; run `npm run demo` first');
const run = JSON.parse(fs.readFileSync(path.join(config.outDir, runs.at(-1)!), 'utf8'));
run.transactions = run.transactions.map(({ meta: _m, ...t }: any) => t);
fs.writeFileSync(path.join(dest, 'run.json'), JSON.stringify(run, null, 2));
const copy = (from: string, to: string) => { if (fs.existsSync(from)) { fs.copyFileSync(from, path.join(dest, to)); console.log(`  ${to}`); } else console.log(`  (missing) ${from}`); };
copy(path.join(config.outDir, 'print', 'closing-package-stack.pdf'), 'closing-package-stack.pdf');
copy(path.join(config.outDir, 'scan', 'closing-package-stack.report.json'), 'scan-report.json');
copy(path.join(config.outDir, 'export', 'canonical-loan.json'), 'canonical-loan.json');
copy(path.join(config.outDir, 'export', 'xls65_compliance.json'), 'xls65_compliance.json');
try {
  execFileSync('pdftoppm', ['-r', '80', '-f', '1', '-l', '1', '-png', '-singlefile', path.join(config.outDir, 'print', 'closing-package-stack.pdf'), path.join(dest, 'cd-page1')]);
  execFileSync('pdftoppm', ['-r', '80', '-f', '6', '-l', '6', '-png', '-singlefile', path.join(config.outDir, 'print', 'closing-package-stack.pdf'), path.join(dest, 'statement')]);
  console.log('  cd-page1.png, statement.png');
} catch { console.log('  (pdftoppm unavailable; previews not refreshed)'); }
console.log(`published ${runs.at(-1)} -> ${dest}/`);
