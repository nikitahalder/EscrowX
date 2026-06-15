import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: any) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Admin access required');
  }

  async getStats(user: any) {
    this.assertAdmin(user);

    const [
      totalProjects,
      activeProjects,
      completedProjects,
      disputedProjects,
      totalUsers,
    ] = await Promise.all([
      this.prisma.project.count(),
      this.prisma.project.count({ where: { status: { in: ['FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW'] } } }),
      this.prisma.project.count({ where: { status: 'COMPLETED' } }),
      this.prisma.project.count({ where: { status: 'DISPUTED' } }),
      this.prisma.user.count(),
    ]);

    const escrowVolume = await this.prisma.project.aggregate({
      _sum: { budget: true },
      where: { status: { in: ['COMPLETED', 'RESOLVED'] } },
    });

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      disputedProjects,
      totalUsers,
      escrowVolume: escrowVolume._sum.budget ?? 0,
      disputeRate: totalProjects > 0 ? (disputedProjects / totalProjects * 100).toFixed(2) : '0',
    };
  }

  async getProjects(user: any, page = 1, limit = 20) {
    this.assertAdmin(user);
    const skip = (page - 1) * limit;
    return this.prisma.project.findMany({
      skip,
      take: limit,
      include: {
        client: { select: { id: true, walletAddress: true, displayName: true } },
        freelancer: { select: { id: true, walletAddress: true, displayName: true } },
        dispute: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDisputes(user: any) {
    this.assertAdmin(user);
    return this.prisma.dispute.findMany({
      where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      include: {
        project: {
          include: {
            client: { select: { id: true, walletAddress: true, displayName: true } },
            freelancer: { select: { id: true, walletAddress: true, displayName: true } },
            arbitrator: { select: { id: true, walletAddress: true, displayName: true } },
          },
        },
        raisedBy: { select: { id: true, walletAddress: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUsers(user: any, page = 1, limit = 20) {
    this.assertAdmin(user);
    const skip = (page - 1) * limit;
    return this.prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async setArbitrator(user: any, targetUserId: string) {
    this.assertAdmin(user);
    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: 'ARBITRATOR' },
    });
  }
}
