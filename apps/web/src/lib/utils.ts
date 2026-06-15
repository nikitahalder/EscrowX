import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSDC(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return '0.00 USDC';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }).format(n) + ' USDC';
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function shortenAddress(address: string, chars = 6): string {
  if (!address || address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-4)}`;
}

export const PROJECT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  CREATED:             { label: 'Created',         color: 'text-slate-400 bg-slate-400/10 border-slate-400/30' },
  AWAITING_FUNDING:    { label: 'Awaiting Funding', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  FUNDED:              { label: 'Funded',           color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  FREELANCER_ACCEPTED: { label: 'Accepted',         color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' },
  IN_PROGRESS:         { label: 'In Progress',      color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  SUBMITTED:        { label: 'Submitted',        color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
  UNDER_REVIEW:     { label: 'Under Review',     color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
  COMPLETED:        { label: 'Completed',        color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  DISPUTED:         { label: 'Disputed',         color: 'text-red-400 bg-red-400/10 border-red-400/30' },
  RESOLVED:         { label: 'Resolved',         color: 'text-teal-400 bg-teal-400/10 border-teal-400/30' },
  CANCELLED:        { label: 'Cancelled',        color: 'text-slate-500 bg-slate-500/10 border-slate-500/30' },
};

export const MILESTONE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:     { label: 'Pending',     color: 'text-slate-400 bg-slate-400/10 border-slate-400/30' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  SUBMITTED:   { label: 'Submitted',   color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
  APPROVED:    { label: 'Approved',    color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  REJECTED:    { label: 'Changes Requested', color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
  DISPUTED:    { label: 'Disputed',    color: 'text-red-400 bg-red-400/10 border-red-400/30' },
};
