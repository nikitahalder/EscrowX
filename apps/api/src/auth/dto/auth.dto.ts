import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChallengeDto {
  @ApiProperty({ description: 'Stellar wallet public key' })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}

export class VerifySignatureDto {
  @ApiProperty({ description: 'Stellar wallet public key' })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @ApiProperty({ description: 'Challenge nonce that was signed' })
  @IsString()
  @IsNotEmpty()
  challenge: string;

  @ApiProperty({ description: 'Base64-encoded signature from wallet' })
  @IsString()
  @IsNotEmpty()
  signature: string;
}
