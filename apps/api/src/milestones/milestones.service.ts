import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';

@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
  ) {}

  async buildSubmitTx(milestoneId: string, freelancerId: string, freelancerWallet: string) {
    const milestone = await this.getMilestoneWithProject(milestoneId);
    if (milestone.project.freelancerId !== freelancerId) throw new ForbiddenException();
    if (milestone.project.status !== 'IN_PROGRESS') throw new BadRequestException('Project not in progress');
    if (!['PENDING', 'REJECTED', 'SUBMITTED'].includes(milestone.status)) {
      throw new BadRequestException('Milestone cannot be submitted in current state');
    }

    const proofHash = `escrowx:${milestone.id}:${Date.now()}`;

    if (milestone.status === 'SUBMITTED') {
      return { offChain: true, proofHash: milestone.proofHash ?? proofHash, milestone };
    }

    if (milestone.status === 'REJECTED') {
      const updated = await this.prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: 'SUBMITTED', proofHash },
      });
      return { offChain: true, proofHash, milestone: updated };
    }

    if (!milestone.project.contractId) {
      const updated = await this.prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: 'SUBMITTED', proofHash },
      });
      return { offChain: true, proofHash, milestone: updated };
    }

    const txXdr = await this.stellar.buildSubmitMilestoneTx({
      freelancerAddress: freelancerWallet,
      projectId: BigInt(milestone.project.contractId),
      milestoneId: milestone.contractIdx,
      proofHash,
    });

    return { txXdr, proofHash };
  }

  async confirmSubmission(milestoneId: string, freelancerId: string, txHash: string, proofHash: string) {
    const milestone = await this.getMilestoneWithProject(milestoneId);
    if (milestone.project.freelancerId !== freelancerId) throw new ForbiddenException();

    const verified = await this.stellar.verifyTransaction(txHash);
    if (!verified) throw new BadRequestException('Transaction not confirmed on-chain');

    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: 'SUBMITTED', proofHash },
    });
  }

  async buildApproveTx(milestoneId: string, clientId: string, clientWallet: string) {
    const milestone = await this.getMilestoneWithProject(milestoneId);
    if (milestone.project.clientId !== clientId) throw new ForbiddenException();
    if (milestone.status !== 'SUBMITTED') throw new BadRequestException('Milestone not submitted');

    if (!milestone.project.contractId) {
      const updated = await this.prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: 'APPROVED' },
      });
      await this.finalizeProjectIfComplete(milestone.projectId, milestoneId, milestone.project);
      return { offChain: true, milestone: updated };
    }

    const txXdr = await this.stellar.buildApproveMilestoneTx({
      clientAddress: clientWallet,
      projectId: BigInt(milestone.project.contractId),
      milestoneId: milestone.contractIdx,
    });
    return { txXdr };
  }

  async confirmApproval(milestoneId: string, clientId: string, txHash: string) {
    const milestone = await this.getMilestoneWithProject(milestoneId);
    if (milestone.project.clientId !== clientId) throw new ForbiddenException();

    const verified = await this.stellar.verifyTransaction(txHash);
    if (!verified) throw new BadRequestException('Transaction not confirmed on-chain');

    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: 'APPROVED' },
    });

    await this.finalizeProjectIfComplete(milestone.projectId, milestoneId, milestone.project);

    return updated;
  }

  async rejectMilestone(milestoneId: string, clientId: string, feedback: string) {
    const milestone = await this.getMilestoneWithProject(milestoneId);
    if (milestone.project.clientId !== clientId) throw new ForbiddenException();
    if (milestone.status !== 'SUBMITTED') throw new BadRequestException('Milestone not submitted');

    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: 'REJECTED', rejectionFeedback: feedback },
    });
  }

  private async finalizeProjectIfComplete(
    projectId: string,
    justApprovedId: string,
    project: { clientId: string; freelancerId: string | null },
  ) {
    const all = await this.prisma.milestone.findMany({ where: { projectId } });
    const allApproved = all.every((m) => m.id === justApprovedId || m.status === 'APPROVED');
    if (!allApproved) return;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await this.prisma.user.updateMany({
      where: { id: { in: [project.clientId, project.freelancerId].filter(Boolean) as string[] } },
      data: { completedProjects: { increment: 1 } },
    });
  }

  private async getMilestoneWithProject(milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: {
          include: {
            client: { select: { id: true, walletAddress: true } },
            freelancer: { select: { id: true, walletAddress: true } },
          },
        },
      },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    return milestone;
  }
}
