import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MilestonesService } from './milestones.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ConfirmMilestoneTxDto {
  @ApiProperty() @IsString() @IsNotEmpty() txHash: string;
  @ApiPropertyOptional() @IsOptional() @IsString() proofHash?: string;
}

class RejectMilestoneDto {
  @ApiProperty() @IsString() @IsNotEmpty() feedback: string;
}

@ApiTags('Milestones')
@Controller('milestones')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post(':id/submit')
  @ApiOperation({ summary: 'Freelancer: get submit milestone transaction XDR' })
  buildSubmitTx(@Param('id') id: string, @CurrentUser() user: any) {
    return this.milestonesService.buildSubmitTx(id, user.id, user.walletAddress);
  }

  @Post(':id/confirm-submit')
  @ApiOperation({ summary: 'Confirm milestone submission with tx hash' })
  confirmSubmit(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ConfirmMilestoneTxDto) {
    return this.milestonesService.confirmSubmission(id, user.id, dto.txHash, dto.proofHash || '');
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Client: get approve milestone transaction XDR' })
  buildApproveTx(@Param('id') id: string, @CurrentUser() user: any) {
    return this.milestonesService.buildApproveTx(id, user.id, user.walletAddress);
  }

  @Post(':id/confirm-approve')
  @ApiOperation({ summary: 'Confirm milestone approval with tx hash' })
  confirmApprove(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ConfirmMilestoneTxDto) {
    return this.milestonesService.confirmApproval(id, user.id, dto.txHash);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Client: reject milestone submission' })
  reject(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: RejectMilestoneDto) {
    return this.milestonesService.rejectMilestone(id, user.id, dto.feedback);
  }
}
