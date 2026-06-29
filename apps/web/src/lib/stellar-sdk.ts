import { rpc, Networks } from '@stellar/stellar-sdk';

/**
 * Centralised Soroban/Stellar network configuration for the web app.
 *
 * Everything is driven by `NEXT_PUBLIC_*` env vars so the same build can target
 * testnet or mainnet, with sensible testnet defaults for local development.
 */

const network = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet').toLowerCase();

export const isMainnet = network === 'mainnet' || network === 'public';

export const rpcUrl =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  (isMainnet ? 'https://mainnet.sorobanrpc.com' : 'https://soroban-testnet.stellar.org');

export const networkPassphrase =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
  (isMainnet ? Networks.PUBLIC : Networks.TESTNET);

/** The deployed EscrowX contract (testnet default). */
export const contractId =
  process.env.NEXT_PUBLIC_CONTRACT_ID ??
  'CDTSW6SSYKQIGF24GKIE5ZRYW3HNX7KNWGVZFYSKAC7XGFH7P6WP42XO';

/** Shared Soroban RPC client. */
export const server = new rpc.Server(rpcUrl, {
  allowHttp: rpcUrl.startsWith('http://'),
});
