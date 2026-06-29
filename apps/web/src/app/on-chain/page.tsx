'use client';

import { useEffect, useState } from 'react';

import { readProjectCount } from '@/lib/contract';
import { contractId, rpcUrl, networkPassphrase } from '@/lib/stellar-sdk';

/**
 * Live on-chain status page. Reads directly from the deployed EscrowX Soroban
 * contract via RPC simulation (no wallet, no backend) to prove the contract is
 * live and reachable from the browser.
 */
export default function OnChainStatusPage() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readProjectCount()
      .then(setCount)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold">On-chain status</h1>
      <p className="mt-2 text-muted-foreground">
        Read live from the EscrowX Soroban contract on Stellar testnet.
      </p>

      <dl className="mt-8 space-y-4 rounded-lg border p-6">
        <div className="flex justify-between gap-4">
          <dt className="font-medium">Total projects on-chain</dt>
          <dd className="font-mono">
            {error ? '—' : count === null ? 'Loading…' : count}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium">Contract ID</dt>
          <dd className="break-all font-mono text-xs">{contractId}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium">RPC</dt>
          <dd className="break-all font-mono text-xs">{rpcUrl}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium">Network</dt>
          <dd className="font-mono text-xs">{networkPassphrase}</dd>
        </div>
      </dl>

      {error && (
        <p className="mt-4 text-sm text-red-600">
          Could not reach the contract: {error}
        </p>
      )}
    </main>
  );
}
