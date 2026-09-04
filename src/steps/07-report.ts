import fs from 'node:fs';
import path from 'node:path';
import { config, WALLET_ROLES } from '../config.js';
import type { Ctx } from './context.js';

export function writeReport(ctx: Ctx): string {
  fs.mkdirSync(config.outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const accounts = Object.fromEntries(WALLET_ROLES.map((r) => [r, ctx.wallets[r].classicAddress]));
  const json = {
    network: config.wss,
    ran_at: new Date().toISOString(),
    loan_id: ctx.loan.loan.loan_id,
    document_bundle_sha256: ctx.bundle.bundle_sha256,
    accounts,
    ids: ctx.ids,
    transactions: ctx.txs.map(({ meta: _m, ...rest }) => rest),
    notes: ctx.notes,
  };
  const jsonPath = path.join(config.outDir, `run-${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));

  const lines = [
    `# Devnet run ${json.ran_at}`,
    '',
    `Loan ${json.loan_id} · documents sha256 \`${json.document_bundle_sha256}\``,
    '',
    '## Accounts',
    ...WALLET_ROLES.map((r) => `- ${r}: [${accounts[r]}](${config.explorer}/accounts/${accounts[r]})`),
    '',
    '## Ledger objects',
    ...Object.entries(ctx.ids).map(([k, v]) => `- ${k}: \`${v}\``),
    '',
    '## Transactions',
    '| step | type | result | tx |',
    '|---|---|---|---|',
    ...ctx.txs.map((t) => `| ${t.step} | ${t.type} | ${t.result} | [${t.hash.slice(0, 12)}…](${t.explorer}) |`),
    '',
    ...(ctx.notes.length ? ['## Notes', ...ctx.notes.map((n) => `- ${n}`)] : []),
    '',
  ];
  fs.writeFileSync(path.join(config.outDir, 'latest.md'), lines.join('\n'));
  return jsonPath;
}
