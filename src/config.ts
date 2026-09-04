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
    paymentTotal: 360,       // mirrors the Note: 360 monthly payments
    paymentIntervalSec: 60,  // Devnet compression: one "month" = 60 s
    gracePeriodSec: 60,      // Note s.6 grace is 15 days; compressed to 60 s
    sweepsToRun: 2,          // how many monthly sweeps the demo performs
  },
} as const;

export const WALLET_ROLES = [
  'issuer',           // HTM Capital Markets: MPT issuer (participation certificates)
  'broker',           // HTM Lending Desk: permissioned domain + vault + LoanBroker owner (XLS-66 requires one owner)
  'servicer',         // HTM Loan Servicing: on-chain borrower against the vault; receives the homeowner sweep and splits it
  'homeowner',        // the borrower's wallet: source of the monthly sweep
  'taxImpound',       // Tax Impound sub-account (servicer-controlled)
  'insuranceImpound', // Insurance Impound sub-account (servicer-controlled)
  'countyTreasurer',  // Ada County Treasurer destination node
  'insuranceCarrier', // hazard carrier / HUD MIP destination node
  'investorA',        // permissioned participation holder + vault depositor
  'investorB',        // permissioned participation holder + vault depositor
  'kyc',              // credential issuer (KYC / accredited-investor attestations)
] as const;
export type Role = (typeof WALLET_ROLES)[number];
