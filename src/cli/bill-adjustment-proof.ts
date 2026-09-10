import fs from 'node:fs';
import { Client, Wallet, type TransactionMetadata } from 'xrpl';
import { buildTokenEscrow, buildEscrowFinish } from '../xrpl/escrow.js';
const path='docs/evidence/hazard-adjustment.json';
if(fs.existsSync(path))throw new Error('Adjustment already proved; refusing duplicate disbursement');
const seeds=JSON.parse(fs.readFileSync('out/testnet-wallets.json','utf8'));
const owner=Wallet.fromSeed(seeds.hazardImpound),issuer=Wallet.fromSeed(seeds.issuer),payee=Wallet.fromSeed(seeds.noteHolder);
const client=new Client('wss://s.altnet.rippletest.net:51233');
await client.connect();
try {
  const info=(await client.request({command:'account_info',account:issuer.classicAddress,ledger_index:'validated'})).result;
  const now=Math.floor(Date.now()/1000);
  const create=await client.autofill(buildTokenEscrow({account:owner.classicAddress,destination:payee.classicAddress,issuer:issuer.classicAddress,amountCents:25000,finishAfterUnix:now+15,cancelAfterUnix:now+3600,issuerInfo:info as never,allowlist:[payee.classicAddress]}));
  const created=(await client.submitAndWait(owner.sign(create).tx_blob)).result;
  if((created.meta as TransactionMetadata).TransactionResult!=='tesSUCCESS')throw new Error('adjustment create failed');
  await new Promise(r=>setTimeout(r,20000));
  const finish=await client.autofill(buildEscrowFinish(owner.classicAddress,owner.classicAddress,create.Sequence!));
  const finished=(await client.submitAndWait(owner.sign(finish).tx_blob)).result;
  if((finished.meta as TransactionMetadata).TransactionResult!=='tesSUCCESS')throw new Error('adjustment finish failed');
  fs.writeFileSync(path,JSON.stringify({network:'testnet',verifiedAt:new Date().toISOString(),originalBillCents:125000,correctedBillCents:150000,adjustmentCents:25000,createHash:created.hash,finishHash:finished.hash,create,finish,createdMeta:created.meta,finishedMeta:finished.meta},null,2));
  console.log(`Corrected hazard bill: 125000 + 25000 = 150000 cents. Create ${created.hash}; finish ${finished.hash}`);
} finally {await client.disconnect();}
