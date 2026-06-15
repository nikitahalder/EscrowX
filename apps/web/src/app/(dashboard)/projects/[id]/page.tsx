'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, DollarSign, Clock, CheckCircle, AlertTriangle, XCircle,
  MessageSquare, FileText, Loader2, ExternalLink, Shield, Scale,
  Lock, Unlock, ChevronRight, Trash2, Link2, Copy, CheckCircle2,
  Users, Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { projectsApi, milestonesApi, messagesApi, disputesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { signTransactionWithFreighter, getNetworkPassphrase } from '@/lib/wallet';
import {
  formatUSDC, formatDate, formatDateTime,
  PROJECT_STATUS_LABELS, MILESTONE_STATUS_LABELS, shortenAddress,
} from '@/lib/utils';
import type { Project, Message } from '@/types';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'milestones' | 'messages' | 'details'>('milestones');

  // Reject milestone modal
  const [rejectMilestoneId, setRejectMilestoneId] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');

  // Dispute resolve (arbitrator)
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState<'FULL_CLIENT_REFUND' | 'FULL_FREELANCER_PAYMENT' | 'PARTIAL_SPLIT'>('FULL_CLIENT_REFUND');
  const [clientBps, setClientBps] = useState(5000);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const milestonesRef  = useRef<HTMLDivElement>(null);

  const isClient     = project?.clientId === user?.id;
  const isFreelancer = project?.freelancerId === user?.id;
  const isArbitrator = project?.arbitratorId === user?.id;

  const network       = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
  const passphrase    = getNetworkPassphrase(network);
  const explorerBase  = network === 'mainnet'
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';

  useEffect(() => {
    projectsApi.getOne(id).then((p: any) => {
      setProject(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!project) return;
    messagesApi.list(id).then((msgs: any) => {
      setMessages(Array.isArray(msgs) ? msgs : []);
    }).catch(() => {});
  }, [project?.id, id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function refresh() {
    const updated = await projectsApi.getOne(id) as any;
    setProject(updated);
  }

  async function handleFund() {
    try {
      setTxLoading('fund');
      const wallet = user?.walletAddress;
      if (!project!.contractId) {
        const { txXdr: createXdr } = await projectsApi.buildContractTx(project!.id);
        const signedCreate = await signTransactionWithFreighter(createXdr, passphrase, wallet);
        const { txHash: createHash } = await projectsApi.submitSignedTx(signedCreate);
        await projectsApi.confirmCreation(project!.id, createHash);
      }
      const { txXdr } = await projectsApi.buildFundTx(project!.id) as any;
      const signedXdr = await signTransactionWithFreighter(txXdr, passphrase, wallet);
      const { txHash } = await projectsApi.submitSignedTx(signedXdr);
      await projectsApi.confirmFunding(project!.id, txHash);
      await refresh();
    } catch (e: any) {
      alert(e.message || 'Transaction failed');
    } finally {
      setTxLoading(null);
    }
  }

  async function handleAccept() {
    try {
      setTxLoading('accept');
      const wallet = user?.walletAddress;
      const result = await projectsApi.buildAcceptTx(project!.id) as any;

      if (result.trustlineTxXdr) {
        const signedTrustline = await signTransactionWithFreighter(result.trustlineTxXdr, passphrase, wallet);
        await projectsApi.submitSignedTx(signedTrustline);
      }

      const signedXdr = await signTransactionWithFreighter(result.txXdr, passphrase, wallet);
      const { txHash } = await projectsApi.submitSignedTx(signedXdr);
      await projectsApi.confirmAcceptance(project!.id, txHash);
      await refresh();
    } catch (e: any) {
      alert(e.message || 'Transaction failed');
    } finally {
      setTxLoading(null);
    }
  }

  async function handleApproveMilestone(milestoneId: string) {
    try {
      setTxLoading(`approve-${milestoneId}`);
      const wallet = user?.walletAddress;
      const result = await milestonesApi.buildApproveTx(milestoneId) as any;
      if (!result.offChain) {
        const signedXdr = await signTransactionWithFreighter(result.txXdr, passphrase, wallet);
        const { txHash } = await projectsApi.submitSignedTx(signedXdr);
        await milestonesApi.confirmApprove(milestoneId, txHash);
      }
      await refresh();
    } catch (e: any) {
      alert(e.message || e.error || 'Transaction failed');
    } finally {
      setTxLoading(null);
    }
  }

  async function handleRejectMilestone() {
    if (!rejectMilestoneId || !rejectFeedback.trim()) return;
    try {
      setTxLoading(`reject-${rejectMilestoneId}`);
      await milestonesApi.reject(rejectMilestoneId, rejectFeedback);
      setRejectMilestoneId(null);
      setRejectFeedback('');
      await refresh();
    } catch (e: any) {
      alert(e.message || 'Failed to request changes');
    } finally {
      setTxLoading(null);
    }
  }

  async function handleResolveDispute() {
    if (!project) return;
    try {
      setResolving(true);
      const bps =
        resolution === 'FULL_CLIENT_REFUND'      ? 10000 :
        resolution === 'FULL_FREELANCER_PAYMENT'  ? 0 :
        clientBps;
      const { txXdr } = await disputesApi.buildResolveTx(project.id, { resolution, clientBps: bps }) as any;
      const signedXdr = await signTransactionWithFreighter(txXdr, passphrase, user?.walletAddress);
      const { txHash } = await projectsApi.submitSignedTx(signedXdr);
      await disputesApi.confirmResolve(project.id, { txHash, resolution, clientBps: bps });
      await refresh();
    } catch (e: any) {
      alert(e.message || 'Failed to resolve dispute');
    } finally {
      setResolving(false);
    }
  }

  async function copyInviteLink() {
    if (typeof window === 'undefined') return;
    const link = `${window.location.origin}/projects/${id}/join`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function handleDeleteProject() {
    setDeleting(true);
    try {
      await projectsApi.delete(id);
      router.push('/projects');
    } catch (e: any) {
      alert(e.message || 'Failed to delete project');
      setDeleting(false);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim()) return;
    const trimmed = newMessage.trim();
    setNewMessage('');
    try {
      const msg = await messagesApi.send(id, trimmed) as any;
      setMessages(prev => [...prev, msg]);
    } catch {
      setNewMessage(trimmed);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">Project not found</p>
        <Link href="/projects" className="text-blue-400 hover:underline text-sm mt-2 inline-block">
          Back to projects
        </Link>
      </div>
    );
  }

  const statusInfo = PROJECT_STATUS_LABELS[project.status] || {
    label: project.status, color: 'text-slate-400 bg-slate-400/10 border-slate-400/30',
  };
  const approvedCount  = project.milestones.filter(m => m.status === 'APPROVED').length;
  const totalCount     = project.milestones.length;
  const releasedAmount = project.milestones
    .filter(m => m.status === 'APPROVED')
    .reduce((s, m) => s + Number(m.amount), 0);
  const progressPct = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Delete Project Modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Project</h3>
                <p className="text-sm text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-slate-300 text-sm mb-2">
              Are you sure you want to delete <span className="font-semibold text-white">"{project?.title}"</span>?
            </p>
            <p className="text-slate-500 text-xs mb-6">
              The project and all its milestones will be permanently removed. This is only possible before the escrow is funded.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteProject}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete Project
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Milestone Modal ── */}
      {rejectMilestoneId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-1">Request Changes</h3>
            <p className="text-sm text-slate-400 mb-4">
              Describe what needs to be revised. The freelancer can resubmit after making changes.
            </p>
            <textarea
              value={rejectFeedback}
              onChange={e => setRejectFeedback(e.target.value)}
              rows={4}
              placeholder="e.g., The design doesn't match the mockups. Please revise the header layout..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none mb-4 text-sm"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleRejectMilestone}
                disabled={!rejectFeedback.trim() || !!txLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {txLoading?.startsWith('reject') ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Request Changes
              </button>
              <button
                onClick={() => { setRejectMilestoneId(null); setRejectFeedback(''); }}
                className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-6">
        <Link href="/projects" className="flex items-center gap-1.5 text-slate-400 hover:text-white mb-4 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white mb-2 truncate">{project.title}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              <span className="text-slate-500 text-xs">{formatDate(project.createdAt)}</span>
              {project.contractId && (
                <span className="text-slate-600 text-xs font-mono bg-slate-800 px-2 py-0.5 rounded-md">
                  Contract #{project.contractId}
                </span>
              )}
              {project.txHash && (
                <a
                  href={`${explorerBase}/tx/${project.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                >
                  <ExternalLink className="h-3 w-3" /> Stellar Explorer
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isClient && project.status === 'AWAITING_FUNDING' && (
              <>
                <button
                  onClick={handleFund}
                  disabled={txLoading === 'fund'}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  {txLoading === 'fund' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Fund Escrow
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-medium text-sm transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}
            {(isClient || isFreelancer) && project.status === 'IN_PROGRESS' && (
              <Link
                href={`/projects/${project.id}/dispute`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-medium text-sm transition-colors"
              >
                <AlertTriangle className="h-4 w-4" />
                Raise Dispute
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-3.5 w-3.5 text-slate-500" />
            <p className="text-xs text-slate-500">Total Escrow</p>
          </div>
          <p className="text-xl font-bold text-white">{formatUSDC(project.budget)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Milestones</p>
          <p className="text-xl font-bold text-white">
            {approvedCount}
            <span className="text-slate-500 text-base font-normal">/{totalCount}</span>
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Unlock className="h-3.5 w-3.5 text-emerald-500" />
            <p className="text-xs text-slate-500">Released</p>
          </div>
          <p className="text-xl font-bold text-emerald-400">{formatUSDC(releasedAmount)}</p>
        </div>
      </div>

      {/* ── Progress ── */}
      {totalCount > 0 && (
        <div className="mb-5 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400 text-xs">Overall Progress</span>
            <span className="text-white text-xs font-medium">{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>{approvedCount} approved</span>
            <span>{totalCount - approvedCount} remaining</span>
          </div>
        </div>
      )}

      {/* ── Transaction Timeline ── */}
      {(() => {
        const STEPS = [
          {
            key: 'created',
            label: 'Transaction Created',
            sub: 'Project terms defined',
            done: true,
          },
          {
            key: 'freelancer',
            label: 'Freelancer Accepted',
            sub: project.freelancer
              ? `${project.freelancer.displayName || shortenAddress(project.freelancer.walletAddress || '', 6)} joined`
              : 'Waiting for freelancer',
            done: !!project.freelancer,
          },
          {
            key: 'funded',
            label: 'Escrow Funded',
            sub: ['FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED', 'DISPUTED', 'RESOLVED'].includes(project.status)
              ? formatUSDC(project.budget) + ' locked on-chain'
              : 'Funds not yet deposited',
            done: ['FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED', 'DISPUTED', 'RESOLVED'].includes(project.status),
          },
          {
            key: 'inprogress',
            label: 'Work In Progress',
            sub: 'Freelancer delivering milestones',
            done: ['IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED'].includes(project.status),
          },
          {
            key: 'complete',
            label: 'Complete',
            sub: project.status === 'COMPLETED' ? 'Payment released' : 'All milestones approved',
            done: project.status === 'COMPLETED',
          },
        ];
        const activeIdx = STEPS.findLastIndex(s => s.done);

        return (
          <div className="mb-5 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Transaction Progress</p>
            </div>
            <div className="flex items-start gap-0">
              {STEPS.map((s, i) => {
                const isActive = i === activeIdx + 1;
                const isDone = s.done;
                return (
                  <div key={s.key} className="flex-1 flex flex-col items-center relative">
                    {i > 0 && (
                      <div className={`absolute top-3.5 right-1/2 left-0 h-0.5 ${
                        STEPS[i - 1].done ? 'bg-blue-500' : 'bg-slate-700'
                      }`} style={{ left: '-50%', right: '50%', top: '14px', position: 'absolute' }} />
                    )}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center z-10 flex-shrink-0 border-2 ${
                      isDone
                        ? 'bg-blue-500 border-blue-500'
                        : isActive
                        ? 'bg-slate-800 border-blue-500'
                        : 'bg-slate-800 border-slate-600'
                    }`}>
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      ) : isActive ? (
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-slate-600" />
                      )}
                    </div>
                    <p className={`text-xs font-medium mt-2 text-center leading-tight ${
                      isDone ? 'text-blue-300' : isActive ? 'text-white' : 'text-slate-500'
                    }`}>{s.label}</p>
                    <p className="text-xs text-slate-600 text-center mt-0.5 leading-tight hidden sm:block">{s.sub}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Invite Link (when no freelancer yet) ── */}
      {project.status === 'CREATED' && isClient && (
        <div className="mb-5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-yellow-400" />
            <p className="text-sm font-semibold text-yellow-300">Waiting for freelancer to accept</p>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Share this invite link with the freelancer you want to work with. Once they accept, you'll be able to fund the escrow.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 min-w-0">
              <Link2 className="h-4 w-4 text-slate-500 flex-shrink-0" />
              <span className="text-sm text-slate-300 truncate font-mono">
                {typeof window !== 'undefined' ? `${window.location.origin}/projects/${id}/join` : `/projects/${id}/join`}
              </span>
            </div>
            <button
              onClick={copyInviteLink}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 text-sm font-medium transition-colors flex-shrink-0"
            >
              {copiedLink ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}

      {/* ── Fund Escrow CTA (after freelancer joins, before funded) ── */}
      {project.status === 'AWAITING_FUNDING' && isClient && !project.contractId && (
        <div className="mb-5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-300">Freelancer has accepted — fund the escrow to begin</p>
          </div>
          <p className="text-sm text-slate-400">
            Click "Fund Escrow" in the header to lock {formatUSDC(project.budget)} in the smart contract. Work begins once funded.
          </p>
        </div>
      )}

      {project.status === 'CREATED' && !isClient && !isFreelancer && (
        <div className="mb-5 rounded-xl border border-blue-500/30 bg-blue-500/5 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-blue-300 mb-1">This project is looking for a freelancer</p>
              <p className="text-sm text-slate-400">Accept this project to start working. Payment is locked securely in escrow.</p>
            </div>
            <Link
              href={`/projects/${id}/join`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm transition-colors shadow-lg shadow-blue-500/20 flex-shrink-0"
            >
              <CheckCircle2 className="h-4 w-4" /> Accept & Join
            </Link>
          </div>
        </div>
      )}

      {project.status === 'FUNDED' && isFreelancer && (
        <div className="mb-5 rounded-xl border border-emerald-500/40 bg-emerald-500/8 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Lock className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-emerald-300">Escrow is funded — your action required!</p>
              <p className="text-sm text-slate-400">{formatUSDC(project.budget)} is locked in the smart contract</p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            The client has deposited the full project value into escrow. Click below to officially accept and start working on the milestones.
          </p>
          <button
            onClick={handleAccept}
            disabled={txLoading === 'accept'}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors shadow-lg shadow-emerald-500/25 disabled:opacity-50"
          >
            {txLoading === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {txLoading === 'accept' ? 'Signing transaction...' : 'Accept Project & Start Working'}
          </button>
        </div>
      )}

      {project.status === 'IN_PROGRESS' && isFreelancer && (() => {
        const pendingMilestones = project.milestones.filter(m => m.status === 'PENDING' || m.status === 'REJECTED');
        if (pendingMilestones.length === 0) return null;
        return (
          <div className="mb-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-blue-400" />
              <p className="font-semibold text-blue-300">
                {pendingMilestones.length} milestone{pendingMilestones.length > 1 ? 's' : ''} waiting for your submission
              </p>
            </div>
            <div className="space-y-2">
              {pendingMilestones.map((m, i) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      m.status === 'REJECTED' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{m.title}</p>
                      {m.status === 'REJECTED' && (
                        <p className="text-xs text-orange-400">Changes requested — resubmit required</p>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/projects/${id}/milestones/${m.id}/submit`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                  >
                    <FileText className="h-3 w-3" />
                    {m.status === 'REJECTED' ? 'Resubmit' : 'Submit Work'}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {isClient && (() => {
        const toReview = project.milestones.filter(m => m.status === 'SUBMITTED');
        if (toReview.length === 0) return null;
        return (
          <div className="mb-5 rounded-xl border border-purple-500/30 bg-purple-500/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-purple-400" />
              <p className="font-semibold text-purple-300">
                {toReview.length} milestone{toReview.length > 1 ? 's' : ''} submitted — your review needed
              </p>
            </div>
            <p className="text-sm text-slate-400 mb-3">
              Freelancer has submitted work. Review it below and approve to release payment, or request changes.
            </p>
            <div className="flex flex-wrap gap-2">
              {toReview.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveTab('milestones');
                    setTimeout(() => {
                      document.getElementById(`milestone-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 text-sm font-medium transition-colors"
                >
                  Review: {m.title} <ChevronRight className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Dispute Banner ── */}
      {project.dispute && (
        <div className={`mb-5 rounded-xl border p-5 ${
          project.status === 'RESOLVED'
            ? 'bg-teal-500/5 border-teal-500/20'
            : 'bg-red-500/5 border-red-500/20'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <Scale className={`h-5 w-5 ${project.status === 'RESOLVED' ? 'text-teal-400' : 'text-red-400'}`} />
            <h3 className={`font-semibold ${project.status === 'RESOLVED' ? 'text-teal-300' : 'text-red-300'}`}>
              {project.status === 'RESOLVED' ? 'Dispute Resolved' : 'Dispute In Progress'}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              project.status === 'RESOLVED'
                ? 'text-teal-400 bg-teal-400/10 border-teal-400/30'
                : 'text-red-400 bg-red-400/10 border-red-400/30'
            }`}>
              {project.dispute.status}
            </span>
          </div>
          <p className="text-sm font-medium text-white mb-1">{project.dispute.reason}</p>
          <p className="text-sm text-slate-400">{project.dispute.description}</p>

          {project.dispute.resolution && (
            <div className="mt-3 pt-3 border-t border-white/10 text-sm">
              <span className="text-slate-400">Resolution: </span>
              <span className="text-white font-medium">
                {project.dispute.resolution === 'FULL_CLIENT_REFUND'       && 'Full refund to client'}
                {project.dispute.resolution === 'FULL_FREELANCER_PAYMENT'  && 'Full payment to freelancer'}
                {project.dispute.resolution === 'PARTIAL_SPLIT' && project.dispute.clientBps != null &&
                  `Split — Client ${(project.dispute.clientBps / 100).toFixed(0)}% / Freelancer ${(100 - project.dispute.clientBps / 100).toFixed(0)}%`}
              </span>
            </div>
          )}

          {isArbitrator && project.status === 'DISPUTED' && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-sm font-semibold text-white mb-3">Execute Resolution</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {([
                  { value: 'FULL_CLIENT_REFUND',      label: 'Full Refund\nto Client',      accent: 'blue'  },
                  { value: 'PARTIAL_SPLIT',            label: 'Custom\nSplit',               accent: 'yellow'},
                  { value: 'FULL_FREELANCER_PAYMENT',  label: 'Full Payment\nto Freelancer', accent: 'green' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setResolution(opt.value)}
                    className={`p-3 rounded-xl border text-xs font-medium text-center transition-all whitespace-pre-line leading-tight ${
                      resolution === opt.value
                        ? opt.accent === 'blue'   ? 'border-blue-500/50 text-blue-300 bg-blue-500/10' :
                          opt.accent === 'yellow' ? 'border-yellow-500/50 text-yellow-300 bg-yellow-500/10' :
                                                    'border-emerald-500/50 text-emerald-300 bg-emerald-500/10'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {resolution === 'PARTIAL_SPLIT' && (
                <div className="mb-3 p-3 bg-slate-800/50 rounded-xl">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>Client: <span className="text-white font-medium">{(clientBps / 100).toFixed(0)}%</span></span>
                    <span>Freelancer: <span className="text-white font-medium">{(100 - clientBps / 100).toFixed(0)}%</span></span>
                  </div>
                  <input
                    type="range"
                    min="0" max="10000" step="500"
                    value={clientBps}
                    onChange={e => setClientBps(Number(e.target.value))}
                    className="w-full accent-yellow-400"
                  />
                </div>
              )}

              <button
                onClick={handleResolveDispute}
                disabled={resolving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
                {resolving ? 'Signing transaction...' : 'Execute Resolution On-Chain'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex border-b border-slate-800 mb-5">
        {(['milestones', 'messages', 'details'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab === 'messages'
              ? `Messages${messages.length > 0 ? ` (${messages.length})` : ''}`
              : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Milestones Tab ── */}
      {activeTab === 'milestones' && (
        <div ref={milestonesRef} className="space-y-3">
          {project.milestones.map((milestone, index) => {
            const msInfo = MILESTONE_STATUS_LABELS[milestone.status] || {
              label: milestone.status, color: 'text-slate-400 bg-slate-400/10 border-slate-400/30',
            };
            const approved   = milestone.status === 'APPROVED';
            const submitted  = milestone.status === 'SUBMITTED';
            const rejected   = milestone.status === 'REJECTED';
            const approvable = isClient && submitted && project.status === 'IN_PROGRESS';

            return (
              <div
                key={milestone.id}
                id={`milestone-${milestone.id}`}
                className={`bg-slate-900 border rounded-xl p-5 transition-colors ${
                  approved  ? 'border-emerald-500/30 bg-emerald-500/5' :
                  submitted ? 'border-purple-500/30 bg-purple-500/5'  :
                  rejected  ? 'border-orange-500/30'                  :
                  'border-slate-800'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold mt-0.5 ${
                    approved  ? 'bg-emerald-500/20 text-emerald-400' :
                    submitted ? 'bg-purple-500/20 text-purple-400'  :
                    rejected  ? 'bg-orange-500/20 text-orange-400'  :
                    'bg-slate-800 text-slate-500'
                  }`}>
                    {approved ? <CheckCircle className="h-4 w-4" /> : index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-semibold text-white">{milestone.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${msInfo.color}`}>
                        {msInfo.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{milestone.description}</p>

                    {milestone.dueDate && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                        <Clock className="h-3 w-3" /> Due {formatDate(milestone.dueDate)}
                      </p>
                    )}

                    {rejected && (
                      <div className="mt-2 p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                        <p className="text-xs text-orange-300 font-medium mb-1">
                          Changes requested — you can resubmit at any time
                        </p>
                        {milestone.rejectionFeedback && (
                          <p className="text-xs text-orange-200 leading-relaxed">
                            {milestone.rejectionFeedback}
                          </p>
                        )}
                      </div>
                    )}

                    {approved && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                        <Unlock className="h-3 w-3" />
                        Payment released on-chain
                      </div>
                    )}

                    {submitted && (
                      <div className="mt-3 p-4 bg-slate-800/70 rounded-xl border border-purple-500/25">
                        <p className="text-purple-300 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <FileText className="h-3 w-3" /> Freelancer&apos;s Submission
                        </p>
                        {!milestone.submission ? (
                          <p className="text-slate-500 text-xs italic">
                            Work submitted on-chain — freelancer did not add extra details (GitHub, deployment, notes).
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            {milestone.submission.githubUrl && (
                              <a
                                href={milestone.submission.githubUrl}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                              >
                                <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">GitHub Repository</span>
                                <span className="text-slate-500 text-xs truncate ml-auto hidden sm:block">{milestone.submission.githubUrl}</span>
                              </a>
                            )}
                            {milestone.submission.notes && (
                              <div className="px-3 py-2.5 bg-slate-700/40 rounded-lg">
                                <p className="text-slate-400 text-xs font-medium mb-1">Notes from freelancer</p>
                                <p className="text-slate-300 text-sm leading-relaxed">{milestone.submission.notes}</p>
                              </div>
                            )}
                            {!milestone.submission.githubUrl && !milestone.submission.notes && (
                              <p className="text-slate-500 text-xs italic">
                                Submission record exists but no details were added.
                              </p>
                            )}
                            {milestone.submission.files_meta?.length > 0 && (
                              <div className="space-y-1 pt-2 border-t border-slate-700/50">
                                <p className="text-slate-400 text-xs font-medium mb-1.5">Attached files</p>
                                {milestone.submission.files_meta.map((f: any) => (
                                  <a
                                    key={f.id}
                                    href={f.fileUrl}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white text-sm transition-colors"
                                  >
                                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                                    {f.fileName}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="font-bold text-white text-lg">{formatUSDC(milestone.amount)}</p>

                    <div className="mt-3 flex flex-col gap-2">
                      {approvable && (
                        <>
                          <button
                            onClick={() => handleApproveMilestone(milestone.id)}
                            disabled={!!txLoading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium disabled:opacity-50 transition-colors whitespace-nowrap shadow-md shadow-emerald-500/20"
                          >
                            {txLoading === `approve-${milestone.id}`
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <CheckCircle className="h-3 w-3" />
                            }
                            Approve & Release
                          </button>
                          <button
                            onClick={() => setRejectMilestoneId(milestone.id)}
                            disabled={!!txLoading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 text-xs font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            <XCircle className="h-3 w-3" />
                            Request Changes
                          </button>
                        </>
                      )}
                      {isFreelancer && (milestone.status === 'PENDING' || rejected) && project.status === 'IN_PROGRESS' && (
                        <Link
                          href={`/projects/${project.id}/milestones/${milestone.id}/submit`}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium whitespace-nowrap transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          {rejected ? 'Resubmit' : 'Submit Work'}
                        </Link>
                      )}
                      {isFreelancer && submitted && !milestone.submission && project.status === 'IN_PROGRESS' && (
                        <Link
                          href={`/projects/${project.id}/milestones/${milestone.id}/submit`}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium whitespace-nowrap transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          Add Details
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {project.milestones.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm">
              No milestones found for this project.
            </div>
          )}
        </div>
      )}

      {/* ── Messages Tab ── */}
      {activeTab === 'messages' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col" style={{ height: '30rem' }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <MessageSquare className="h-10 w-10 text-slate-700" />
                <p className="text-slate-500 text-sm">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              <>
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                      msg.senderId === user?.id
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                    }`}>
                      {msg.senderId !== user?.id && (
                        <p className="text-xs text-slate-400 mb-1 font-medium">
                          {msg.sender?.displayName || shortenAddress(msg.sender?.walletAddress || '')}
                        </p>
                      )}
                      <p className="leading-relaxed">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.senderId === user?.id ? 'text-blue-200' : 'text-slate-500'}`}>
                        {formatDateTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          <div className="p-4 border-t border-slate-800 flex gap-2">
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Type a message… (Enter to send)"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-40 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* ── Details Tab ── */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide text-slate-400">Description</h3>
            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{project.description}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide text-slate-400">Participants</h3>
            <div className="space-y-0 divide-y divide-slate-800">
              {[
                { label: 'Client',     person: project.client,     accent: 'blue'   },
                { label: 'Freelancer', person: project.freelancer, accent: 'green'  },
                { label: 'Arbitrator', person: project.arbitrator, accent: 'purple' },
              ].filter(p => p.person).map(({ label, person, accent }) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      accent === 'blue'   ? 'bg-blue-500/20 text-blue-400' :
                      accent === 'green'  ? 'bg-emerald-500/20 text-emerald-400' :
                                           'bg-purple-500/20 text-purple-400'
                    }`}>
                      {person?.displayName?.[0]?.toUpperCase() || label[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {person?.displayName || 'Anonymous'}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {shortenAddress(person?.walletAddress || '', 8)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md capitalize">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {project.txHash && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Creation Transaction</p>
                <a
                  href={`${explorerBase}/tx/${project.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                >
                  <ExternalLink className="h-3 w-3" /> View on Explorer
                </a>
              </div>
              <p className="font-mono text-xs text-slate-500 break-all">{project.txHash}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
