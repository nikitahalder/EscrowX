'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Scale, Clock } from 'lucide-react';
import { disputesApi } from '@/lib/api';
import { formatDate, shortenAddress } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { Dispute } from '@/types';

export default function DisputesPage() {
  const { user } = useAuthStore();
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'ARBITRATOR' || user?.role === 'ADMIN') {
      disputesApi.getMyDisputes().then((d: any) => setDisputes(d)).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const STATUS_COLORS: Record<string, string> = {
    OPEN: 'text-red-400 bg-red-400/10 border-red-400/30',
    UNDER_REVIEW: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
    RESOLVED: 'text-green-400 bg-green-400/10 border-green-400/30',
  };

  if (user?.role !== 'ARBITRATOR' && user?.role !== 'ADMIN') {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Scale className="h-12 w-12 text-slate-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">Disputes Dashboard</h1>
        <p className="text-slate-400">
          This section is for arbitrators. To raise a dispute on a project, go to the project page and click "Raise Dispute".
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Scale className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-bold text-white">Disputes Assigned to Me</h1>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading disputes...</div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 rounded-xl border border-slate-800">
          <AlertTriangle className="h-10 w-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No open disputes assigned to you</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute: any) => (
            <Link
              key={dispute.id}
              href={`/projects/${dispute.projectId}`}
              className="block bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-white">{dispute.project?.title}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[dispute.status] || 'text-slate-400 bg-slate-400/10 border-slate-400/30'}`}>
                      {dispute.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">{dispute.reason}</p>
                  <div className="flex items-center gap-6 text-sm text-slate-500">
                    <span>Client: {shortenAddress(dispute.project?.client?.walletAddress || '')}</span>
                    <span>Freelancer: {shortenAddress(dispute.project?.freelancer?.walletAddress || '')}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatDate(dispute.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
