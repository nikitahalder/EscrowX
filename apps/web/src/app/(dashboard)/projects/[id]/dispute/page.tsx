'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, Upload, X, Loader2, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { disputesApi, projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { signTransactionWithFreighter, getNetworkPassphrase } from '@/lib/wallet';
import Link from 'next/link';

const schema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
});

export default function RaiseDisputePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { walletProvider, user } = useAuthStore();
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => setFiles(prev => [...prev, ...accepted].slice(0, 5)),
    maxSize: 50 * 1024 * 1024,
  });

  async function onSubmit(data: any) {
    setSubmitting(true);
    try {
      // 1. Build dispute transaction
      const { txXdr } = await disputesApi.buildRaiseTx(projectId, data) as any;

      // 2. Sign with wallet
      const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
      const passphrase = getNetworkPassphrase(network);
      const signedXdr = await signTransactionWithFreighter(txXdr, passphrase, user?.walletAddress);

      // 3. Submit tx
      const { txHash } = await projectsApi.submitSignedTx(signedXdr);

      // 4. Confirm dispute with evidence
      const formData = new FormData();
      formData.append('reason', data.reason);
      formData.append('description', data.description);
      formData.append('txHash', txHash);
      files.forEach(file => formData.append('evidence', file));

      await disputesApi.confirmRaise(projectId, formData);

      router.push(`/projects/${projectId}`);
    } catch (e: any) {
      alert(e.message || 'Failed to raise dispute');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/projects/${projectId}`} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Project
        </Link>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-400" />
          <h1 className="text-2xl font-bold text-white">Raise Dispute</h1>
        </div>
        <p className="text-slate-400 mt-1">
          Raise a dispute to freeze funds and request arbitrator review.
          Only use this if direct communication has failed.
        </p>
      </div>

      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6">
        <p className="text-red-300 text-sm">
          <strong>Warning:</strong> Raising a dispute freezes all remaining project funds.
          The arbitrator&apos;s decision is final and will be executed on-chain.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Reason (summary)</label>
            <input
              {...register('reason')}
              placeholder="e.g., Freelancer submitted incomplete work"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
            {errors.reason && <p className="text-red-400 text-xs mt-1">{errors.reason.message as string}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Detailed Description</label>
            <textarea
              {...register('description')}
              rows={5}
              placeholder="Describe the issue in detail. Include what was agreed upon and what was not delivered..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none"
            />
            {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description.message as string}</p>}
          </div>
        </div>

        {/* Evidence Upload */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">Evidence Files (Optional)</h2>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-red-500 bg-red-500/5' : 'border-slate-700 hover:border-slate-500'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-300 text-sm">Drop evidence files here</p>
            <p className="text-slate-500 text-xs mt-1">Screenshots, contracts, communications — up to 5 files</p>
          </div>
          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-slate-800 rounded-lg text-sm">
                  <span className="text-white">{f.name}</span>
                  <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4 text-slate-500 hover:text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <AlertTriangle className="h-5 w-5" />}
          {submitting ? 'Raising Dispute...' : 'Raise Dispute & Sign Transaction'}
        </button>
      </form>
    </div>
  );
}
