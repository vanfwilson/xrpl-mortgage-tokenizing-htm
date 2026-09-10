import fs from 'node:fs';
import { Client, Wallet, type SubmittableTransaction, type TransactionMetadata } from 'xrpl';
import { config, type Role } from '../config.js';
import { buildCanonicalFromDocuments } from '../ingest/canonical.js';
import { buildClearIssuerNoRipple, buildEnableDefaultRipple, buildEnableTrustLineLocking, buildUsdTrustLine, assertIssuerLocking } from '../xrpl/issuer.js';
import { buildLoanRecordMint, buildServicingTransferOffer, buildAcceptServicingTransfer } from '../xrpl/record.js';
import { buildIssuedUsdPayment } from '../xrpl/settle.js';
import { buildTokenEscrow, buildEscrowCancel, buildEscrowFinish, escrowOwnerReserveDrops } from '../xrpl/escrow.js';
import { buildDisableMaster, buildRegularKey, buildTwoOfThree } from '../xrpl/keys.js';
import { createdNodeId, submit, type TxRecord } from '../xrpl/client.js';

type LiveRole = Extract<Role, 'issuer' | 'servicer' | 'noteHolder' | 'taxImpound' | 'hazardImpound' | 'mipPayable' | 'newServicer'>;
const roles: LiveRole[] = ['issuer', 'servicer', 'noteHolder', 'taxImpound', 'hazardImpound', 'mipPayable', 'newServicer'];
const walletPath = 'out/testnet-wallets.json';
if (fs.existsSync('out/testnet-run.json')) throw new Error('Completed evidence exists. This demonstration is single-run; do not replay borrower allocations. Use the evidence verifier instead.');
const loan = buildCanonicalFromDocuments('data/documents');
const client = new Client(config.wss);
const records: TxRecord[] = [];

async function wallets() {
  fs.mkdirSync('out', { recursive: true });
  const seeds: Partial<Record<LiveRole, string>> = fs.existsSync(walletPath) ? JSON.parse(fs.readFileSync(walletPath, 'utf8')) : {};
  const result = {} as Record<LiveRole, Wallet>;
  for (const role of roles) {
    if (seeds[role]) result[role] = Wallet.fromSeed(seeds[role]!);
    else { const funded = await client.fundWallet(); result[role] = funded.wallet; seeds[role] = funded.wallet.seed!; console.log(`funded ${role} ${funded.wallet.classicAddress}`); }
  }
  fs.writeFileSync(walletPath, JSON.stringify(seeds, null, 2));
  return result;
}
async function ok(wallet: Wallet, tx: SubmittableTransaction, step: string) { const r = await submit(client, wallet, tx, step); records.push(r); console.log(`${step}: ${r.result} ${r.hash}`); return r; }
async function expectedFailure(wallet: Wallet, tx: SubmittableTransaction, step: string) {
  const prepared = await client.autofill(tx); const signed = wallet.sign(prepared); const res = await client.submitAndWait(signed.tx_blob);
  const meta = res.result.meta as TransactionMetadata; const result = meta.TransactionResult;
  const record: TxRecord = { step, type: tx.TransactionType, account: tx.Account, hash: res.result.hash, result, explorer: `${config.explorer}/transactions/${res.result.hash}`, ledgerIndex: res.result.ledger_index, meta };
  if (result === 'tesSUCCESS') throw new Error(`${step} unexpectedly succeeded`);
  records.push(record); console.log(`${step}: expected ${result} ${record.hash}`); return record;
}

await client.connect();
try {
  const w = await wallets();
  await ok(w.issuer, buildEnableTrustLineLocking(w.issuer.classicAddress), 'issuer-enable-trustline-locking');
  await ok(w.issuer, buildEnableDefaultRipple(w.issuer.classicAddress), 'issuer-enable-default-ripple');
  const info = await client.request({ command: 'account_info', account: w.issuer.classicAddress, ledger_index: 'validated' });
  assertIssuerLocking(info.result as never);
  for (const role of roles.filter(r => r !== 'issuer')) {
    await ok(w[role], buildUsdTrustLine(w[role].classicAddress, w.issuer.classicAddress, '1000000'), `trustline-${role}`);
    await ok(w.issuer, buildClearIssuerNoRipple(w.issuer.classicAddress, w[role].classicAddress), `issuer-clear-noripple-${role}`);
  }
  await ok(w.issuer, buildIssuedUsdPayment(w.issuer.classicAddress, w.servicer.classicAddress, w.issuer.classicAddress, { v: 1, loan: loan.loan.loan_id, period: '2026-00', leg: 'advance', cents: 10_000_000, run: 'testnet_issue_1' }), 'issue-test-usd');

  const fund = async (dest: LiveRole, cents: number, leg: 'tax' | 'hazard' | 'mip') => ok(w.servicer, buildIssuedUsdPayment(w.servicer.classicAddress, w[dest].classicAddress, w.issuer.classicAddress, { v: 1, loan: loan.loan.loan_id, period: '2026-00', leg, cents, run: `escrow_fund_${leg}` }), `fund-${leg}-escrow-source`);
  await fund('taxImpound', 342_000, 'tax'); await fund('hazardImpound', 150_000, 'hazard'); await fund('mipPayable', 10_000, 'mip');
  const now = Math.floor(Date.now() / 1000), finish = now + 25, cancel = now + 3_600;
  const lockInfo = { account_flags: { allowTrustLineLocking: true } };
  const escrowSpecs = [
    { name: 'tax-dec', owner: 'taxImpound' as const, dest: 'noteHolder' as const, cents: 171000 },
    { name: 'tax-jun', owner: 'taxImpound' as const, dest: 'newServicer' as const, cents: 171000 },
    { name: 'hazard-sep', owner: 'hazardImpound' as const, dest: 'noteHolder' as const, cents: 125000 },
  ];
  const escrows: Array<{ name: string; owner: LiveRole; sequence: number }> = [];
  for (const e of escrowSpecs) {
    const tx = buildTokenEscrow({ account: w[e.owner].classicAddress, destination: w[e.dest].classicAddress, issuer: w.issuer.classicAddress, amountCents: e.cents, finishAfterUnix: finish, cancelAfterUnix: cancel, issuerInfo: lockInfo, allowlist: [w[e.dest].classicAddress] });
    const prepared = await client.autofill(tx); const sequence = prepared.Sequence!; const signed = w[e.owner].sign(prepared); const res = await client.submitAndWait(signed.tx_blob); const meta = res.result.meta as TransactionMetadata;
    const record: TxRecord = { step: `escrow-create-${e.name}`, type: tx.TransactionType, account: tx.Account, hash: res.result.hash, result: meta.TransactionResult, explorer: `${config.explorer}/transactions/${res.result.hash}`, ledgerIndex: res.result.ledger_index, meta };
    if (record.result !== 'tesSUCCESS') throw new Error(`${record.step}: ${record.result}`); records.push(record); escrows.push({ name: e.name, owner: e.owner, sequence }); console.log(`${record.step}: ${record.hash}`);
  }
  await expectedFailure(w.servicer, buildEscrowFinish(w.servicer.classicAddress, w[escrows[0].owner].classicAddress, escrows[0].sequence), 'escrow-finish-before-finishafter');
  const cancelTx = buildTokenEscrow({ account: w.mipPayable.classicAddress, destination: w.noteHolder.classicAddress, issuer: w.issuer.classicAddress, amountCents: 100, finishAfterUnix: now + 25, cancelAfterUnix: now + 80, issuerInfo: lockInfo, allowlist: [w.noteHolder.classicAddress] });
  const cancelPrepared = await client.autofill(cancelTx); const cancelSequence = cancelPrepared.Sequence!; const cancelSigned = w.mipPayable.sign(cancelPrepared); const cancelRes = await client.submitAndWait(cancelSigned.tx_blob); const cancelMeta = cancelRes.result.meta as TransactionMetadata;
  if (cancelMeta.TransactionResult !== 'tesSUCCESS') throw new Error(`escrow-create-cancel-path: ${cancelMeta.TransactionResult}`);
  records.push({ step: 'escrow-create-cancel-path', type: cancelTx.TransactionType, account: cancelTx.Account, hash: cancelRes.result.hash, result: cancelMeta.TransactionResult, explorer: `${config.explorer}/transactions/${cancelRes.result.hash}`, ledgerIndex: cancelRes.result.ledger_index, meta: cancelMeta });

  const mint = await ok(w.servicer, buildLoanRecordMint(w.servicer.classicAddress, { schema: 'htm.loan-record', version: 1, loan: loan.loan.loan_id, sha256: 'b042d9188e3a94cfbf4c19e88d451da764c9ca08a10ce9196e97601598df6dd3', ptr: 'ipfs://bafybeihighttechmortgage' }), 'nft-mint-loan-record');
  const nfts = await client.request({ command: 'account_nfts', account: w.servicer.classicAddress, ledger_index: 'validated' }); const nftId = nfts.result.account_nfts.at(-1)!.NFTokenID;
  const legs = [
    ['pi', 'noteHolder', Math.round(loan.servicing.principal_and_interest * 100)], ['tax', 'taxImpound', Math.round(loan.servicing.property_tax_impound * 100)],
    ['hazard', 'hazardImpound', Math.round(loan.servicing.hazard_insurance_impound * 100)], ['mip', 'mipPayable', Math.round(loan.servicing.fha_mip_payable * 100)],
  ] as const;
  for (let month = 1; month <= 12; month++) for (const [leg, role, cents] of legs) await ok(w.servicer, buildIssuedUsdPayment(w.servicer.classicAddress, w[role].classicAddress, w.issuer.classicAddress, { v: 1, loan: loan.loan.loan_id, period: `2026-${String(month).padStart(2, '0')}`, leg, cents, run: `year_${month}` }), `payment-${String(month).padStart(2, '0')}-${leg}`);
  for (const e of escrows) await ok(w.servicer, buildEscrowFinish(w.servicer.classicAddress, w[e.owner].classicAddress, e.sequence), `escrow-finish-${e.name}`);
  await ok(w.newServicer, buildEscrowCancel(w.newServicer.classicAddress, w.mipPayable.classicAddress, cancelSequence), 'escrow-cancel-after-cancelafter');
  const offer = await ok(w.servicer, buildServicingTransferOffer(w.servicer.classicAddress, nftId, w.newServicer.classicAddress), 'nft-transfer-offer');
  const offerId = createdNodeId(offer.meta, 'NFTokenOffer'); await ok(w.newServicer, buildAcceptServicingTransfer(w.newServicer.classicAddress, offerId), 'nft-transfer-accept');
  await ok(w.newServicer, buildTwoOfThree(w.newServicer.classicAddress, [w.issuer.classicAddress, w.servicer.classicAddress, w.noteHolder.classicAddress]), 'keys-signerlist-2of3');
  await ok(w.newServicer, buildRegularKey(w.newServicer.classicAddress, w.noteHolder.classicAddress), 'keys-regular-key');
  await ok(w.newServicer, buildDisableMaster(w.newServicer.classicAddress, true), 'keys-disable-master-after-drill');
  const proof = { schema: 'htm.testnet-run/1', generatedAt: new Date().toISOString(), network: config.wss, explorer: config.explorer, asset: { currency: 'USD', issuer: w.issuer.classicAddress, label: 'controlled test USD; not RLUSD, a deposit, or borrower funds', allowTrustLineLocking: true }, accounts: Object.fromEntries(roles.map(r => [r, w[r].classicAddress])), nftId, reserve: { baseDrops: 1_000_000, ownerObjectDrops: 200_000, maximumConcurrentEscrows: 4, escrowOwnerReserveDrops: escrowOwnerReserveDrops(4) }, transactions: records.map(({ meta: _meta, ...r }) => r) };
  fs.writeFileSync('out/testnet-run.json', JSON.stringify(proof, null, 2)); console.log(`wrote out/testnet-run.json (${records.length} transactions; mint ${mint.hash})`);
} finally { await client.disconnect(); }
