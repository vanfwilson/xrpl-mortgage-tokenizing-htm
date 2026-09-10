import path from 'node:path';

const wss = process.env.XRPL_WSS ?? 'wss://s.altnet.rippletest.net:51233';
if (!['wss://s.altnet.rippletest.net:51233', 'wss://s.devnet.rippletest.net:51233'].includes(wss)) throw new Error('Only the explicit Testnet/Devnet endpoints are allowed');

export const config = {
  wss,
  explorer: process.env.XRPL_EXPLORER ?? 'https://testnet.xrpl.org',
  walletsFile: process.env.WALLETS_FILE ?? path.join('out', 'wallets.json'),
  documentsDir: path.join('data', 'documents'),
  outDir: 'out',
  /** Compressed demo schedule so a full payment cycle happens inside one run. */
  demoLoan: {
    paymentTotal: 360,       // mirrors the Note: 360 monthly payments
    paymentIntervalSec: 60,  // Devnet compression: one "month" = 60 s
    gracePeriodSec: 60,      // Note s.6 grace is 15 days; compressed to 60 s
    sweepsToRun: 2,          // how many monthly sweeps the demo performs
  },
} as const;

export const WALLET_ROLES = [
  'issuer',           // controlled Testnet USD issuer
  'servicer',         // bank servicing account and NFToken owner
  'homeowner',        // the borrower's wallet: source of the monthly sweep
  'noteHolder',       // funding bank
  'taxImpound',       // Tax Impound sub-account (servicer-controlled)
  'hazardImpound',    // Hazard insurance sub-account
  'mipPayable',       // monthly FHA MIP payable
  'countyTreasurer',  // Ada County Treasurer destination node
  'insuranceCarrier', // hazard carrier / HUD MIP destination node
  'hud',              // FHA MIP destination
  'newServicer',      // servicing-transfer recipient
] as const;
export type Role = (typeof WALLET_ROLES)[number];
