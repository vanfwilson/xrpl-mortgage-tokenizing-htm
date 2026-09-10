import type { Cents } from './apply.js';
/** R14/R22 — bank cash is authoritative; any difference raises. */
export function reconcileThreeWay(bankCents: Cents, servicingCents: Cents, ledgerCents: Cents) {
  const differences = { bankToServicing: bankCents - servicingCents, servicingToLedger: servicingCents - ledgerCents };
  if (differences.bankToServicing || differences.servicingToLedger) throw Object.assign(new Error('unresolved three-way reconciliation difference'), { differences });
  return { matched: true, authoritativeCents: bankCents, differences } as const;
}
