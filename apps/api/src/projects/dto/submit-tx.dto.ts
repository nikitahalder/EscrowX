import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitSignedTxDto {
  @ApiProperty({ description: 'Signed transaction XDR from wallet' })
  @IsString()
  @IsNotEmpty()
  signedXdr: string;
}
