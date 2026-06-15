'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3, Users, FolderKanban, Scale, TrendingUp, Loader2,
  Shield, UserCheck, ChevronRight, Search,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatUSDC, formatDate, shortenAddress } from '@/lib/utils';
import Link from 'next/link';

export default function AdminPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'disputes'>('overview');

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return;
    Promise.all([
      adminApi.getStats(),
      adminApi.getUsers(1),
      adminApi.getDisputes(),
    ]).then(([s, u, d]: any[]) => {
      setStats(s);
      setUsers(Array.isArray(u) ? u : u?.users || []);
      setDisputes(Array.isArray(d) ? d : d?.disputes || []);
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Projects', value: stats?.totalProjects ?? 0, icon: FolderKanban, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Active Projects', value: stats?.activeProjects ?? 0, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Open Disputes', value: stats?.disputedProjects ?? 0, icon: Scale, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Completed', value: stats?.completedProjects ?? 0, icon: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Escrow Volume', value: formatUSDC(stats?.escrowVolume ?? 0), icon: TrendingUp, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ];

  const filteredUsers = users.filter(u =>
    userSearch
      ? (u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
         u.walletAddress?.toLowerCase().includes(userSearch.toLowerCase()))
      : true
  );

  const DISPUTE_COLORS: Record<string, string> = {
    OPEN: 'text-red-400 bg-red-400/10 border-red-400/30',
    UNDER_REVIEW: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
    RESOLVED: 'text-green-400 bg-green-400/10 border-green-400/30',
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-7 w-7 text-purple-400" />
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">{card.label}</span>
              <div className={`p-1.5 rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Platform Health */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-white mb-3">Platform Health</h2>
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-slate-400">Dispute Rate: <span className="text-white">{stats?.disputeRate ?? '0'}%</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-slate-400">Network: <span className="text-white capitalize">{process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet'}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-slate-400">Contract: <span className="text-white font-mono text-xs">{(process.env.NEXT_PUBLIC_USDC_CONTRACT_ID || '').slice(0, 12)}...</span></span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-5">
        {(['overview', 'users', 'disputes'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab}{tab === 'users' ? ` (${users.length})` : tab === 'disputes' ? ` (${disputes.length})` : ''}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4">Open Disputes</h3>
            {disputes.filter(d => d.status === 'OPEN').length === 0 ? (
              <p className="text-slate-500 text-sm">No open disputes — platform is healthy</p>
            ) : (
              <div className="space-y-3">
                {disputes.filter(d => d.status === 'OPEN').slice(0, 5).map((d: any) => (
                  <Link
                    key={d.id}
                    href={`/projects/${d.projectId}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{d.project?.title || 'Untitled Project'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{d.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${DISPUTE_COLORS[d.status] || ''}`}>
                        {d.status}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Search by name or wallet..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="space-y-2">
            {filteredUsers.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                    {u.displayName?.[0]?.toUpperCase() || u.walletAddress?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{u.displayName || 'Anonymous'}</p>
                    <p className="text-xs text-slate-500 font-mono">{shortenAddress(u.walletAddress || '', 8)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{u.completedProjects ?? 0} projects</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    u.role === 'ADMIN' ? 'text-purple-400 bg-purple-400/10 border-purple-400/30' :
                    u.role === 'ARBITRATOR' ? 'text-orange-400 bg-orange-400/10 border-orange-400/30' :
                    'text-slate-400 bg-slate-400/10 border-slate-400/30'
                  }`}>
                    {u.role?.toLowerCase()}
                  </span>
                  {u.role !== 'ARBITRATOR' && u.role !== 'ADMIN' && (
                    <button
                      onClick={() => adminApi.setArbitrator(u.id).then(() =>
                        setUsers(prev => prev.map(p => p.id === u.id ? { ...p, role: 'ARBITRATOR' } : p))
                      )}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-orange-400 border border-orange-400/30 hover:bg-orange-400/10 transition-colors"
                    >
                      <UserCheck className="h-3 w-3" />
                      Make Arbitrator
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disputes Tab */}
      {activeTab === 'disputes' && (
        <div className="space-y-3">
          {disputes.length === 0 ? (
            <div className="text-center py-10 bg-slate-900 rounded-xl border border-slate-800">
              <Scale className="h-10 w-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">No disputes found</p>
            </div>
          ) : (
            disputes.map((d: any) => (
              <Link
                key={d.id}
                href={`/projects/${d.projectId}`}
                className="block bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white truncate">{d.project?.title || 'Untitled'}</h3>
                      <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium border ${DISPUTE_COLORS[d.status] || 'text-slate-400 bg-slate-400/10 border-slate-400/30'}`}>
                        {d.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{d.reason}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Raised by: {shortenAddress(d.raisedBy?.walletAddress || '')}</span>
                      <span>{formatDate(d.createdAt)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-600 flex-shrink-0 mt-1" />
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
