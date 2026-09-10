import fs from 'node:fs';
import { Client } from 'xrpl';
import { hashDocumentBundle } from '../domain/hash.js';
import type { TxRecord } from '../xrpl/client.js';

const proof = JSON.parse(fs.readFileSync('out/testnet-run.json', 'utf8'));
const replay = JSON.parse(fs.readFileSync('out/servicing-year-proof.json', 'utf8'));
const records = proof.transactions as TxRecord[];
const existingReport=fs.existsSync('docs/testnet-run.md')?fs.readFileSync('docs/testnet-run.md','utf8'):'';
const supplemental=existingReport.includes('## Supplemental validation')?'\n## Supplemental validation'+existingReport.split('## Supplemental validation')[1]:'';
const client = new Client('wss://s.altnet.rippletest.net:51233');
const decoded: Record<string, any> = {};
await client.connect();
try {
  // Independently decode every published hash, including the expected failure.
  for (let i = 0; i < records.length; i += 6) {
    await Promise.all(records.slice(i, i + 6).map(async r => {
      const response = await client.request({ command: 'tx', transaction: r.hash });
      const value = response.result as any;
      if (!value.validated || value.meta.TransactionResult !== r.result) throw new Error(`ledger mismatch: ${r.step}`);
      decoded[r.step] = { hash: r.hash, ledgerIndex: value.ledger_index, closeTime: value.close_time_iso, tx: value.tx_json, meta: value.meta };
    }));
  }
  const info = await client.request({ command: 'server_info' });
  proof.verifiedAt = new Date().toISOString();
  proof.serverInfo = info.result.info;
  const payments = records.filter(r => r.step.startsWith('payment-'));
  if (payments.length !== 48) throw new Error('expected 12 months x 4 settlement legs');
  for (let month = 1; month <= 12; month++) {
    const group = payments.filter(r => r.step.startsWith(`payment-${String(month).padStart(2, '0')}-`));
    const cents = group.reduce((sum, r) => { const tx=decoded[r.step].tx; return sum + Math.round(Number((tx.DeliverMax ?? tx.Amount).value) * 100); }, 0);
    if (group.length !== 4 || cents !== 336501) throw new Error(`month ${month}: settlement conservation failed`);
  }
  const mint = decoded['nft-mint-loan-record'].tx;
  const uri = JSON.parse(Buffer.from(mint.URI, 'hex').toString());
  if (uri.sha256 !== hashDocumentBundle('data/documents').bundle_sha256) throw new Error('minted bundle hash mismatch');
  const early = decoded['escrow-finish-before-finishafter'];
  const create = decoded['escrow-create-tax-dec'];
  if (early.tx.date >= create.tx.FinishAfter || early.meta.TransactionResult !== 'tecNO_PERMISSION') throw new Error('early finish evidence invalid');
  for (const name of ['tax-dec', 'tax-jun', 'hazard-sep']) {
    const c = decoded[`escrow-create-${name}`].tx, f = decoded[`escrow-finish-${name}`].tx;
    if (f.date <= c.FinishAfter || f.date >= c.CancelAfter || f.OfferSequence !== c.Sequence || f.Owner !== c.Account) throw new Error('finish timing/object mismatch');
  }
  const cancelled = decoded['escrow-cancel-after-cancelafter'];
  if (cancelled.tx.date <= decoded['escrow-create-cancel-path'].tx.CancelAfter) throw new Error('cancel timing mismatch');
  proof.decoded = decoded;
} finally { await client.disconnect(); }

fs.mkdirSync('docs/evidence', { recursive: true });
fs.writeFileSync('docs/evidence/testnet-run.json', JSON.stringify(proof, null, 2));
fs.writeFileSync('docs/evidence/servicing-year-proof.json', JSON.stringify(replay, null, 2));
const form = replay.events.find((e: any) => e.type === 'form_1098');
fs.writeFileSync('docs/form-1098-example.json', JSON.stringify({ label: form.label, ...form.data }, null, 2));
const map = {
  schema: 'htm.timestamp-mapping/1', network: proof.network,
  warning: 'Compressed demonstration. These ledger dates are not real statutory due dates or payee receipts.',
  businessYear: { start: '2026-11-01', end: '2027-10-31' },
  monthlyMapping: Array.from({ length: 12 }, (_, i) => ({ receipt: i+1, businessPeriod: new Date(Date.UTC(2026,10+i,1)).toISOString().slice(0,7), ledgerMemoPeriod: `2026-${String(i+1).padStart(2,'0')}` })),
  escrows: [['tax-dec','2026-12-20'],['tax-jun','2027-06-20'],['hazard-sep','2027-09-01']].map(([name,dueDate]) => {
    const c = decoded[`escrow-create-${name}`];
    return { name, dueDate, finishAfter: c.tx.FinishAfter, cancelAfter: c.tx.CancelAfter, finishUtc: new Date((c.tx.FinishAfter+946684800)*1000).toISOString(), createHash: c.hash, finishHash: decoded[`escrow-finish-${name}`].hash, amount: c.tx.Amount };
  }),
};
fs.writeFileSync('docs/timestamp-mapping.json', JSON.stringify(map, null, 2));
const intro = `# Testnet servicing evidence\n\nVerified ${proof.verifiedAt}. Endpoint: ${proof.network}.\n\nThe borrower pays **once per month**. This proof contains **12 monthly borrower receipt cycles and 48 settlement transfers**, four transfers per receipt. Each modeled receipt is $3,365.01: $2,770.73 P&I, $285 tax, $125 hazard, and $184.28 FHA MIP. Borrower receipts are modeled in the private replay; Testnet starts with issuer-funded servicer tokens, not an ACH connection.\n\nThe completed run has ${records.length} transactions: 80 successes and one expected early-finish rejection. All hashes were independently fetched with tx RPC and validated status/result checked. Three escrows finished in their allowed windows; a fourth was cancelled.\n\n[Decoded evidence](evidence/testnet-run.json) · [Timestamp mapping](timestamp-mapping.json) · [Business replay](evidence/servicing-year-proof.json) · [Build report](build-validation-2026-09-09.md).\n\n## Scope of the proof\n\nUSD is issued by ${proof.asset.issuer}; it is controlled test USD. The small run reuses noteHolder/newServicer wallets as synthetic payee destinations; no county, insurer, HUD, bank or borrower received real money. Cancellation returns tokens to the escrow owner; the transaction submitter cannot choose another recovery destination. Three normal bill escrows require 0.6 XRP of incremental owner reserve; four concurrent escrows in this cancellation test require 0.8 XRP, excluding accounts, trust lines, NFT pages, signer lists and fees. Repeated failed runs left additional sandbox objects; these are not per-loan requirements.\n\nIssuer DefaultRipple must precede new trust lines. Existing issuer-side NoRipple flags require explicit clearing. The initial failed attempts returned tecPATH_DRY; a too-short CancelAfter also correctly refused a late finish. The final run uses a one-hour cancellation bound.\n\nThe key transactions prove configuration only. The original runner supplied a boolean recovery-drill assertion; that alone is not proof of an HSM recovery or two-signature spend. Production key custody remains an operational requirement.\n\n## Hashes\n\n| Step | Type | Result | Transaction |\n|---|---|---|---|\n`;
fs.writeFileSync('docs/testnet-run.md', intro + records.map(r=>`| ${r.step} | ${r.type} | ${r.result} | [${r.hash}](${r.explorer}) |`).join('\n')+'\n'+supplemental);
const cases = replay.events.filter((e:any)=>['analysis_surplus','analysis_shortage'].includes(e.type));
let analysis = '# Aggregate escrow examples\n\nGenerated from the deterministic replay. Base monthly deposit is annual disbursements / 12; recovery is a separate election. Target balances use the zero-opening trial minimum plus the allowed cushion. Source: [12 CFR 1024.17](https://www.consumerfinance.gov/rules-policy/regulations/1024/17/), accessed 2026-09-09. Amounts below are integer USD cents.\n';
for (const e of cases) {
  const a=e.data;
  analysis += `\n## ${e.type}\n\nAnnual disbursements ${a.annualDisbursementsCents}; base monthly deposit ${a.newMonthlyDepositCents}; cushion ${a.cushionCents}; target opening ${a.targetOpeningCents}; ${a.classification} ${a.amountCents}; allowed options: ${a.options.join(', ')}.\n\n| Month | Deposit | Disbursement | Target closing balance |\n|---|---:|---:|---:|\n`;
  analysis += a.trialBalances.map((r:any)=>`| ${r.month} | ${r.depositCents} | ${r.disbursedCents} | ${r.endingBalanceCents} |`).join('\n')+'\n';
}
fs.writeFileSync('docs/escrow-analysis-example.md',analysis);
console.log(`Verified ${records.length} Testnet hashes and published evidence; 12 receipts / 48 settlement transfers.`);
