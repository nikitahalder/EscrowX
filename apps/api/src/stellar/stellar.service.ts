import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Contract,
  Networks,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  TimeoutInfinite,
  nativeToScVal,
  scValToNative,
  xdr,
  Address,
  Keypair,
  Asset,
  Operation,
  Horizon,
} from '@stellar/stellar-sdk';

const USDC_ISSUER_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ISSUER_MAINNET = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private readonly rpc: SorobanRpc.Server;
  private readonly horizon: Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly contractId: string;
  private readonly platformKeypair: Keypair;
  private readonly usdcAsset: Asset;

  constructor(private readonly config: ConfigService) {
    const rpcUrl = config.get('STELLAR_RPC_URL', 'https://soroban-testnet.stellar.org');
    const horizonUrl = config.get('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org');
    this.rpc = new SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
    this.horizon = new Horizon.Server(horizonUrl);
    this.networkPassphrase =
      config.get('STELLAR_NETWORK') === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    this.contractId = config.get('ESCROW_CONTRACT_ID', '');
    const secret = config.get('PLATFORM_WALLET_SECRET', '');
    if (secret) {
      this.platformKeypair = Keypair.fromSecret(secret);
    }
    const isMainnet = config.get('STELLAR_NETWORK') === 'mainnet';
    this.usdcAsset = new Asset('USDC', isMainnet ? USDC_ISSUER_MAINNET : USDC_ISSUER_TESTNET);
  }

  async onModuleInit() {
    await this.ensurePlatformTrustline();
  }

  async ensurePlatformTrustline(): Promise<void> {
    if (!this.platformKeypair) return;
    try {
      const platformPublic = this.platformKeypair.publicKey();
      const account = await this.horizon.loadAccount(platformPublic);
      const hasTrustline = account.balances.some(
        (b: any) =>
          b.asset_type !== 'native' &&
          b.asset_code === 'USDC' &&
          b.asset_issuer === this.usdcAsset.getIssuer(),
      );
      if (hasTrustline) return;
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(Operation.changeTrust({ asset: this.usdcAsset }))
        .setTimeout(30)
        .build();
      tx.sign(this.platformKeypair);
      await this.horizon.submitTransaction(tx);
      this.logger.log('Platform USDC trustline established');
    } catch (e: any) {
      this.logger.error(`Failed to establish platform USDC trustline: ${e?.message}`);
    }
  }

  async hasUsdcTrustline(address: string): Promise<boolean> {
    try {
      const account = await this.horizon.loadAccount(address);
      return account.balances.some(
        (b: any) =>
          b.asset_type !== 'native' &&
          b.asset_code === 'USDC' &&
          b.asset_issuer === this.usdcAsset.getIssuer(),
      );
    } catch {
      return false;
    }
  }

  async buildTrustlineTx(address: string): Promise<string> {
    const account = await this.horizon.loadAccount(address);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(Operation.changeTrust({ asset: this.usdcAsset }))
      .setTimeout(TimeoutInfinite)
      .build();
    return tx.toXDR();
  }

  get contract(): Contract {
    return new Contract(this.contractId);
  }

  async getAccount(publicKey: string) {
    return this.rpc.getAccount(publicKey);
  }

  async verifyTransaction(txHash: string): Promise<boolean> {
    try {
      const result = await this.rpc.getTransaction(txHash);
      return result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS;
    } catch {
      return false;
    }
  }

  async getTransactionReturnValue(txHash: string): Promise<any> {
    try {
      const result = await this.rpc.getTransaction(txHash);
      if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS && result.returnValue) {
        return scValToNative(result.returnValue);
      }
      return null;
    } catch {
      return null;
    }
  }

  async getContractProjectCount(): Promise<number> {
    try {
      const account = await this.rpc.getAccount(this.platformKeypair.publicKey());
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(this.contract.call('get_project_count'))
        .setTimeout(TimeoutInfinite)
        .build();

      const sim = await this.rpc.simulateTransaction(tx);
      if (SorobanRpc.Api.isSimulationError(sim)) {
        this.logger.error('Simulation error:', sim.error);
        return 0;
      }
      return Number(scValToNative(sim.result.retval));
    } catch (e) {
      this.logger.error('Failed to get project count:', e);
      return 0;
    }
  }

  async buildCreateProjectTx(params: {
    clientAddress: string;
    freelancerAddress: string;
    arbitratorAddress: string;
    tokenAddress: string;
    totalAmount: bigint;
    milestones: { amount: bigint }[];
  }): Promise<string> {
    const account = await this.rpc.getAccount(params.clientAddress);

    const milestonesScVal = xdr.ScVal.scvVec(
      params.milestones.map((m) =>
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('amount'),
            val: nativeToScVal(m.amount, { type: 'i128' }),
          }),
        ]),
      ),
    );

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          'create_project',
          new Address(params.clientAddress).toScVal(),
          new Address(params.freelancerAddress).toScVal(),
          new Address(params.arbitratorAddress).toScVal(),
          new Address(params.tokenAddress).toScVal(),
          nativeToScVal(params.totalAmount, { type: 'i128' }),
          milestonesScVal,
        ),
      )
      .setTimeout(TimeoutInfinite)
      .build();

    const sim = await this.rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation failed: ${sim.error}`);
    }

    return SorobanRpc.assembleTransaction(tx, sim).build().toXDR();
  }

  async buildFundProjectTx(params: {
    clientAddress: string;
    projectId: bigint;
  }): Promise<string> {
    const account = await this.rpc.getAccount(params.clientAddress);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          'fund_project',
          new Address(params.clientAddress).toScVal(),
          nativeToScVal(params.projectId, { type: 'u64' }),
        ),
      )
      .setTimeout(TimeoutInfinite)
      .build();

    const sim = await this.rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation failed: ${sim.error}`);
    }

    return SorobanRpc.assembleTransaction(tx, sim).build().toXDR();
  }

  async buildAcceptProjectTx(params: {
    freelancerAddress: string;
    projectId: bigint;
  }): Promise<string> {
    const account = await this.rpc.getAccount(params.freelancerAddress);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          'accept_project',
          nativeToScVal(params.projectId, { type: 'u64' }),
          new Address(params.freelancerAddress).toScVal(),
        ),
      )
      .setTimeout(TimeoutInfinite)
      .build();

    const sim = await this.rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation failed: ${sim.error}`);
    }

    return SorobanRpc.assembleTransaction(tx, sim).build().toXDR();
  }

  async buildSubmitMilestoneTx(params: {
    freelancerAddress: string;
    projectId: bigint;
    milestoneId: number;
    proofHash: string;
  }): Promise<string> {
    const account = await this.rpc.getAccount(params.freelancerAddress);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          'submit_milestone',
          nativeToScVal(params.projectId, { type: 'u64' }),
          nativeToScVal(params.milestoneId, { type: 'u32' }),
          new Address(params.freelancerAddress).toScVal(),
          nativeToScVal(params.proofHash, { type: 'string' }),
        ),
      )
      .setTimeout(TimeoutInfinite)
      .build();

    const sim = await this.rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation failed: ${sim.error}`);
    }

    return SorobanRpc.assembleTransaction(tx, sim).build().toXDR();
  }

  async buildApproveMilestoneTx(params: {
    clientAddress: string;
    projectId: bigint;
    milestoneId: number;
  }): Promise<string> {
    const account = await this.rpc.getAccount(params.clientAddress);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          'approve_milestone',
          nativeToScVal(params.projectId, { type: 'u64' }),
          nativeToScVal(params.milestoneId, { type: 'u32' }),
          new Address(params.clientAddress).toScVal(),
        ),
      )
      .setTimeout(TimeoutInfinite)
      .build();

    const sim = await this.rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation failed: ${sim.error}`);
    }

    return SorobanRpc.assembleTransaction(tx, sim).build().toXDR();
  }

  async buildRaiseDisputeTx(params: {
    callerAddress: string;
    projectId: bigint;
    milestoneId: number;
    reason: string;
  }): Promise<string> {
    const account = await this.rpc.getAccount(params.callerAddress);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          'raise_dispute',
          nativeToScVal(params.projectId, { type: 'u64' }),
          nativeToScVal(params.milestoneId, { type: 'u32' }),
          new Address(params.callerAddress).toScVal(),
          nativeToScVal(params.reason, { type: 'string' }),
        ),
      )
      .setTimeout(TimeoutInfinite)
      .build();

    const sim = await this.rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation failed: ${sim.error}`);
    }

    return SorobanRpc.assembleTransaction(tx, sim).build().toXDR();
  }

  async buildResolveDisputeTx(params: {
    arbitratorAddress: string;
    projectId: bigint;
    resolution: number;
    clientBps: number;
  }): Promise<string> {
    const account = await this.rpc.getAccount(params.arbitratorAddress);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          'resolve_dispute',
          nativeToScVal(params.projectId, { type: 'u64' }),
          new Address(params.arbitratorAddress).toScVal(),
          nativeToScVal(params.resolution, { type: 'u32' }),
          nativeToScVal(params.clientBps, { type: 'u32' }),
        ),
      )
      .setTimeout(TimeoutInfinite)
      .build();

    const sim = await this.rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation failed: ${sim.error}`);
    }

    return SorobanRpc.assembleTransaction(tx, sim).build().toXDR();
  }

  async submitSignedTransaction(signedXdr: string): Promise<string> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
    const response = await this.rpc.sendTransaction(tx);
    if (response.status === 'ERROR') {
      throw new Error(`Transaction failed: ${JSON.stringify(response.errorResult)}`);
    }

    let result = await this.rpc.getTransaction(response.hash);
    let attempts = 0;
    while (result.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      result = await this.rpc.getTransaction(response.hash);
      attempts++;
    }

    if (result.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(`Transaction did not succeed: ${result.status}`);
    }
    return response.hash;
  }
}
