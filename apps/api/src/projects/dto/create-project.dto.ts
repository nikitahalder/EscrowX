import {
  IsString, IsNotEmpty, IsNumber, IsPositive, IsArray,
  ValidateNested, IsOptional, IsDateString, Min, MaxLength, IsDecimal
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MilestoneInputDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Amount in USDC (7 decimal places max)' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Freelancer Stellar wallet address (optional — can invite later)' })
  @IsOptional()
  @IsString()
  freelancerAddress?: string;

  @ApiProperty({ type: [MilestoneInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneInputDto)
  milestones: MilestoneInputDto[];

  @ApiPropertyOptional({ description: 'Override payment token address (defaults to USDC)' })
  @IsOptional()
  @IsString()
  tokenAddress?: string;
}

export class FundProjectDto {
  @ApiProperty({ description: 'Signed transaction XDR from wallet' })
  @IsString()
  @IsNotEmpty()
  signedXdr: string;
}

export class ConfirmTxDto {
  @ApiProperty({ description: 'Transaction hash' })
  @IsString()
  @IsNotEmpty()
  txHash: string;
}
