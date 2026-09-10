import { describe,it,expect } from 'vitest';
import { buildCanonicalFromDocuments } from '../src/ingest/canonical.js';
import { buildFullYearReplay } from '../src/servicing/replay.js';
import { verifyEventChain } from '../src/servicing/event-log.js';
import { buildTokenEscrow } from '../src/xrpl/escrow.js';
const loan=buildCanonicalFromDocuments('data/documents');
describe('E coupled loan-year cash books',()=>{
  it('ties twelve receipts, opening deposit, advance, bills and ending cash to the cent',()=>{
    const proof=buildFullYearReplay(loan,new Date('2026-11-01T00:00:00Z'));
    const ledger=proof.impoundLedger;
    expect(ledger).toMatchObject({openingCents:123050,totalDepositsCents:713136,totalAdvancesCents:40170,totalDisbursementsCents:713136,closingCents:163220});
    expect(ledger.advances).toEqual([{billId:'tax-2026-1',requestedCents:40170,confirmedCents:40170,confirmation:'simulated_bank_confirmation'}]);
    expect(ledger.balances).toEqual({tax:114000,hazard:49220,mip:0});
    expect(ledger.monthly).toHaveLength(12);expect(ledger.monthly.every(m=>m.tax>=0&&m.hazard>=0&&m.mip===0)).toBe(true);
    expect(ledger.events.filter(e=>e.kind==='disbursement')).toHaveLength(15);
    expect(verifyEventChain(proof.eventChain)).toBe(true);
  });
  it('rejects an arbitrary replay start instead of mixing it with hardcoded statutory dates',()=>{
    expect(()=>buildFullYearReplay(loan,new Date('2026-01-01T00:00:00Z'))).toThrow(/first payment/);
  });
});
describe('D actual-issuer and escrow-horizon guards',()=>{
  const base={account:'rOwner',destination:'rPayee',issuer:'rIssuer',amountCents:100,finishAfterUnix:1800000000,cancelAfterUnix:1800000100,allowlist:['rPayee'],issuerInfo:{validated:true,account_data:{Account:'rIssuer',Flags:0x40000000}}};
  it('refuses another issuer or unvalidated account snapshot even if locking is true',()=>{
    expect(buildTokenEscrow(base).Amount).toMatchObject({value:'1.00'});
    expect(()=>buildTokenEscrow({...base,issuerInfo:{...base.issuerInfo,validated:false}})).toThrow(/identity/);
    expect(()=>buildTokenEscrow({...base,issuer:'rOther'})).toThrow(/identity/);
    expect(()=>buildTokenEscrow({...base,issuerInfo:{account_flags:{allowTrustLineLocking:true}}})).toThrow(/identity/);
  });
  it('accepts the uint32 ceiling but refuses overflow and unbounded recovery windows',()=>{
    const ceiling=946684800+0xffffffff;
    expect(buildTokenEscrow({...base,finishAfterUnix:ceiling-60,cancelAfterUnix:ceiling}).CancelAfter).toBe(0xffffffff);
    expect(()=>buildTokenEscrow({...base,finishAfterUnix:ceiling-60,cancelAfterUnix:ceiling+1})).toThrow(/uint32/);
    expect(()=>buildTokenEscrow({...base,cancelAfterUnix:base.finishAfterUnix+46*86400})).toThrow(/45-day/);
  });
});
