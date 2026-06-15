import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(walletAddress: string) {
    return this.prisma.user.upsert({
      where: { walletAddress },
      create: { walletAddress },
      update: {},
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByWallet(walletAddress: string) {
    return this.prisma.user.findUnique({ where: { walletAddress } });
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
    });
  }

  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            clientProjects: true,
            freelancerProjects: true,
            reviewsReceived: true,
          },
        },
        reviewsReceived: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { reviewer: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getLeaderboard() {
    return this.prisma.user.findMany({
      where: { reputationScore: { gt: 0 } },
      orderBy: { reputationScore: 'desc' },
      take: 50,
      select: {
        id: true,
        walletAddress: true,
        displayName: true,
        avatarUrl: true,
        reputationScore: true,
        completedProjects: true,
        role: true,
      },
    });
  }

  async recalculateReputation(userId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { targetId: userId },
      select: { rating: true },
    });
    if (reviews.length === 0) return;
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await this.prisma.user.update({
      where: { id: userId },
      data: { reputationScore: avg },
    });
  }
}
