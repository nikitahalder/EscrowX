import {
  Controller, Post, Get, Param, Body, UseGuards,
  UseInterceptors, UploadedFiles
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@ApiTags('Submissions')
@Controller('milestones/:milestoneId/submissions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit deliverables for a milestone' })
  create(
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateSubmissionDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.submissionsService.create(milestoneId, user.id, dto, files);
  }

  @Get()
  @ApiOperation({ summary: 'Get submission for a milestone' })
  findOne(@Param('milestoneId') milestoneId: string, @CurrentUser() user: any) {
    return this.submissionsService.findByMilestone(milestoneId, user.id);
  }
}
