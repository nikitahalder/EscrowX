import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { ChallengeDto, VerifySignatureDto } from './dto/auth.dto';

const challengeStore = new Map<string, { challenge: string; expiresAt: number }>();

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async getChallenge(dto: ChallengeDto): Promise<{ challenge: string; xdr: string }> {
    const { walletAddress } = dto;
    this.validateStellarAddress(walletAddress);

    const challenge = `EscrowX-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    challengeStore.set(walletAddress, { challenge, expiresAt: Date.now() + 5 * 60 * 1000 });

    return { challenge, xdr: this.buildChallengeXdr(walletAddress, challenge) };
  }

  async verifySignature(dto: VerifySignatureDto): Promise<{ access_token: string; user: any }> {
    const { walletAddress, challenge, signature: signedXdr } = dto;
    this.validateStellarAddress(walletAddress);

    const stored = challengeStore.get(walletAddress);
    if (!stored) {
      throw new UnauthorizedException('No challenge found. Request a new challenge.');
    }
    if (Date.now() > stored.expiresAt) {
      challengeStore.delete(walletAddress);
      throw new UnauthorizedException('Challenge expired. Request a new challenge.');
    }
    if (stored.challenge !== challenge) {
      throw new UnauthorizedException('Challenge mismatch.');
    }

    if (!this.verifySignedXdr(walletAddress, signedXdr)) {
      throw new UnauthorizedException('Invalid signature.');
    }

    challengeStore.delete(walletAddress);
    const user = await this.usersService.findOrCreate(walletAddress);
    const payload = { sub: user.id, walletAddress: user.walletAddress, role: user.role };
    const access_token = this.jwtService.sign(payload);
    return { access_token, user };
  }

  private buildChallengeXdr(walletAddress: string, challenge: string): string {
    const { TransactionBuilder, Networks, BASE_FEE, Account, Operation } = require('@stellar/stellar-sdk');

    const network =
      this.config.get('STELLAR_NETWORK') === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

    const tx = new TransactionBuilder(new Account(walletAddress, '0'), {
      fee: BASE_FEE,
      networkPassphrase: network,
    })
      .addOperation(
        Operation.manageData({
          name: 'EscrowX_auth',
          value: Buffer.from(challenge, 'utf-8'),
        }),
      )
      .setTimeout(300)
      .build();

    return tx.toEnvelope().toXDR('base64');
  }

  private verifySignedXdr(walletAddress: string, signedXdr: string): boolean {
    try {
      const { Transaction, Networks, Keypair } = require('@stellar/stellar-sdk');
      const network =
        this.config.get('STELLAR_NETWORK') === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

      const tx = new Transaction(signedXdr, network);
      if (tx.source !== walletAddress) return false;

      const kp = Keypair.fromPublicKey(walletAddress);
      const txHash = tx.hash();

      return tx.signatures.some((sig: any) => {
        try {
          return kp.verify(txHash, sig.signature());
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  private validateStellarAddress(address: string) {
    if (!address || address.length !== 56 || !address.startsWith('G')) {
      throw new BadRequestException('Invalid Stellar wallet address.');
    }
  }
}
