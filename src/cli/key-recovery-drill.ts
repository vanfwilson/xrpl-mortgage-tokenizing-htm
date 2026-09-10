import fs from 'node:fs';
import { Client, Wallet, multisign, type AccountSet, type TransactionMetadata } from 'xrpl';

const seeds = JSON.parse(fs.readFileSync('out/testnet-wallets.json','utf8'));
const owner=Wallet.fromSeed(seeds.newServicer), regular=Wallet.fromSeed(seeds.noteHolder);
const one=Wallet.fromSeed(seeds.issuer), two=Wallet.fromSeed(seeds.servicer);
const client=new Client('wss://s.altnet.rippletest.net:51233');
await client.connect();
try {
  const regularTx=await client.autofill({TransactionType:'AccountSet' as const,Account:owner.classicAddress});
  const regularResult=(await client.submitAndWait(regular.sign(regularTx).tx_blob)).result;
  if((regularResult.meta as TransactionMetadata).TransactionResult!=='tesSUCCESS')throw new Error('regular key recovery failed');
  const multiTx=await client.autofill<AccountSet>({TransactionType:'AccountSet',Account:owner.classicAddress,SigningPubKey:''});
  multiTx.Fee=String(Number(multiTx.Fee)*3);
  const first=one.sign(multiTx,true).tx_blob;
  const insufficient=(await client.submit(first)).result;
  if(insufficient.engine_result!=='tefBAD_QUORUM')throw new Error(`unexpected one-signer result: ${insufficient.engine_result}`);
  const result=(await client.submitAndWait(multisign([first,two.sign(multiTx,true).tx_blob]))).result;
  if((result.meta as TransactionMetadata).TransactionResult!=='tesSUCCESS')throw new Error('2-of-3 recovery failed');
  fs.writeFileSync('docs/evidence/key-recovery.json',JSON.stringify({network:'testnet',verifiedAt:new Date().toISOString(),account:owner.classicAddress,masterPreviouslyDisabled:true,regularKeyHash:regularResult.hash,oneSignerResult:insufficient.engine_result,twoSignersHash:result.hash,limitation:'Software test wallets only; HSM and organizational independence are not proved.'},null,2));
  console.log(`Regular-key recovery: ${regularResult.hash}; one signer: ${insufficient.engine_result}; 2-of-3 recovery: ${result.hash}`);
} finally {await client.disconnect();}
