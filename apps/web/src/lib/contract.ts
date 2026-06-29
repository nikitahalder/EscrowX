'use client';

import {
  Account,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  scValToNative,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';

import { server, networkPassphrase, contractId } from './stellar-sdk';
import { signTransactionWithFreighter } from './wallet';

// A valid-but-unfunded account is fine as the source for read-only simulation;
// the transaction is never submitted, so the sequence number is irrelevant.
const SIMULATION_SOURCE = 'GA4UMRAEAUHPZKI23QEJT3LOHMVTDZS2PFTCEXV2MH25O5PM3C7AHKZG';

export interface CallContractOptions {
  /** Contract method name, e.g. `create_project`. */
  method: string;
  /** Pre-encoded ScVal arguments for the method. */
  args?: xdr.ScVal[];
  /** Public key of the signer (required for write calls). */
  publicKey: string;
  /** Override the target contract; defaults to the deployed EscrowX contract. */
  contractId?: string;
}

export interface SubmittedCall {
  hash: string;
  status: string;
}

/**
 * Build → simulate → sign (Freighter) → submit a contract invocation, then poll
 * until the transaction is confirmed. Returns the on-chain transaction hash.
 *
 * This is the single entry point every write interaction in the app goes
 * through, so wallet signing and RPC submission live in exactly one place.
 */
export async function callContractFunction({
  method,
  args = [],
  publicKey,
  contractId: targetContractId = contractId,
}: CallContractOptions): Promise<SubmittedCall> {
  const contract = new Contract(targetContractId);
  const source = await server.getAccount(publicKey);

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  // Simulate to compute the Soroban resource footprint and fees.
  const prepared = await server.prepareTransaction(tx);

  // Hand the unsigned XDR to Freighter for the user's signature.
  const signedXdr = await signTransactionWithFreighter(
    prepared.toXDR(),
    networkPassphrase,
    publicKey,
  );
  const signedTx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);

  const sent = await server.sendTransaction(signedTx);
  if (sent.status === 'ERROR') {
    throw new Error(`Transaction submission failed: ${JSON.stringify(sent.errorResult)}`);
  }

  // Poll until the network reports a final status.
  let result = await server.getTransaction(sent.hash);
  const deadline = Date.now() + 30_000;
  while (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1_000));
    result = await server.getTransaction(sent.hash);
  }

  if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
    throw new Error(`Transaction ${sent.hash} failed on-chain.`);
  }

  return { hash: sent.hash, status: result.status };
}

/**
 * Read-only view call: invokes a contract getter via simulation (no wallet, no
 * fee, no submission) and decodes the result to a native JS value.
 */
export async function readContractValue<T = unknown>(
  method: string,
  args: xdr.ScVal[] = [],
  targetContractId: string = contractId,
): Promise<T> {
  const contract = new Contract(targetContractId);
  const source = new Account(SIMULATION_SOURCE, '0');

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed for ${method}: ${sim.error}`);
  }
  if (!sim.result) {
    throw new Error(`No result returned for ${method}.`);
  }

  return scValToNative(sim.result.retval) as T;
}

/** Convenience reader for the contract's total project count. */
export async function readProjectCount(): Promise<number> {
  const count = await readContractValue<bigint | number>('get_project_count');
  return Number(count);
}
