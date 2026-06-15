import { Controller, Get, Post, Param, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Platform statistics' })
  getStats(@CurrentUser() user: any) {
    return this.adminService.getStats(user);
  }

  @Get('projects')
  @ApiOperation({ summary: 'All projects' })
  getProjects(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getProjects(user, page, limit);
  }

  @Get('disputes')
  @ApiOperation({ summary: 'Open disputes' })
  getDisputes(@CurrentUser() user: any) {
    return this.adminService.getDisputes(user);
  }

  @Get('users')
  @ApiOperation({ summary: 'All users' })
  getUsers(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getUsers(user, page, limit);
  }

  @Post('users/:id/set-arbitrator')
  @ApiOperation({ summary: 'Promote user to arbitrator' })
  setArbitrator(@CurrentUser() user: any, @Param('id') targetId: string) {
    return this.adminService.setArbitrator(user, targetId);
  }
}
