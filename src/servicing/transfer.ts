/** R11 — servicing transfer notices and misdirected-payment grace. */
export function servicingTransfer(transferDate: string, transferorNotice: string, transfereeNotice: string) {
  const days = (a: string, b: string) => Math.floor((Date.parse(b) - Date.parse(a)) / 86_400_000);
  if (days(transferorNotice, transferDate) < 15 || days(transferDate, transfereeNotice) > 15) throw new Error('servicing transfer notice window failed');
  return { transferDate, graceEnds: new Date(Date.parse(`${transferDate}T00:00:00Z`) + 60 * 86_400_000).toISOString().slice(0, 10), nftTransferPermitted: true };
}
/** R18 — ownership notice is distinct from an NFToken/servicing transfer. */
export function ownershipTransfer(acquiredOn: string, noticeOn: string, partialInterestOnly: boolean, paymentPartyChanged: boolean) {
  const required = !partialInterestOnly || paymentPartyChanged;
  if (required && Date.parse(noticeOn) - Date.parse(acquiredOn) > 30 * 86_400_000) throw new Error('ownership notice deadline exceeded');
  return { required, acquiredOn, noticeOn };
}
