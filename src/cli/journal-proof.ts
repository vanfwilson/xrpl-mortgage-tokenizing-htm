import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { Client,Wallet } from 'xrpl';
import { PostgresSettlementStore } from '../db/settlement-store.js';
import { XrplSettlementTransport } from '../xrpl/submission.js';
import { settleOnce } from '../xrpl/settlement-journal.js';
import { buildIssuedUsdPayment } from '../xrpl/settle.js';
const directory='out/journal-proof-pg';
let db=new PGlite(directory);
const companyId='00000000-0000-4000-8000-000000000001',loanId='00000000-0000-4000-8000-000000000002';
await db.exec(`create schema if not exists htm_mortgages;
  create table if not exists htm_mortgages.settlement_jobs(company_id uuid,loan_id uuid,run_id text,leg text,fingerprint char(64),status text,signed_blob text,tx_hash char(64),engine_result text,primary key(company_id,loan_id,run_id,leg));`);
const seeds=JSON.parse(fs.readFileSync('out/testnet-wallets.json','utf8'));
const sender=Wallet.fromSeed(seeds.servicer),payee=Wallet.fromSeed(seeds.noteHolder),issuer=Wallet.fromSeed(seeds.issuer);
const client=new Client('wss://s.altnet.rippletest.net:51233');
await client.connect();
try {
  const transport=new XrplSettlementTransport(client,sender);
  const tx=buildIssuedUsdPayment(sender.classicAddress,payee.classicAddress,issuer.classicAddress,{v:1,loan:'journal_proof',period:'2026-09',leg:'advance',cents:1,run:'journal_proof_v1'});
  const scope={companyId,loanId,run:'journal_proof_v1',leg:'advance'};
  const first=await settleOnce(scope,tx,new PostgresSettlementStore(db),transport);
  await db.close();db=new PGlite(directory);
  const second=await settleOnce(scope,tx,new PostgresSettlementStore(db),{prepare:async()=>{throw new Error('duplicate signing attempted');},submitOrFind:async()=>{throw new Error('duplicate submission attempted');}});
  if(first.hash!==second.hash)throw new Error('restart changed transaction hash');
  const evidence=(await client.request({command:'tx',transaction:first.hash})).result;
  fs.writeFileSync('docs/evidence/journal-proof.json',JSON.stringify({network:'testnet',verifiedAt:new Date().toISOString(),hash:first.hash,amountCents:1,reopenedDatabase:true,secondCallSkippedSigningAndSubmission:true,evidence},null,2));
  console.log(`Persistent idempotency across database reopen: ${first.hash}`);
} finally {await db.close();await client.disconnect();}
