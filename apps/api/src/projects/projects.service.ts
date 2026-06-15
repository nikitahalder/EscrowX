import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { UsersService } from '../users/users.service';
import { CreateProjectDto, FundProjectDto } from './dto/create-project.dto';
import { ProjectStatus } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    readonly stellar: StellarService,
    private readonly users: UsersService,
  ) {}

  async create(clientId: string, clientWallet: string, dto: CreateProjectDto) {
    const platformWallet =
      process.env.PLATFORM_WALLET_PUBLIC ||
      'GA4UMRAEAUHPZKI23QEJT3LOHMVTDZS2PFTCEXV2MH25O5PM3C7AHKZG';
    const arbitrator = await this.users.findOrCreate(platformWallet);

    const totalBudget = dto.milestones.reduce((sum, m) => sum + m.amount, 0);
    const tokenAddress =
      dto.tokenAddress ||
      process.env.USDC_CONTRACT_ID ||
      'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

    let freelancer: any = null;
    let txXdr: string | null = null;

    if (dto.freelancerAddress) {
      freelancer = await this.users.findOrCreate(dto.freelancerAddress);
      if (freelancer.walletAddress === clientWallet) {
        throw new BadRequestException('Client and freelancer cannot be the same wallet');
      }
      try {
        txXdr = await this.stellar.buildCreateProjectTx({
          clientAddress: clientWallet,
          freelancerAddress: dto.freelancerAddress,
          arbitratorAddress: platformWallet,
          tokenAddress,
          totalAmount: BigInt(Math.round(totalBudget * 1e7)),
          milestones: dto.milestones.map((m) => ({
            amount: BigInt(Math.round(m.amount * 1e7)),
          })),
        });
      } catch (e: any) {
        throw new BadRequestException(
          `Could not build on-chain transaction: ${e?.message ?? 'Stellar RPC error'}. ` +
          `Ensure your wallet is funded on testnet (visit friendbot.stellar.org).`,
        );
      }
    }

    const project = await this.prisma.project.create({
      data: {
        clientId,
        freelancerId: freelancer?.id ?? null,
        arbitratorId: arbitrator.id,
        title: dto.title,
        description: dto.description,
        budget: totalBudget,
        tokenAddress,
        status: freelancer ? 'AWAITING_FUNDING' : 'CREATED',
        milestones: {
          create: dto.milestones.map((m, i) => ({
            contractIdx: i,
            title: m.title,
            description: m.description,
            amount: m.amount,
            dueDate: m.dueDate ? new Date(m.dueDate) : null,
            order: i,
          })),
        },
      },
      include: { milestones: true },
    });

    return { project, txXdr };
  }

  async joinProject(projectId: string, freelancerId: string, freelancerWallet: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true, milestones: { orderBy: { order: 'asc' } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.status !== 'CREATED') {
      throw new BadRequestException('This project is no longer open for freelancers to join');
    }
    if (project.clientId === freelancerId) {
      throw new BadRequestException('You cannot join your own project as a freelancer');
    }
    if (project.freelancerId) {
      throw new ConflictException('A freelancer has already joined this project');
    }

    const freelancer = await this.users.findOrCreate(freelancerWallet);

    return this.prisma.project.update({
      where: { id: projectId },
      data: { freelancerId: freelancer.id, status: 'AWAITING_FUNDING' },
      include: {
        client: { select: { id: true, displayName: true, walletAddress: true } },
        freelancer: { select: { id: true, displayName: true, walletAddress: true } },
        milestones: { orderBy: { order: 'asc' } },
      },
    });
  }

  async buildContractTx(projectId: string, clientId: string, clientWallet: string) {
    const project = await this.getProjectOrThrow(projectId);
    if (project.clientId !== clientId) throw new ForbiddenException();
    if (project.status !== 'AWAITING_FUNDING') {
      throw new BadRequestException('Project is not in the correct state to set up the contract');
    }
    if (project.contractId) {
      throw new BadRequestException('On-chain contract already exists for this project');
    }

    const freelancerUser = await this.prisma.user.findUnique({
      where: { id: project.freelancerId! },
    });
    if (!freelancerUser) throw new BadRequestException('No freelancer assigned to this project');

    const platformWallet =
      process.env.PLATFORM_WALLET_PUBLIC ||
      'GA4UMRAEAUHPZKI23QEJT3LOHMVTDZS2PFTCEXV2MH25O5PM3C7AHKZG';

    let txXdr: string;
    try {
      txXdr = await this.stellar.buildCreateProjectTx({
        clientAddress: clientWallet,
        freelancerAddress: freelancerUser.walletAddress,
        arbitratorAddress: platformWallet,
        tokenAddress: project.tokenAddress,
        totalAmount: BigInt(Math.round(Number(project.budget) * 1e7)),
        milestones: project.milestones.map((m) => ({
          amount: BigInt(Math.round(Number(m.amount) * 1e7)),
        })),
      });
    } catch (e: any) {
      throw new BadRequestException(
        `Could not build on-chain transaction: ${e?.message ?? 'Stellar RPC error'}. ` +
        `Ensure your wallet is funded on testnet (visit friendbot.stellar.org).`,
      );
    }

    return { txXdr };
  }

  async confirmCreation(projectId: string, clientId: string, txHash: string) {
    const project = await this.getProjectOrThrow(projectId);
    if (project.clientId !== clientId) throw new ForbiddenException();

    const verified = await this.stellar.verifyTransaction(txHash);
    if (!verified) throw new BadRequestException('Transaction not confirmed on-chain');

    const onChainId = await this.stellar.getTransactionReturnValue(txHash);
    const contractId = onChainId != null ? String(onChainId) : null;

    return this.prisma.project.update({
      where: { id: projectId },
      data: { txHash, contractId, status: 'AWAITING_FUNDING' },
      include: { milestones: true },
    });
  }

  async buildFundTx(projectId: string, clientId: string, clientWallet: string) {
    const project = await this.getProjectOrThrow(projectId);
    if (project.clientId !== clientId) throw new ForbiddenException();
    if (project.status !== 'AWAITING_FUNDING') {
      throw new BadRequestException('Project is not awaiting funding');
    }
    if (!project.contractId) {
      throw new BadRequestException('Project not yet confirmed on-chain');
    }

    const txXdr = await this.stellar.buildFundProjectTx({
      clientAddress: clientWallet,
      projectId: BigInt(project.contractId),
    });

    return { txXdr };
  }

  async confirmFunding(projectId: string, clientId: string, txHash: string) {
    const project = await this.getProjectOrThrow(projectId);
    if (project.clientId !== clientId) throw new ForbiddenException();

    const verified = await this.stellar.verifyTransaction(txHash);
    if (!verified) throw new BadRequestException('Transaction not confirmed on-chain');

    return this.prisma.project.update({
      where: { id: projectId },
      data: { txHash, status: 'FUNDED' },
    });
  }

  async buildAcceptTx(projectId: string, freelancerId: string, freelancerWallet: string) {
    const project = await this.getProjectOrThrow(projectId);
    if (project.freelancerId !== freelancerId) throw new ForbiddenException();
    if (project.status !== 'FUNDED') throw new BadRequestException('Project not funded');
    if (!project.contractId) throw new BadRequestException('Project not on-chain');

    const txXdr = await this.stellar.buildAcceptProjectTx({
      freelancerAddress: freelancerWallet,
      projectId: BigInt(project.contractId),
    });

    // If the freelancer doesn't yet have a USDC trustline, include a changeTrust tx
    // they must sign first so payment can reach them on milestone approval.
    const hasTrustline = await this.stellar.hasUsdcTrustline(freelancerWallet);
    if (!hasTrustline) {
      const trustlineTxXdr = await this.stellar.buildTrustlineTx(freelancerWallet);
      return { txXdr, trustlineTxXdr };
    }

    return { txXdr };
  }

  async confirmAcceptance(projectId: string, freelancerId: string, txHash: string) {
    const project = await this.getProjectOrThrow(projectId);
    if (project.freelancerId !== freelancerId) throw new ForbiddenException();

    const verified = await this.stellar.verifyTransaction(txHash);
    if (!verified) throw new BadRequestException('Transaction not confirmed on-chain');

    return this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'IN_PROGRESS' },
    });
  }

  async findAll(userId: string, role: 'client' | 'freelancer', status?: ProjectStatus) {
    const where: any = {};
    if (role === 'client') where.clientId = userId;
    else where.freelancerId = userId;
    if (status) where.status = status;

    return this.prisma.project.findMany({
      where,
      include: {
        client: { select: { id: true, displayName: true, walletAddress: true, avatarUrl: true } },
        freelancer: { select: { id: true, displayName: true, walletAddress: true, avatarUrl: true } },
        milestones: { orderBy: { order: 'asc' } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: { select: { id: true, displayName: true, walletAddress: true, avatarUrl: true, reputationScore: true } },
        freelancer: { select: { id: true, displayName: true, walletAddress: true, avatarUrl: true, reputationScore: true } },
        arbitrator: { select: { id: true, displayName: true, walletAddress: true, avatarUrl: true } },
        milestones: {
          orderBy: { order: 'asc' },
          include: { submission: { include: { files_meta: true } } },
        },
        dispute: true,
        reviews: {
          include: {
            reviewer: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const isOpenForFreelancers = project.status === 'CREATED';
    const isParticipant =
      project.clientId === userId ||
      project.freelancerId === userId ||
      project.arbitratorId === userId;

    if (!isOpenForFreelancers && !isParticipant) throw new ForbiddenException('Access denied');

    return project;
  }

  async getPublicPreview(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: { select: { id: true, displayName: true, walletAddress: true, avatarUrl: true } },
        milestones: { select: { id: true, title: true, description: true, amount: true, dueDate: true, order: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.status !== 'CREATED') throw new NotFoundException('Project not found or no longer open');
    return project;
  }

  async getPublicProjects(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where: { status: { in: ['CREATED', 'AWAITING_FUNDING'] } },
        skip,
        take: limit,
        include: {
          client: { select: { id: true, displayName: true, avatarUrl: true } },
          milestones: { select: { id: true, title: true, amount: true }, orderBy: { order: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where: { status: { in: ['CREATED', 'AWAITING_FUNDING'] } } }),
    ]);
    return { projects, total, page, limit };
  }

  async setContractId(projectId: string, contractId: string) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { contractId },
    });
  }

  async deleteProject(projectId: string, clientId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.clientId !== clientId) throw new ForbiddenException('Only the client can delete this project');
    if (!['CREATED', 'AWAITING_FUNDING'].includes(project.status)) {
      throw new BadRequestException('Cannot delete a project that has already been funded or is in progress');
    }
    await this.prisma.project.delete({ where: { id: projectId } });
    return { success: true };
  }

  private async getProjectOrThrow(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { milestones: { orderBy: { order: 'asc' } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
