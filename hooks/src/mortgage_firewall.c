/*
 * MortgageOS payment firewall — an XRPL Hook (C -> WASM) for the Xahau network.
 *
 * Installed on the servicer's custodial account. For every incoming XRP Payment it enforces two off-chain-set
 * parameters supplied at install / update time through HookParameters (state_set is only callable from inside a hook,
 * so the servicer pushes updates with SetHook, as the v3 design notes described):
 *   EXP  8 bytes, big-endian drops  — the scheduled amount; a smaller payment is rolled back
 *   FRZ  1 byte                      — 0x01 freezes the account: every payment in or out is rolled back
 * Non-payment transactions are always accepted so the servicer can still administer the hook while frozen.
 * Non-XRP amounts are accepted here and checked by the off-chain engine (this network has no MPT).
 *
 * Not part of the MortgageOS v3 demo: Hooks are not enabled on XRPL Mainnet or Testnet (verified 2026-09-11).
 */
#include "hookapi.h"

#define FRZ_PARAM "FRZ"
#define EXP_PARAM "EXP"

int64_t cbak(uint32_t reserved) { return 0; }

int64_t hook(uint32_t reserved)
{
    _g(1, 1);

    if (otxn_type() != ttPAYMENT)
        accept(SBUF("MortgageOS: non-payment, passed"), 0);

    uint8_t frz[1];
    if (hook_param(SBUF(frz), (uint32_t)FRZ_PARAM, 3) == 1 && frz[0] == 0x01)
        rollback(SBUF("MortgageOS: account frozen"), 10);

    uint8_t hook_acc[20];
    hook_account(SBUF(hook_acc));
    uint8_t otxn_acc[20];
    otxn_field(SBUF(otxn_acc), sfAccount);
    if (BUFFER_EQUAL_20(hook_acc, otxn_acc))
        accept(SBUF("MortgageOS: outgoing payment, passed"), 0);

    uint8_t amt[48];
    int64_t amt_len = otxn_field(SBUF(amt), sfAmount);
    if (amt_len != 8)
        accept(SBUF("MortgageOS: non-XRP amount, checked off-ledger"), 0);

    int64_t drops = AMOUNT_TO_DROPS(amt);
    if (drops < 0)
        rollback(SBUF("MortgageOS: malformed amount"), 20);

    uint8_t exp[8];
    if (hook_param(SBUF(exp), (uint32_t)EXP_PARAM, 3) != 8)
        rollback(SBUF("MortgageOS: EXP parameter missing"), 30);

    uint64_t expected = UINT64_FROM_BUF(exp);
    if ((uint64_t)drops < expected)
        rollback(SBUF("MortgageOS: payment below scheduled amount"), 40);

    accept(SBUF("MortgageOS: scheduled payment accepted"), 0);
    return 0;
}
