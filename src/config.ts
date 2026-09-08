import path from 'node:path';

/**
 * Network profile. Testnet is the production-shape proof (only Mainnet-live transaction types are used);
 * Devnet is a compressed CI smoke. Mainnet is refused outright.
 */
const wss = process.env.XRPL_WSS ?? 'wss://s.altnet.rippletest.net:51233';
if (/xrplcluster|s1\.ripple\.com|s2\.ripple\.com|xrpl\.ws/i.test(wss)) {
  throw new Error(`Refusing to run against a Mainnet endpoint: ${wss}`);
}
const network: 'testnet' | 'devnet' = /devnet/.test(wss) ? 'devnet' : 'testnet';

export const config = {
  wss,
  network,
  explorer: process.env.XRPL_EXPLORER ?? (network === 'devnet' ? 'https://devnet.xrpl.org' : 'https://testnet.xrpl.org'),
  walletsFile: process.env.WALLETS_FILE ?? path.join('out', `wallets.${network}.json`),
  documentsDir: path.join('data', 'documents'),
  outDir: 'out',
  /** Settlement asset on the test network: a controlled USD issuer created by this repo (S5). Never RLUSD. */
  settlement: {
    currency: 'USD',
    /** Human label used in reports; this is test value, not a deposit and not borrower money. */
    label: 'test USD (controlled Testnet issuer; not RLUSD, not a deposit)',
  },
  /** Escrow policy (S7): only verified near-term bills, bounded CancelAfter. */
  escrow: {
    cancelAfterDays: 45,
    maxInFlight: 3,
  },
} as const;

/**
 * One ledger account per role for the Testnet proof. In production these collapse to bank-controlled
 * accounts under 2-of-3 signer lists; Manila operators never hold keys (R27).
 */
export const WALLET_ROLES = [
  'issuer',           // controlled test-USD issuer (asfAllowTrustLineLocking set before any trust line)
  'servicer',         // bank subservicer collection account; holds the loan-record NFToken
  'noteHolder',       // funding bank: receives the fixed P&I remittance
  'homeowner',        // borrower wallet: source of the monthly payment
  'taxImpound',       // tax impound sub-account (servicer-controlled)
  'hazardImpound',    // hazard-insurance impound sub-account (servicer-controlled)
  'mipPayable',       // FHA MIP payable (servicer-controlled), remitted monthly to HUD
  'countyTreasurer',  // Ada County Treasurer destination
  'insuranceCarrier', // hazard carrier destination
  'hud',              // HUD / FHA MIP destination
] as const;
export type Role = (typeof WALLET_ROLES)[number];
