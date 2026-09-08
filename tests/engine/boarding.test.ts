import { describe, expect, it } from 'vitest';
import { assertNoParticipation, boardLoan, idahoInterestGate, type Authority } from '../../src/servicing/boarding.js';
import { buildCanonicalFromDocuments } from '../../src/ingest/canonical.js';
import { ESCROW_INTEREST, TAX_CALENDAR, disbursementCalendar, nextBusinessDay } from '../../src/servicing/calendar.js';

const loan = buildCanonicalFromDocuments('data/documents');
const registry: Authority[] = [
  { holder_id: 'bank-sub', state: 'ID', kind: 'ID_mortgage_servicer', valid_from: '2026-01-01', valid_to: '2030-12-31' },
  { holder_id: 'bank-sub', state: 'ID', kind: 'HUD_mortgagee', valid_from: '2026-01-01', valid_to: '2030-12-31' },
  { holder_id: 'bank-sub', state: 'CA', kind: 'bank_exempt', valid_from: '2026-01-01', valid_to: '2030-12-31' },
];
const input = { loan, company_id: 'c1', loan_id: 'L1', legal_owner_id: 'bank-owner', servicer_of_record_id: 'bank-sub', settlement_date: '2026-09-01', annual_tax_cents: 342_000, annual_hazard_cents: 150_000, registry, profile: 'test' as const };

describe('boarding', () => {
  it('R04_initial_deposit: the CD initial escrow deposit enters tax and hazard pro-rata to the cent', () => {
    const b = boardLoan(input);
    const tax = b.opening_postings.find((p) => p.account === 'tax')!.cents;
    const hazard = b.opening_postings.find((p) => p.account === 'hazard')!.cents;
    expect(tax + hazard).toBe(123_050);
    expect(tax).toBe(Math.round((123_050 * 342_000) / 492_000));
    expect(b.terms.monthly_pi_cents).toBe(277_073);
    expect(b.terms.late_charge_cents).toBe(11_083);
    expect(b.initial_statement_due).toBe('2026-10-16');
  });
  it('R24_loss_draft_separate: California loans get a loss-draft account; Idaho does not', () => {
    expect(boardLoan(input).loss_draft_account).toBe(false);
    const ca = structuredClone(loan); ca.property.address.state = 'CA';
    expect(boardLoan({ ...input, loan: ca }).loss_draft_account).toBe(true);
  });
  it('R25_idaho_calendar_gate: statutory dates and the unverified interest gate', () => {
    expect(TAX_CALENDAR.ID.map((i) => i.due)).toEqual(['12-20', '06-20']);
    expect(disbursementCalendar('ID', '09-01', '2026-11-01', '2027-10-31').map((d) => `${d.purpose}:${d.due}`)).toEqual(['tax:2026-12-20', 'tax:2027-06-20', 'hazard:2027-09-01']);
    expect(ESCROW_INTEREST.ID.status).toBe('unverified');
    expect(() => idahoInterestGate('ID', 'production', false)).toThrow(/R25/);
    expect(() => idahoInterestGate('ID', 'production', true)).not.toThrow();
    expect(() => idahoInterestGate('ID', 'test', false)).not.toThrow();
    expect(() => boardLoan({ ...input, profile: 'production' })).toThrow(/R25/);
    expect(nextBusinessDay('2028-01-29')).toBe('2028-01-31'); // Saturday -> Monday
  });
  it('R26_license_gate: no boarding without current state authority and HUD approval', () => {
    expect(() => boardLoan({ ...input, registry: [] })).toThrow(/R26/);
    expect(() => boardLoan({ ...input, registry: registry.filter((a) => a.kind !== 'HUD_mortgagee') })).toThrow(/HUD/);
    expect(() => boardLoan({ ...input, settlement_date: '2031-01-01' })).toThrow(/R26/);
  });
  it('R31_no_participation_fields: a single legal owner and nothing investor-shaped', () => {
    const b = boardLoan(input);
    expect(b.terms.legal_owner_id).toBe('bank-owner');
    expect(() => assertNoParticipation(b.terms as unknown as Record<string, unknown>)).not.toThrow();
    expect(() => assertNoParticipation({ investors: [] })).toThrow(/R31/);
    expect(() => assertNoParticipation({ participation_share: 0.6 })).toThrow(/R31/);
  });
});
