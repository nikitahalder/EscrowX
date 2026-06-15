import { IsString, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// allow localhost/staging URLs without TLD — freelancers often submit from local deployments
const URL_OPTS = { require_tld: false, require_protocol: false, allow_underscores: true };

export class CreateSubmissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  githubUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
