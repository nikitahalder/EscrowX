'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Shield, CheckCircle2, Loader2, AlertCircle, DollarSign,
  Target, Clock, ArrowRight, Wallet, Lock,
} from 'lucide-react';
import Link from 'next/link';
import { projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { connectFreighter, signTransactionWithFreighter, getNetworkPassphrase } from '@/lib/wallet';
import { authApi } from '@/lib/api';
import { formatUSDC, formatDate, shortenAddress } from '@/lib/utils';
import type { Project } from '@/types';

type Step = 'loading' | 'preview' | 'connecting' | 'joining' | 'done' | 'error' | 'already-joined';

export default function JoinProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated, setAuth } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    // Use public preview endpoint — no auth required, works for unauthenticated freelancers
    projectsApi.getPreview(id)
      .then((p: any) => {
        setProject(p);
        setStep('preview');
      })
      .catch(() => {
        // Project not found or no longer CREATED — try authenticated fetch to check status
        if (isAuthenticated) {
          projectsApi.getOne(id)
            .then((p: any) => {
              setProject(p);
              setStep(p.status !== 'CREATED' ? 'already-joined' : 'preview');
            })
            .catch(() => setStep('error'));
        } else {
          setStep('already-joined');
        }
      });
  }, [id, isAuthenticated]);

  async function handleAccept() {
    setError('');
    try {
      if (!isAuthenticated) {
        // Need to connect wallet first
        setStep('connecting');
        const conn = await connectFreighter();

        // Auth flow
        const { challenge, xdr } = await authApi.getChallenge(conn.publicKey);
        const networkPassphrase = getNetworkPassphrase(process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet');
        const signedXdr = await signTransactionWithFreighter(xdr, networkPassphrase, conn.publicKey);
        const { access_token, user: authUser } = await authApi.verify(conn.publicKey, challenge, signedXdr);
        setAuth(authUser, access_token, 'freighter');

        // Now join
        setStep('joining');
        await projectsApi.join(id);
      } else {
        setStep('joining');
        await projectsApi.join(id);
      }

      setStep('done');
      setTimeout(() => router.push(`/projects/${id}`), 1500);
    } catch (e: any) {
      setError(e.message || e.error || 'Failed to join project');
      setStep('error');
    }
  }

  const isClient = project && user && project.clientId === user.id;

  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">You've joined the project!</h2>
        <p className="text-slate-400 mb-4">The client will now fund the escrow. You'll be notified when it's ready.</p>
        <p className="text-slate-500 text-sm">Redirecting to project...</p>
      </div>
    );
  }

  if (step === 'already-joined') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
          <Shield className="h-8 w-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Project already has a freelancer</h2>
        <p className="text-slate-400 mb-6">This project is no longer open for new freelancers to join.</p>
        {isAuthenticated && (
          <Link href="/projects" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors">
            My Projects <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4">
          <Shield className="h-8 w-8 text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">You've been invited to a project</h1>
        <p className="text-slate-400 text-sm">Review the details below and accept to join. Payment is held securely in escrow.</p>
      </div>

      {/* Project Card */}
      {project ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-6">
          {/* Project Header */}
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white mb-2">{project.title}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{project.description}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 divide-x divide-slate-800">
            <div className="p-4 text-center">
              <DollarSign className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{formatUSDC(project.budget)}</p>
              <p className="text-xs text-slate-500">Total Value</p>
            </div>
            <div className="p-4 text-center">
              <Target className="h-4 w-4 text-blue-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{project.milestones?.length ?? 0}</p>
              <p className="text-xs text-slate-500">Milestones</p>
            </div>
            <div className="p-4 text-center">
              <Clock className="h-4 w-4 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{formatDate(project.createdAt)}</p>
              <p className="text-xs text-slate-500">Posted</p>
            </div>
          </div>

          {/* Milestones */}
          {project.milestones && project.milestones.length > 0 && (
            <div className="p-6 border-t border-slate-800">
              <p className="text-sm font-semibold text-slate-300 mb-3">Milestones</p>
              <div className="space-y-3">
                {project.milestones.map((m, i) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-400 text-xs flex items-center justify-center font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white">{m.title}</p>
                        {m.dueDate && (
                          <p className="text-xs text-slate-500">Due {formatDate(m.dueDate)}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">{formatUSDC(m.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Client info */}
          {project.client && (
            <div className="px-6 py-4 border-t border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                {project.client.displayName?.[0]?.toUpperCase() || 'C'}
              </div>
              <div>
                <p className="text-sm text-white font-medium">{project.client.displayName || 'Anonymous'}</p>
                <p className="text-xs text-slate-500 font-mono">{shortenAddress(project.client.walletAddress || '', 8)}</p>
              </div>
              <span className="ml-auto text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md">Client</span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center mb-6">
          <p className="text-slate-400">Loading project details...</p>
        </div>
      )}

      {/* What's protected */}
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-blue-400" />
          <p className="text-sm font-semibold text-blue-300">Your protections as a freelancer</p>
        </div>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            Funds are locked in a Stellar smart contract before you start work
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            Payment is released automatically on milestone approval — no chasing invoices
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            Disputes are resolved by a neutral arbitrator on-chain
          </li>
        </ul>
      </div>

      {/* Error */}
      {step === 'error' && error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 mb-4">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Action */}
      {isClient ? (
        <div className="text-center p-4 bg-slate-800 rounded-xl text-slate-400 text-sm">
          You created this project. Share the link with a freelancer to invite them.
        </div>
      ) : (
        <button
          onClick={handleAccept}
          disabled={['connecting', 'joining'].includes(step)}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg transition-all shadow-xl shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {step === 'connecting' ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Connecting wallet...</>
          ) : step === 'joining' ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Joining project...</>
          ) : (
            <>
              <Wallet className="h-5 w-5" />
              {isAuthenticated ? 'Accept & Join Project' : 'Connect Wallet & Accept'}
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      )}

      {!isAuthenticated && step !== 'connecting' && (
        <p className="text-center text-xs text-slate-500 mt-3">
          You'll be asked to connect your Freighter wallet to accept
        </p>
      )}
    </div>
  );
}
