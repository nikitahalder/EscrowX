'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Wallet, Loader2,
  CheckCircle2, Circle, AlertCircle, ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import { connectFreighter, signTransactionWithFreighter, getNetworkPassphrase } from '@/lib/wallet';

type Step = 'idle' | 'detecting' | 'challenge' | 'signing' | 'verifying' | 'done' | 'error';

const STEP_META: { step: Step; label: string }[] = [
  { step: 'detecting',  label: 'Detecting Freighter wallet…' },
  { step: 'challenge',  label: 'Requesting authentication challenge…' },
  { step: 'signing',    label: 'Sign in Freighter popup (approve when asked)…' },
  { step: 'verifying',  label: 'Verifying with server…' },
];

function StepStatus({ current, error }: { current: Step; error: string }) {
  const currentIdx = STEP_META.findIndex((m) => m.step === current);

  return (
    <div className="mt-4 space-y-2">
      {STEP_META.map(({ step, label }, idx) => {
        const done = current === 'done' || currentIdx > idx;
        const active = currentIdx === idx;
        return (
          <div key={step} className="flex items-center gap-3 text-sm">
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            ) : active ? (
              <Loader2 className="h-4 w-4 text-blue-400 animate-spin flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-slate-700 flex-shrink-0" />
            )}
            <span className={done ? 'text-emerald-400' : active ? 'text-blue-300' : 'text-slate-600'}>
              {label}
            </span>
          </div>
        );
      })}

      {error && (
        <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-300 text-xs leading-relaxed">{error}</p>
        </div>
      )}
    </div>
  );
}

export default function ConnectPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');

  async function handleFreighterConnect() {
    setError('');
    setStep('detecting');

    try {
      const conn = await connectFreighter();

      setStep('challenge');
      const { challenge, xdr } = await authApi.getChallenge(conn.publicKey);

      setStep('signing');
      const networkPassphrase = getNetworkPassphrase(
        process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet',
      );
      const signedXdr = await signTransactionWithFreighter(xdr, networkPassphrase, conn.publicKey);

      setStep('verifying');
      const { access_token, user } = await authApi.verify(conn.publicKey, challenge, signedXdr);

      setStep('done');
      setAuth(user, access_token, 'freighter');
      setTimeout(() => router.push('/dashboard'), 400);
    } catch (e: any) {
      setError(e.message || 'Connection failed. Please try again.');
      setStep('error');
    }
  }

  const isConnecting = !['idle', 'error'].includes(step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Shield className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Connect to EscrowX</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Connect your Stellar wallet to access the platform. No password required.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <button
            onClick={handleFreighterConnect}
            disabled={isConnecting}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/20 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-white group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-left">
                <div className="font-semibold flex items-center gap-2">
                  Freighter
                  {step === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                </div>
                <div className="text-xs text-slate-400">Official Stellar wallet browser extension</div>
              </div>
            </div>
            {isConnecting ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            ) : (
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
            )}
          </button>

          {(isConnecting || step === 'error') && (
            <StepStatus current={step} error={error} />
          )}

          <p className="text-center text-xs text-slate-500 pt-1">
            Don&apos;t have Freighter?{' '}
            <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              Install it free
            </a>
          </p>
        </div>

        <div className="mt-5 p-4 rounded-xl border border-white/10 bg-white/5 text-sm">
          <p className="font-medium text-slate-300 mb-2">What happens when you connect:</p>
          <ol className="space-y-1.5 text-slate-400 text-xs">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold flex-shrink-0">1.</span>
              Freighter asks permission to connect — click <strong className="text-slate-300">Connect</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold flex-shrink-0">2.</span>
              Freighter shows a transaction to sign — click <strong className="text-slate-300">Approve</strong> (auth-only, nothing is sent on-chain)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold flex-shrink-0">3.</span>
              You&apos;re signed in — no password, no email, no private key exposure
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
