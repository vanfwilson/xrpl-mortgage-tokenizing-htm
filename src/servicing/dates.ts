/** Date-only clocks; legal holiday calendars are injected by the bank. */
export function parseDay(iso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new RangeError('ISO date required');
  const stamp = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== iso) throw new RangeError('invalid calendar date');
  return stamp;
}
export const addDays = (day: string, days: number) => new Date(parseDay(day) + days * 86400000).toISOString().slice(0, 10);
export function nextBusinessDay(day: string, holidays: readonly string[] = []): string {
  let value = day;
  while ([0, 6].includes(new Date(parseDay(value)).getUTCDay()) || holidays.includes(value)) value = addDays(value, 1);
  return value;
}
export function addBusinessDays(day: string, count: number, holidays: readonly string[]): string {
  let value = day;
  for (let n = 0; n < count; n++) value = nextBusinessDay(addDays(value, 1), holidays);
  return value;
}
