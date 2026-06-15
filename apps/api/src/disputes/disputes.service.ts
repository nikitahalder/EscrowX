import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { StorageService } from '../storage/storage.service';
import { RaiseDisputeDto, ResolveDisputeDto } from './dto/dispute.dto';
import { DisputeResolution } from '@prisma/client';

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
    private readonly storage: StorageService,
  ) {}

  async buildRaiseDisputeTx(
    projectId: string,
    userId: string,
    userWallet: string,
    dto: RaiseDisputeDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { dispute: true },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.clientId !== userId && project.freelancerId !== userId) {
      throw new ForbiddenException('Only project participants can raise disputes');
    }
    if (project.dispute) throw new ConflictException('Dispute already exists for this project');
    if (['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(project.status)) {
      throw new BadRequestException('Cannot raise dispute for this project status');
    }
    if (!project.contractId) throw new BadRequestException('Project not on-chain');

    const txXdr = await this.stellar.buildRaiseDisputeTx({
      callerAddress: userWallet,
      projectId: BigInt(project.contractId),
      milestoneId: dto.milestoneIdx ?? 0,
      reason: dto.reason,
    });

    return { txXdr };
  }

  async confirmRaiseDispute(
    projectId: string,
    userId: string,
    dto: RaiseDisputeDto,
    txHash: string,
    evidenceFiles: Express.Multer.File[],
  ) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.clientId !== userId && project.freelancerId !== userId) throw new ForbiddenException();

    const verified = await this.stellar.verifyTransaction(txHash);
    if (!verified) throw new BadRequestException('Transaction not confirmed on-chain');

    const evidenceUploads = await Promise.all(
      (evidenceFiles || []).map(async (file) => {
        const key = `disputes/${projectId}/${Date.now()}-${file.originalname}`;
        const url = await this.storage.upload(key, file.buffer, file.mimetype);
        return {
          uploadedBy: userId,
          fileName: file.originalname,
          fileKey: key,
          fileUrl: url,
          fileSize: file.size,
          mimeType: file.mimetype,
          notes: dto.description,
        };
      }),
    );

    const [dispute] = await this.prisma.$transaction([
      this.prisma.dispute.create({
        data: {
          projectId,
          raisedById: userId,
          reason: dto.reason,
          description: dto.description,
          milestoneId: dto.milestoneId,
          txHash,
          evidence: { create: evidenceUploads },
        },
        include: { evidence: true },
      }),
      this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'DISPUTED' },
      }),
    ]);

    return dispute;
  }

  async getDispute(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const isParticipant =
      project.clientId === userId ||
      project.freelancerId === userId ||
      project.arbitratorId === userId;

    if (!isParticipant) throw new ForbiddenException();

    const dispute = await this.prisma.dispute.findUnique({
      where: { projectId },
      include: {
        raisedBy: { select: { id: true, displayName: true, walletAddress: true } },
        evidence: true,
      },
    });

    if (!dispute) throw new NotFoundException('No dispute for this project');
    return dispute;
  }

  async buildResolveTx(
    projectId: string,
    arbitratorId: string,
    arbitratorWallet: string,
    dto: ResolveDisputeDto,
  ) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.arbitratorId !== arbitratorId) throw new ForbiddenException('Only arbitrator can resolve');
    if (project.status !== 'DISPUTED') throw new BadRequestException('Project is not disputed');
    if (!project.contractId) throw new BadRequestException('Project not on-chain');

    const resolutionMap = {
      FULL_CLIENT_REFUND: 0,
      FULL_FREELANCER_PAYMENT: 1,
      PARTIAL_SPLIT: 2,
    };

    const txXdr = await this.stellar.buildResolveDisputeTx({
      arbitratorAddress: arbitratorWallet,
      projectId: BigInt(project.contractId),
      resolution: resolutionMap[dto.resolution],
      clientBps: dto.clientBps ?? 5000,
    });

    return { txXdr };
  }

  async confirmResolveDispute(
    projectId: string,
    arbitratorId: string,
    dto: ResolveDisputeDto,
    txHash: string,
  ) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.arbitratorId !== arbitratorId) throw new ForbiddenException();

    const verified = await this.stellar.verifyTransaction(txHash);
    if (!verified) throw new BadRequestException('Transaction not confirmed on-chain');

    await this.prisma.$transaction([
      this.prisma.dispute.update({
        where: { projectId },
        data: {
          status: 'RESOLVED',
          resolution: dto.resolution as DisputeResolution,
          clientBps: dto.clientBps,
          txHash,
          resolvedAt: new Date(),
        },
      }),
      this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'RESOLVED' },
      }),
    ]);

    return this.getDispute(projectId, arbitratorId);
  }

  async getAllDisputes(arbitratorId: string) {
    return this.prisma.dispute.findMany({
      where: {
        project: { arbitratorId },
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
      },
      include: {
        project: {
          include: {
            client: { select: { id: true, displayName: true, walletAddress: true } },
            freelancer: { select: { id: true, displayName: true, walletAddress: true } },
          },
        },
        raisedBy: { select: { id: true, displayName: true, walletAddress: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
