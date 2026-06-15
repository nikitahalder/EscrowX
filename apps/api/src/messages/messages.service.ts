import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async send(projectId: string, senderId: string, content: string, fileUrl?: string, fileName?: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const isParticipant = project.clientId === senderId || project.freelancerId === senderId;
    if (!isParticipant) throw new ForbiddenException();

    return this.prisma.message.create({
      data: { projectId, senderId, content, fileUrl, fileName },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true, walletAddress: true } },
      },
    });
  }

  async findByProject(projectId: string, userId: string, cursor?: string, limit = 50) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const isParticipant =
      project.clientId === userId ||
      project.freelancerId === userId ||
      project.arbitratorId === userId;
    if (!isParticipant) throw new ForbiddenException();

    const messages = await this.prisma.message.findMany({
      where: { projectId },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true, walletAddress: true } },
      },
    });

    // Mark messages as read
    await this.prisma.message.updateMany({
      where: { projectId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });

    return messages;
  }

  async markRead(projectId: string, userId: string) {
    return this.prisma.message.updateMany({
      where: { projectId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
  }
}
