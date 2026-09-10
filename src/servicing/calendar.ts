/** R25 — Idaho tax dates and an explicit unresolved interest-law gate. */
export function idahoServicingCalendar(year: number, counselApprovedInterestRule: boolean) {
  if (!counselApprovedInterestRule) throw new Error('Idaho interest-on-escrow rule UNVERIFIED: counsel approval required');
  return [{ dueDate: `${year}-12-20`, installment: 1 }, { dueDate: `${year + 1}-06-20`, installment: 2 }] as const;
}
