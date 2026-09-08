import { describe, expect, it } from 'vitest';
import { assertNoPii, buildMemo, MAX_MEMO_BYTES } from '../../src/xrpl/settle.js';
import { buildRecordUri, MAX_URI_BYTES } from '../../src/xrpl/record.js';
import { reserveForObjects, validateEscrowBuild } from '../../src/xrpl/escrow.js';
import { usdAmount } from '../../src/xrpl/client.js';
import { buildCanonicalFromDocuments } from '../../src/ingest/canonical.js';

const loan = buildCanonicalFromDocuments('data/documents');

describe('ledger payload guards', () => {
  it('T11_no_pii_in_memo: memo is versioned, ≤ 256 bytes, and refuses PII keys', () => {
    const memos = buildMemo({ v: 1, loan: 'L-0001', period: '2026-11', leg: 'tax', cents: 28_500, run: 'run-1' });
    const json = Buffer.from(memos[0].Memo.MemoData!, 'hex').toString('utf8');
    expect(JSON.parse(json)).toEqual({ v: 1, loan: 'L-0001', period: '2026-11', leg: 'tax', cents: 28_500, run: 'run-1' });
    expect(Buffer.byteLength(json)).toBeLessThanOrEqual(MAX_MEMO_BYTES);
    expect(() => buildMemo({ v: 1, loan: 'L', period: '2026-11', leg: 'tax', cents: 1, run: 'r', apn: 'R993821-0014' } as never)).toThrow(/S10/);
    expect(() => assertNoPii({ loan: 'x', borrower_name: 'Jordan' })).toThrow(/S10/);
    expect(() => assertNoPii({ fha_case_number: '411-9928340-703' })).toThrow(/S10/);
    expect(() => assertNoPii({ nested: { street: '123 Sandbox Lane' } })).toThrow(/S10/);
    expect(() => assertNoPii(loan.property)).toThrow(/S10/); // the canonical property block must never be a payload
  });
  it('R28_no_pii_payloads: the NFToken URI carries only version, opaque id, hash and pointer', () => {
    const uri = buildRecordUri({ v: 1, loan: 'L-0001', sha256: 'a'.repeat(64), ptr: 'cas://htm/loan/L-0001/v1' });
    expect(Buffer.byteLength(uri)).toBeLessThanOrEqual(MAX_URI_BYTES);
    expect(Object.keys(JSON.parse(uri))).toEqual(['v', 'loan', 'sha256', 'ptr']);
    expect(() => buildRecordUri({ v: 1, loan: 'MORT-2026-88492X/123 Sandbox Lane', sha256: 'a'.repeat(64), ptr: 'x' })).toThrow();
    expect(() => buildRecordUri({ v: 1, loan: 'L', sha256: 'zz', ptr: 'x' })).toThrow();
    expect(() => buildRecordUri({ v: 1, loan: 'L', sha256: 'a'.repeat(64), ptr: 'p'.repeat(300) })).toThrow(/256/);
  });
  it('T7_record_token: URI ≤ 256 bytes with the bundle sha256', () => {
    const uri = JSON.parse(buildRecordUri({ v: 1, loan: 'L-0001', sha256: 'c950d51d745ffb77c94fb17a47a252fb175cf9fd46b7adf40164a699f8079cb0', ptr: 'cas://v1' }));
    expect(uri.sha256).toHaveLength(64);
  });
  it('S7 escrow build: allowlisted destination, CancelAfter after FinishAfter, positive cents', () => {
    const ok = { from: 'taxImpound' as const, to: 'countyTreasurer' as const, cents: 171_000, finish_after: 1000, cancel_after: 2000, memo: { v: 1 as const, loan: 'L', period: '2026-12', leg: 'tax' as const, cents: 171_000, run: 'r' }, allowlist: ['countyTreasurer', 'insuranceCarrier'] as const };
    expect(() => validateEscrowBuild(ok)).not.toThrow();
    expect(() => validateEscrowBuild({ ...ok, to: 'homeowner' })).toThrow(/allowlist/);
    expect(() => validateEscrowBuild({ ...ok, cancel_after: 1000 })).toThrow(/CancelAfter/);
    expect(() => validateEscrowBuild({ ...ok, cents: 0 })).toThrow();
    expect(reserveForObjects(3)).toBe(600_000);
  });
  it('exact-cent issued amounts, never XRP', () => {
    expect(usdAmount('rIssuer', 336_501)).toEqual({ currency: 'USD', issuer: 'rIssuer', value: '3365.01' });
    expect(() => usdAmount('rIssuer', 10.5)).toThrow();
  });
});
