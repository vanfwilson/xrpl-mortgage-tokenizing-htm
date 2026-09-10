export type Cents = number;
export type ServicingLeg = 'principal' | 'interest' | 'tax' | 'hazard' | 'mip' | 'fees' | 'suspense' | 'adjustment';

export interface ApplicationInput {
  readonly companyId: string;
  readonly loanId: string;
  readonly period: string;
  readonly receivedAt: string;
  readonly receivedCents: Cents;
  readonly due: Readonly<Record<Exclude<ServicingLeg, 'suspense' | 'adjustment'>, Cents>>;
  readonly adjustmentCents?: Cents;
}

export interface ApplicationPlan {
  readonly status: 'applied' | 'suspense';
  readonly receivedAt: string;
  readonly entries: Readonly<Record<ServicingLeg, Cents>>;
  readonly conservationCents: Cents;
}

const assertCents = (name: string, value: number, allowNegative = false) => {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0)) throw new RangeError(`${name} must be ${allowNegative ? '' : 'non-negative '}integer cents`);
};

/** R16 — credit a conforming payment as of immutable receipt time; partial receipts go to suspense. */
export function planMonthlyApplication(input: ApplicationInput): ApplicationPlan {
  if (!input.companyId || !input.loanId) throw new Error('company and loan scope required');
  if (!input.receivedAt || Number.isNaN(Date.parse(input.receivedAt))) throw new RangeError('receivedAt must be an ISO timestamp');
  assertCents('receivedCents', input.receivedCents);
  for (const [k, v] of Object.entries(input.due)) assertCents(k, v);
  const adjustment = input.adjustmentCents ?? 0;
  assertCents('adjustmentCents', adjustment, true);
  // Unpaid fees do not turn an otherwise full periodic payment into a partial.
  const scheduled = Object.values(input.due).reduce((a, b) => a + b, 0) - input.due.fees + adjustment;
  if (scheduled < 0) throw new RangeError('adjustment exceeds scheduled amount');
  const blank = { principal: 0, interest: 0, tax: 0, hazard: 0, mip: 0, fees: 0, suspense: input.receivedCents, adjustment: 0 };
  const entries = input.receivedCents < scheduled
    ? blank
    : { ...input.due, fees: Math.min(input.due.fees, input.receivedCents - scheduled), adjustment, suspense: Math.max(0, input.receivedCents - scheduled - input.due.fees) };
  const sum = Object.values(entries).reduce((a, b) => a + b, 0);
  if (sum !== input.receivedCents) throw new Error(`application does not conserve cents: ${sum} != ${input.receivedCents}`);
  return Object.freeze({ status: input.receivedCents < scheduled ? 'suspense' : 'applied', receivedAt: input.receivedAt, entries: Object.freeze(entries), conservationCents: sum });
}

/** Release accumulated partial receipts when they cover a periodic payment.
 * Persist the negative suspense release with this plan, in the same DB transaction. */
export function applyWithSuspense(input: ApplicationInput, previousSuspenseCents: number) {
  assertCents('previousSuspenseCents', previousSuspenseCents);
  const plan = planMonthlyApplication({ ...input, receivedCents: input.receivedCents + previousSuspenseCents });
  return { plan, priorSuspenseReleaseCents: -previousSuspenseCents, newReceiptCents: input.receivedCents };
}

/** R16 — a reversal is append-only and exactly negates an earlier application. */
export function reverseApplication(original: ApplicationPlan, reversedAt: string) {
  if (Number.isNaN(Date.parse(reversedAt))) throw new RangeError('reversedAt must be an ISO timestamp');
  return Object.freeze({ reversedAt, originalReceivedAt: original.receivedAt, entries: Object.fromEntries(Object.entries(original.entries).map(([k, v]) => [k, -v])) as Record<ServicingLeg, Cents> });
}
