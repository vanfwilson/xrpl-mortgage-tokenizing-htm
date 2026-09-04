import path from 'node:path';

const wss = process.env.XRPL_WSS ?? 'wss://s.devnet.rippletest.net:51233';
if (/xrplcluster|s1\.ripple\.com|s2\.ripple\.com|xrpl\.ws/i.test(wss)) {
  throw new Error(`Refusing to run against a Mainnet endpoint: ${wss}`);
}

export const config = {
  wss,
  explorer: process.env.XRPL_EXPLORER ?? 'https://devnet.xrpl.org',
  walletsFile: process.env.WALLETS_FILE ?? path.join('out', 'wallets.json'),
  documentsDir: path.join('data', 'documents'),
  outDir: 'out',
  /** Demo scale: 1 XRP on Devnet stands in for US$10,000 of the real loan. */
  usdPerXrp: 10_000,
  /** Compressed demo schedule so a full payment cycle happens inside one run. */
  demoLoan: {
    paymentTotal: 12,
    paymentIntervalSec: 60,
    gracePeriodSec: 60,
  },
} as const;

export const WALLET_ROLES = [
  'issuer',      // HTM Capital Markets: MPT issuer (participation certificates)
  'broker',      // HTM Lending Desk: permissioned domain + vault + LoanBroker owner (XLS-66 requires one owner)
  'originator',  // HTM Warehouse: on-chain borrower against the vault
  'investorA',   // permissioned participation holder + vault depositor
  'investorB',   // permissioned participation holder + vault depositor
  'kyc',         // credential issuer (KYC / accredited-investor attestations)
  'title',       // title & escrow company
  'buyer',       // homebuyer proxy (cash-to-close escrow only)
] as const;
export type Role = (typeof WALLET_ROLES)[number];
