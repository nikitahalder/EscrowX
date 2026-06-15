import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RaiseDisputeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  milestoneId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  milestoneIdx?: number;
}

export class ResolveDisputeDto {
  @ApiProperty({ enum: ['FULL_CLIENT_REFUND', 'FULL_FREELANCER_PAYMENT', 'PARTIAL_SPLIT'] })
  @IsEnum(['FULL_CLIENT_REFUND', 'FULL_FREELANCER_PAYMENT', 'PARTIAL_SPLIT'])
  resolution: string;

  @ApiPropertyOptional({ description: 'Basis points to client (0-10000, for PARTIAL_SPLIT)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  clientBps?: number;
}

export class ConfirmDisputeTxDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  txHash: string;
}
