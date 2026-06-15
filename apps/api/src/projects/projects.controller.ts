import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, Query,
  ParseIntPipe, DefaultValuePipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateProjectDto, ConfirmTxDto } from './dto/create-project.dto';
import { SubmitSignedTxDto } from './dto/submit-tx.dto';
import { ProjectStatus } from '@prisma/client';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create project and get unsigned transaction XDR' })
  create(@CurrentUser() user: any, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, user.walletAddress, dto);
  }

  @Post(':id/confirm-creation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm project creation with signed tx hash' })
  confirmCreation(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ConfirmTxDto) {
    return this.projectsService.confirmCreation(id, user.id, dto.txHash);
  }

  @Post(':id/fund')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get fund project transaction XDR' })
  buildFundTx(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.buildFundTx(id, user.id, user.walletAddress);
  }

  @Post(':id/confirm-funding')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm project funding with tx hash' })
  confirmFunding(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ConfirmTxDto) {
    return this.projectsService.confirmFunding(id, user.id, dto.txHash);
  }

  @Post(':id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Freelancer: get accept project transaction XDR' })
  buildAcceptTx(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.buildAcceptTx(id, user.id, user.walletAddress);
  }

  @Post(':id/confirm-acceptance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm project acceptance with tx hash' })
  confirmAcceptance(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ConfirmTxDto) {
    return this.projectsService.confirmAcceptance(id, user.id, dto.txHash);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: 'role', enum: ['client', 'freelancer'], required: false })
  @ApiQuery({ name: 'status', enum: ProjectStatus, required: false })
  @ApiOperation({ summary: 'List my projects' })
  findAll(
    @CurrentUser() user: any,
    @Query('role') role: 'client' | 'freelancer' = 'client',
    @Query('status') status?: ProjectStatus,
  ) {
    return this.projectsService.findAll(user.id, role, status);
  }

  @Post('submit-signed-tx')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a signed transaction XDR to Stellar network' })
  async submitSignedTx(@Body() dto: SubmitSignedTxDto) {
    const txHash = await this.projectsService.stellar.submitSignedTransaction(dto.signedXdr);
    return { txHash };
  }

  @Get('browse')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({ summary: 'Browse open projects (public)' })
  browse(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.projectsService.getPublicProjects(page, Math.min(limit, 50));
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Public preview of a CREATED project (no auth required)' })
  getPublicPreview(@Param('id') id: string) {
    return this.projectsService.getPublicPreview(id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get project details' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.findOne(id, user.id);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Freelancer: join an open project via invite link' })
  joinProject(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.joinProject(id, user.id, user.walletAddress);
  }

  @Post(':id/build-contract-tx')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Client: build on-chain create_project tx after freelancer joins' })
  buildContractTx(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.buildContractTx(id, user.id, user.walletAddress);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a project (client only, before funding)' })
  deleteProject(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.deleteProject(id, user.id);
  }
}
