import { AccountSetAsfFlags, TrustSetFlags } from 'xrpl';
import { describe, expect, it } from 'vitest';
import { assertIssuerLocking, buildClearIssuerNoRipple, buildEnableDefaultRipple, buildEnableTrustLineLocking, buildUsdTrustLine, LSF_ALLOW_TRUST_LINE_LOCKING } from '../../src/xrpl/issuer.js';
import { buildTwoOfThree } from '../../src/xrpl/keys.js';

const ISSUER = 'rIssuerXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const HOLDER = 'rHolderXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const OTHER = 'rOtherXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

const validInfo = () => ({ validated: true, account_flags: { allowTrustLineLocking: true, defaultRipple: true }, account_data: { Account: ISSUER, Flags: LSF_ALLOW_TRUST_LINE_LOCKING } });

describe('S5 issuer preflight and R27 key builders', () => {
  it('T9_issuer_identity_and_flag', () => {
    expect(assertIssuerLocking(validInfo(), ISSUER)).toBe(true);
    // raw Flags bit alone is enough when account_flags is absent (older rippled / v1 API)
    expect(assertIssuerLocking({ validated: true, account_data: { Account: ISSUER, Flags: LSF_ALLOW_TRUST_LINE_LOCKING } }, ISSUER)).toBe(true);
    // (a) flag false
    expect(() => assertIssuerLocking({ ...validInfo(), account_flags: { allowTrustLineLocking: false }, account_data: { Account: ISSUER, Flags: 0 } }, ISSUER)).toThrow(/^S5: .*allowTrustLineLocking=false/);
    // (b) validated false / missing
    expect(() => assertIssuerLocking({ ...validInfo(), validated: false }, ISSUER)).toThrow(/^S5: .*validated/);
    expect(() => assertIssuerLocking({ ...validInfo(), validated: undefined }, ISSUER)).toThrow(/^S5: .*validated/);
    // (c) wrong account
    expect(() => assertIssuerLocking({ ...validInfo(), account_data: { Account: OTHER, Flags: LSF_ALLOW_TRUST_LINE_LOCKING } }, ISSUER)).toThrow(/^S5: .*expected rIssuer/);
    expect(() => assertIssuerLocking({ ...validInfo(), account_data: undefined }, ISSUER)).toThrow(/^S5: /);
    // builders
    expect(buildEnableTrustLineLocking(ISSUER)).toEqual({ TransactionType: 'AccountSet', Account: ISSUER, SetFlag: AccountSetAsfFlags.asfAllowTrustLineLocking });
    expect(buildEnableDefaultRipple(ISSUER)).toEqual({ TransactionType: 'AccountSet', Account: ISSUER, SetFlag: AccountSetAsfFlags.asfDefaultRipple });
    expect(buildUsdTrustLine(HOLDER, ISSUER, '500')).toEqual({ TransactionType: 'TrustSet', Account: HOLDER, LimitAmount: { currency: 'USD', issuer: ISSUER, value: '500' } });
    expect(buildUsdTrustLine(HOLDER, ISSUER).LimitAmount.value).toBe('100000000');
  });

  it('R27_two_of_three_builder', () => {
    const tx = buildTwoOfThree(ISSUER, [HOLDER, OTHER, 'rThirdXXXXXXXXXXXXXXXXXXXXXXXXXXXXX']);
    expect(tx.TransactionType).toBe('SignerListSet');
    expect(tx.Account).toBe(ISSUER);
    expect(tx.SignerQuorum).toBe(2);
    expect(tx.SignerEntries).toHaveLength(3);
    expect(tx.SignerEntries!.map((e) => e.SignerEntry.SignerWeight)).toEqual([1, 1, 1]);
    expect(tx.SignerEntries!.map((e) => e.SignerEntry.Account)).toEqual([HOLDER, OTHER, 'rThirdXXXXXXXXXXXXXXXXXXXXXXXXXXXXX']);
    expect(() => buildTwoOfThree(ISSUER, [HOLDER, HOLDER, OTHER])).toThrow(/R27/);
    expect(() => buildTwoOfThree(ISSUER, [ISSUER, HOLDER, OTHER])).toThrow(/R27/);
  });

  it('S5_noripple_repair_builder', () => {
    const tx = buildClearIssuerNoRipple(ISSUER, HOLDER);
    expect(tx).toEqual({ TransactionType: 'TrustSet', Account: ISSUER, LimitAmount: { currency: 'USD', issuer: HOLDER, value: '0' }, Flags: TrustSetFlags.tfClearNoRipple });
    expect(tx.Flags).toBe(0x00040000);
    expect(tx.LimitAmount.value).toBe('0');
  });
});
