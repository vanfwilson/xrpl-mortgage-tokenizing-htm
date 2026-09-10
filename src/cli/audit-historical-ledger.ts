import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Client } from 'xrpl';

// Read-only verification of the original audit baseline, never a legacy runner.
const baseline='3368b4860679f254bfc7fd4945e2a001a81c8a15';
const source=execFileSync('git',['show',`${baseline}:docs/devnet-run.md`],{encoding:'utf8'});
const hashes=[...new Set([...source.matchAll(/https:\/\/devnet\.xrpl\.org\/transactions\/([A-F0-9]{64})/g)].map(m=>m[1]))];
const ids=[...source.matchAll(/^- (\w+Id): `([A-F0-9]{64})`/gm)].map(m=>({name:m[1],index:m[2]}));
const endpoint='wss://s.devnet.rippletest.net:51233';
const client=new Client(endpoint,{timeout:20000});
const transactions:unknown[]=[],objects:unknown[]=[];
await client.connect();
try {
  for(let i=0;i<hashes.length;i+=4)await Promise.all(hashes.slice(i,i+4).map(async hash=>{
    try { const result=(await client.request({command:'tx',transaction:hash})).result;transactions.push({hash,url:`https://devnet.xrpl.org/transactions/${hash}`,status:result.validated?'VERIFIED':'UNVERIFIED',result}); }
    catch(error){transactions.push({hash,status:'UNVERIFIED',error:error instanceof Error?error.message:String(error)});}
  }));
  for(const object of ids){
    try { const result=(await client.request({command:'ledger_entry',index:object.index,ledger_index:'validated'})).result;objects.push({...object,status:result.validated?'VERIFIED':'UNVERIFIED',result}); }
    catch(error){objects.push({...object,status:'UNVERIFIED',error:error instanceof Error?error.message:String(error)});}
  }
} finally {await client.disconnect();}
const report={baseline,accessedAt:new Date().toISOString(),endpoint,method:'tx for every published hash; ledger_entry for each 256-bit object ID; no submissions',transactions,objects};
fs.writeFileSync('docs/evidence/original-audit-ledger.json',JSON.stringify(report,null,2)+'\n');
console.log(`Historical audit: ${transactions.length} tx lookups, ${objects.length} ledger_entry lookups. Errors explicitly UNVERIFIED.`);
