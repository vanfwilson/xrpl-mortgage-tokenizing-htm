import { sha256Hex } from '../domain/hash.js';

/**
 * R14: durable, scoped, append-only business-event chain (cases, statements, transfers, decisions).
 * Separate from the reconciliation chain in reconcile.ts. Each event hash covers the tenant scope,
 * the position in the chain, the previous hash and the exact payload text, so any alteration of a
 * persisted row (or reordering / cross-tenant splicing) is detected on read. Hashes detect tampering,
 * not authenticity; the database administrator remains a trusted party.
 */
export interface AnchoredEvent {
  companyId: string;
  loanId: string;
  sequence: number;
  previousHash: string;
  payloadJson: string;
  eventHash: string;
}

export const GENESIS_HASH = '0'.repeat(64);

/** Hash input is fixed-order JSON of the five anchored fields; payloadJson is hashed as the exact stored text. */
export function computeEventHash(e: Omit<AnchoredEvent, 'eventHash'>): string {
  return sha256Hex(JSON.stringify({ companyId: e.companyId, loanId: e.loanId, sequence: e.sequence, previousHash: e.previousHash, payloadJson: e.payloadJson }));
}

export function anchorEvent(companyId: string, loanId: string, payload: unknown, previous?: AnchoredEvent): AnchoredEvent {
  if (!companyId || !loanId) throw new Error('R14: event chain requires companyId and loanId');
  if (previous && (previous.companyId !== companyId || previous.loanId !== loanId)) throw new Error('R14: event chain scope mismatch');
  const payloadJson = JSON.stringify(payload);
  if (typeof payloadJson !== 'string') throw new Error('R14: event payload must be JSON-serialisable');
  const base = { companyId, loanId, sequence: (previous?.sequence ?? 0) + 1, previousHash: previous?.eventHash ?? GENESIS_HASH, payloadJson };
  return { ...base, eventHash: computeEventHash(base) };
}

/** Recomputes every hash and link in order; throws on any alteration. Returns true for an intact (or empty) chain. */
export function verifyEventChain(events: readonly AnchoredEvent[]): true {
  let previous: AnchoredEvent | undefined;
  for (const [i, e] of events.entries()) {
    const expectedSeq = (previous?.sequence ?? 0) + 1;
    const expectedPrev = previous?.eventHash ?? GENESIS_HASH;
    if (previous && (e.companyId !== previous.companyId || e.loanId !== previous.loanId)) throw new Error(`R14: event chain altered at index ${i}: scope mismatch`);
    if (e.sequence !== expectedSeq) throw new Error(`R14: event chain altered at index ${i}: sequence ${e.sequence}, expected ${expectedSeq}`);
    if (e.previousHash !== expectedPrev) throw new Error(`R14: event chain altered at index ${i}: previous_hash does not link`);
    const { eventHash, ...rest } = e;
    if (computeEventHash(rest) !== eventHash) throw new Error(`R14: event chain altered at index ${i}: event_hash does not match content`);
    previous = e;
  }
  return true;
}
