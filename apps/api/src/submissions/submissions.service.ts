import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

const ALLOWED_MIME_TYPES = [
  'application/pdf', 'application/zip', 'application/x-zip-compressed',
  'image/png', 'image/jpeg', 'video/mp4',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024;

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(
    milestoneId: string,
    freelancerId: string,
    dto: CreateSubmissionDto,
    files: Express.Multer.File[],
  ) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { project: true },
    });

    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.project.freelancerId !== freelancerId) throw new ForbiddenException();
    if (!['PENDING', 'REJECTED', 'SUBMITTED'].includes(milestone.status)) {
      throw new BadRequestException('Cannot submit for this milestone status');
    }

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new BadRequestException(`File type ${file.mimetype} not allowed`);
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(`File ${file.originalname} exceeds 50MB limit`);
      }
    }

    const existing = await this.prisma.submission.findUnique({ where: { milestoneId } });
    const submission = existing
      ? await this.prisma.submission.update({
          where: { milestoneId },
          data: { githubUrl: dto.githubUrl, notes: dto.notes },
          include: { files_meta: true },
        })
      : await this.prisma.submission.create({
          data: { milestoneId, githubUrl: dto.githubUrl, notes: dto.notes },
          include: { files_meta: true },
        });

    const uploadedFiles: {
      fileName: string; fileKey: string; fileUrl: string;
      fileSize: number; mimeType: string;
    }[] = [];

    for (const file of files) {
      try {
        const key = `submissions/${milestoneId}/${Date.now()}-${file.originalname}`;
        const url = await this.storage.upload(key, file.buffer, file.mimetype);
        uploadedFiles.push({
          fileName: file.originalname,
          fileKey: key,
          fileUrl: url,
          fileSize: file.size,
          mimeType: file.mimetype,
        });
      } catch {
        // non-fatal; metadata already persisted
      }
    }

    if (uploadedFiles.length === 0) return submission;

    return this.prisma.submission.update({
      where: { milestoneId },
      data: { files_meta: { create: uploadedFiles } },
      include: { files_meta: true },
    });
  }

  async findByMilestone(milestoneId: string, userId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { project: true },
    });

    if (!milestone) throw new NotFoundException('Milestone not found');

    const isParticipant =
      milestone.project.clientId === userId || milestone.project.freelancerId === userId;
    if (!isParticipant) throw new ForbiddenException();

    return this.prisma.submission.findUnique({
      where: { milestoneId },
      include: { files_meta: true },
    });
  }
}
