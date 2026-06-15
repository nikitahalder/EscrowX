'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { Upload, Github, FileText, Loader2, ArrowLeft, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { milestonesApi, submissionsApi, projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { signTransactionWithFreighter, getNetworkPassphrase } from '@/lib/wallet';
import Link from 'next/link';

interface SubmitFormData {
  githubUrl?: string;
  notes?: string;
}

const ALLOWED_TYPES = ['application/pdf', 'application/zip', 'application/x-zip-compressed', 'image/png', 'image/jpeg', 'video/mp4', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export default function SubmitMilestonePage() {
  const { id: projectId, milestoneId } = useParams<{ id: string; milestoneId: string }>();
  const router = useRouter();
  const { walletProvider, user } = useAuthStore();
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'signing' | 'uploading' | 'done'>('form');

  const { register, handleSubmit } = useForm<SubmitFormData>();

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => [...prev, ...accepted].slice(0, 10));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/zip': ['.zip'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'video/mp4': ['.mp4'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 50 * 1024 * 1024,
  });

  async function onSubmit(data: SubmitFormData) {
    setSubmitting(true);
    setStep('signing');

    try {
      // 1. Build submit milestone transaction
      const result = await milestonesApi.buildSubmitTx(milestoneId) as any;

      if (!result.offChain) {
        // 2. Sign with wallet
        const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
        const passphrase = getNetworkPassphrase(network);
        const signedXdr = await signTransactionWithFreighter(result.txXdr, passphrase, user?.walletAddress);

        // 3. Submit to Stellar
        const { txHash } = await projectsApi.submitSignedTx(signedXdr);

        // 4. Confirm on-chain
        await milestonesApi.confirmSubmit(milestoneId, txHash, result.proofHash);
      }
      // offChain: DB already updated (or milestone was already SUBMITTED), skip signing

      setStep('uploading');
      // If no links, files, or notes were provided, skip the metadata API call
      const hasContent = data.githubUrl || data.notes || files.length > 0;
      if (!hasContent) {
        setStep('done');
        router.push(`/projects/${projectId}`);
        return;
      }

      // 5. Upload files and metadata
      const formData = new FormData();
      if (data.githubUrl) formData.append('githubUrl', data.githubUrl);
      if (data.notes) formData.append('notes', data.notes);
      files.forEach(file => formData.append('files', file));
      // Do NOT set Content-Type manually — the browser must set it with the multipart boundary
      await submissionsApi.create(milestoneId, formData);

      setStep('done');
      router.push(`/projects/${projectId}`);
    } catch (e: any) {
      console.error(e);
      alert(e.message || e.error || 'Submission failed');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  }

  const stepLabels = {
    form: 'Submit Deliverables',
    signing: 'Sign transaction in wallet...',
    uploading: 'Uploading files...',
    done: 'Done!',
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/projects/${projectId}`} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Project
        </Link>
        <h1 className="text-2xl font-bold text-white">Submit Milestone Deliverables</h1>
        <p className="text-slate-400 mt-1">Provide proof of work. This will be recorded on-chain.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-white">Deliverable Links</h2>

          <div>
            <label className="block text-sm text-slate-400 mb-1 flex items-center gap-2">
              <Github className="h-4 w-4" /> GitHub Repository URL
            </label>
            <input
              {...register('githubUrl')}
              type="url"
              placeholder="https://github.com/..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Notes</label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Describe what was completed, any known issues, testing instructions..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {/* File Upload */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5" /> File Attachments
          </h2>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-500/5' : 'border-slate-700 hover:border-slate-500'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">Drop files here or click to select</p>
            <p className="text-slate-500 text-sm mt-1">PDF, ZIP, PNG, JPG, MP4, DOCX — Max 50MB each, up to 10 files</p>
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-white">{file.name}</span>
                    <span className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                  </div>
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
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {stepLabels[step]}
            </>
          ) : (
            'Submit Milestone'
          )}
        </button>
      </form>
    </div>
  );
}
