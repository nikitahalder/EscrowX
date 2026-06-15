export type UserRole = 'CLIENT' | 'FREELANCER' | 'ARBITRATOR' | 'ADMIN';

export type ProjectStatus =
  | 'CREATED' | 'AWAITING_FUNDING' | 'FUNDED' | 'FREELANCER_ACCEPTED'
  | 'IN_PROGRESS' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED'
  | 'COMPLETED' | 'DISPUTED' | 'RESOLVED' | 'CANCELLED';

export type MilestoneStatus =
  | 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'DISPUTED';

export interface User {
  id: string;
  walletAddress: string;
  role: UserRole;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  reputationScore: number;
  completedProjects: number;
  createdAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  contractIdx: number;
  title: string;
  description: string;
  amount: number;
  dueDate?: string;
  status: MilestoneStatus;
  proofHash?: string;
  rejectionFeedback?: string;
  order: number;
  submission?: Submission;
}

export interface Submission {
  id: string;
  milestoneId: string;
  githubUrl?: string;
  deploymentUrl?: string;
  notes?: string;
  files_meta: UploadedFile[];
  createdAt: string;
}

export interface UploadedFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface Project {
  id: string;
  contractId?: string;
  clientId: string;
  freelancerId?: string;
  arbitratorId?: string;
  title: string;
  description: string;
  budget: number;
  tokenAddress: string;
  status: ProjectStatus;
  txHash?: string;
  createdAt: string;
  completedAt?: string;
  client: Partial<User>;
  freelancer?: Partial<User>;
  arbitrator?: Partial<User>;
  milestones: Milestone[];
  dispute?: Dispute;
  reviews?: Review[];
}

export interface Dispute {
  id: string;
  projectId: string;
  reason: string;
  description: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';
  resolution?: 'FULL_CLIENT_REFUND' | 'FULL_FREELANCER_PAYMENT' | 'PARTIAL_SPLIT';
  clientBps?: number;
  txHash?: string;
  raisedBy: Partial<User>;
  evidence: DisputeEvidence[];
  createdAt: string;
  resolvedAt?: string;
}

export interface DisputeEvidence {
  id: string;
  fileName: string;
  fileUrl: string;
  notes?: string;
}

export interface Message {
  id: string;
  projectId: string;
  senderId: string;
  content: string;
  fileUrl?: string;
  isRead: boolean;
  createdAt: string;
  sender: Partial<User>;
}

export interface Review {
  id: string;
  projectId: string;
  reviewerId: string;
  rating: number;
  reviewText?: string;
  reviewer: Partial<User>;
  createdAt: string;
}
