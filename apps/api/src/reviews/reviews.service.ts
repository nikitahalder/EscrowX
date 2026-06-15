import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async create(projectId: string, reviewerId: string, dto: CreateReviewDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    if (project.status !== 'COMPLETED' && project.status !== 'RESOLVED') {
      throw new BadRequestException('Can only review completed projects');
    }

    let targetId: string;
    if (project.clientId === reviewerId) {
      if (!project.freelancerId) throw new BadRequestException('No freelancer on this project');
      targetId = project.freelancerId;
    } else if (project.freelancerId === reviewerId) {
      targetId = project.clientId;
    } else {
      throw new ForbiddenException('Only project participants can leave reviews');
    }

    const existing = await this.prisma.review.findUnique({
      where: { projectId_reviewerId: { projectId, reviewerId } },
    });
    if (existing) throw new ConflictException('You have already reviewed this project');

    const review = await this.prisma.review.create({
      data: { projectId, reviewerId, targetId, rating: dto.rating, reviewText: dto.reviewText },
    });

    await this.users.recalculateReputation(targetId);

    return review;
  }

  async findByProject(projectId: string) {
    return this.prisma.review.findMany({
      where: { projectId },
      include: {
        reviewer: { select: { id: true, displayName: true, avatarUrl: true } },
        target: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.review.findMany({
      where: { targetId: userId },
      include: {
        reviewer: { select: { id: true, displayName: true, avatarUrl: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
