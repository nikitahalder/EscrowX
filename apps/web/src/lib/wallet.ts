'use client';

import {
  requestAccess,
  signTransaction as freighterSignTransaction,
} from '@stellar/freighter-api';

export type WalletProvider = 'freighter' | 'lobstr';

export interface WalletConnection {
  publicKey: string;
  provider: WalletProvider;
}

export async function connectFreighter(): Promise<WalletConnection> {
  const { address, error } = await requestAccess();

  if (error) {
    throw new Error(
      error.message ||
        'Could not connect to Freighter. Make sure the extension is installed and your wallet is unlocked.',
    );
  }

  if (!address) {
    throw new Error('No address returned from Freighter. Please unlock your wallet and try again.');
  }

  return { publicKey: address, provider: 'freighter' };
}

export async function signTransactionWithFreighter(
  xdr: string,
  networkPassphrase: string,
  address?: string,
): Promise<string> {
  // `address` pins the signing account so Freighter doesn't silently use a different
  // active account — relevant when testing multiple roles in one browser.
  const { signedTxXdr, error } = await freighterSignTransaction(xdr, {
    networkPassphrase,
    ...(address ? { address } : {}),
  });

  if (error) {
    throw new Error(error.message || 'Freighter rejected the signing request.');
  }

  if (!signedTxXdr) {
    throw new Error('Freighter returned an empty signed transaction.');
  }

  return signedTxXdr;
}

export function getNetworkPassphrase(network: string): string {
  return network === 'mainnet'
    ? 'Public Global Stellar Network ; September 2015'
    : 'Test SDF Network ; September 2015';
}


