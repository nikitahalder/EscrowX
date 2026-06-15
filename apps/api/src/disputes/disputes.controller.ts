import {
  Controller, Post, Get, Body, Param, UseGuards,
  UseInterceptors, UploadedFiles
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RaiseDisputeDto, ResolveDisputeDto, ConfirmDisputeTxDto } from './dto/dispute.dto';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class RaiseDisputeConfirmDto extends RaiseDisputeDto {
  @ApiProperty() @IsString() @IsNotEmpty() txHash: string;
}

class ResolveDisputeConfirmDto extends ResolveDisputeDto {
  @ApiProperty() @IsString() @IsNotEmpty() txHash: string;
}

@ApiTags('Disputes')
@Controller('projects/:projectId/disputes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post('build-raise')
  @ApiOperation({ summary: 'Get raise dispute transaction XDR' })
  buildRaiseTx(
    @Param('projectId') projectId: string,
    @CurrentUser() user: any,
    @Body() dto: RaiseDisputeDto,
  ) {
    return this.disputesService.buildRaiseDisputeTx(projectId, user.id, user.walletAddress, dto);
  }

  @Post('confirm-raise')
  @UseInterceptors(FilesInterceptor('evidence', 5))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Confirm dispute raised with signed tx and evidence files' })
  confirmRaise(
    @Param('projectId') projectId: string,
    @CurrentUser() user: any,
    @Body() dto: RaiseDisputeConfirmDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.disputesService.confirmRaiseDispute(projectId, user.id, dto, dto.txHash, files);
  }

  @Get()
  @ApiOperation({ summary: 'Get dispute details for a project' })
  getDispute(@Param('projectId') projectId: string, @CurrentUser() user: any) {
    return this.disputesService.getDispute(projectId, user.id);
  }

  @Post('build-resolve')
  @ApiOperation({ summary: 'Arbitrator: get resolve dispute transaction XDR' })
  buildResolveTx(
    @Param('projectId') projectId: string,
    @CurrentUser() user: any,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputesService.buildResolveTx(projectId, user.id, user.walletAddress, dto);
  }

  @Post('confirm-resolve')
  @ApiOperation({ summary: 'Confirm dispute resolution with tx hash' })
  confirmResolve(
    @Param('projectId') projectId: string,
    @CurrentUser() user: any,
    @Body() dto: ResolveDisputeConfirmDto,
  ) {
    return this.disputesService.confirmResolveDispute(projectId, user.id, dto, dto.txHash);
  }

  @Get('my-disputes')
  @ApiOperation({ summary: 'Arbitrator: get all open disputes assigned to me' })
  getMyDisputes(@CurrentUser() user: any) {
    return this.disputesService.getAllDisputes(user.id);
  }
}
