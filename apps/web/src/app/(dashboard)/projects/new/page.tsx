'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2, ArrowLeft, Link2, Copy, CheckCircle2, ArrowRight } from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { signTransactionWithFreighter, getNetworkPassphrase } from '@/lib/wallet';
import Link from 'next/link';

const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  milestones: z.array(z.object({
    title: z.string().min(2, 'Milestone title required'),
    description: z.string().min(5, 'Description required'),
    amount: z.number().positive('Amount must be positive'),
    dueDate: z.string().optional(),
  })).min(1, 'At least one milestone required'),
});

type FormData = z.infer<typeof schema>;

export default function NewProjectPage() {
  const router = useRouter();
  const { walletProvider, user } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'signing' | 'done'>('form');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { milestones: [{ title: '', description: '', amount: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'milestones' });
  const milestones = watch('milestones');
  const totalBudget = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setStep('signing');
    try {
      const payload = { ...data };

      const { project, txXdr } = await projectsApi.create(payload) as any;
      setCreatedProjectId(project.id);

      if (txXdr) {
        const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
        const networkPassphrase = getNetworkPassphrase(network);
        let signedXdr: string;

        if (walletProvider === 'freighter') {
          signedXdr = await signTransactionWithFreighter(txXdr, networkPassphrase, user?.walletAddress);
        } else {
          throw new Error('Wallet provider not available');
        }

        const { txHash } = await projectsApi.submitSignedTx(signedXdr);
        await projectsApi.confirmCreation(project.id, txHash);
        setStep('done');
        router.push(`/projects/${project.id}`);
      } else {
        const link = `${window.location.origin}/projects/${project.id}/join`;
        setInviteLink(link);
        setStep('done');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to create project');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  }

  if (inviteLink && createdProjectId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Project Created!</h2>
          <p className="text-slate-400 mb-8">
            Share this invite link with your freelancer. Once they accept, you'll be asked to fund the escrow.
          </p>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
            <p className="text-xs text-slate-500 mb-2 text-left font-medium uppercase tracking-wide">Freelancer Invite Link</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 min-w-0">
                <Link2 className="h-4 w-4 text-slate-500 flex-shrink-0" />
                <span className="text-sm text-slate-300 truncate font-mono">{inviteLink}</span>
              </div>
              <button
                onClick={copyLink}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors flex-shrink-0"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="text-left bg-slate-800/50 rounded-xl p-5 mb-6 space-y-3">
            <p className="text-sm font-semibold text-slate-300 mb-3">What happens next:</p>
            {[
              'Send this link to your freelancer',
              'They connect their Stellar wallet and accept the terms',
              'You fund the escrow — money is locked on-chain',
              'Freelancer delivers work milestone by milestone',
              'You approve each milestone to release payment',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-400">{step}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Link
              href={`/projects/${createdProjectId}`}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
            >
              View Project <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/projects"
              className="px-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm transition-colors"
            >
              All Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/projects" className="flex items-center gap-2 text-slate-400 hover:text-white mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Link>
        <h1 className="text-2xl font-bold text-white">Create New Transaction</h1>
        <p className="text-slate-400 mt-1">Define the work, set milestones, and invite your freelancer. Funds are held in escrow until work is approved.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-white text-lg">Transaction Details</h2>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
            <input
              {...register('title')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="e.g., E-commerce Website Development"
            />
            {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Describe the project requirements, deliverables, and expectations..."
            />
            {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description.message}</p>}
          </div>

        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white text-lg">Milestones</h2>
            <button
              type="button"
              onClick={() => append({ title: '', description: '', amount: 0 })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Add Milestone
            </button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-300">Milestone {index + 1}</span>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="p-1 text-red-400 hover:text-red-300">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        {...register(`milestones.${index}.title`)}
                        placeholder="Milestone title"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                      />
                      {errors.milestones?.[index]?.title && (
                        <p className="text-red-400 text-xs mt-1">{errors.milestones[index].title?.message}</p>
                      )}
                    </div>
                    <div>
                      <div className="relative">
                        <input
                          {...register(`milestones.${index}.amount`, { valueAsNumber: true })}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Amount"
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-3 pr-16 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">USDC</span>
                      </div>
                    </div>
                  </div>
                  <input
                    {...register(`milestones.${index}.description`)}
                    placeholder="What needs to be delivered for this milestone?"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                  />
                  <input
                    {...register(`milestones.${index}.dueDate`)}
                    type="date"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between text-sm">
            <span className="text-slate-400">Total Budget</span>
            <span className="font-semibold text-white">{totalBudget.toFixed(2)} USDC</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Platform fee: 1% deducted on fund release. Freelancer receives {((totalBudget * 0.99).toFixed(2))} USDC.</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {step === 'signing' ? 'Waiting for wallet signature...' : 'Creating...'}
            </>
          ) : (
            'Create Transaction'
          )}
        </button>
      </form>
    </div>
  );
}
