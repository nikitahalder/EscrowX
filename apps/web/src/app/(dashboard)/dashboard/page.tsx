'use client';

import { useEffect, useState } from 'react';
import { FolderKanban, CheckCircle, Clock, AlertTriangle, DollarSign } from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatUSDC, PROJECT_STATUS_LABELS } from '@/lib/utils';
import Link from 'next/link';
import type { Project } from '@/types';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const [freelancerProjects, setFreelancerProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      projectsApi.list('client') as unknown as Promise<Project[]>,
      projectsApi.list('freelancer') as unknown as Promise<Project[]>,
    ]).then(([cp, fp]) => {
      setClientProjects(cp);
      setFreelancerProjects(fp);
    }).finally(() => setLoading(false));
  }, []);

  const allProjects = [...clientProjects, ...freelancerProjects];
  const activeCount = allProjects.filter(p => ['FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW'].includes(p.status)).length;
  const completedCount = allProjects.filter(p => p.status === 'COMPLETED').length;
  const disputedCount = allProjects.filter(p => p.status === 'DISPUTED').length;
  const totalVolume = allProjects
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + Number(p.budget), 0);

  const stats = [
    { label: 'Active Projects', value: activeCount, icon: Clock, color: 'text-blue-400' },
    { label: 'Completed', value: completedCount, icon: CheckCircle, color: 'text-green-400' },
    { label: 'Disputed', value: disputedCount, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Volume', value: formatUSDC(totalVolume), icon: DollarSign, color: 'text-yellow-400' },
  ];

  const recentProjects = allProjects.slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.displayName || `${user?.walletAddress.slice(0, 8)}...`}
        </h1>
        <p className="text-slate-400 mt-1">Here&apos;s your escrow overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">{stat.label}</span>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-blue-400" />
            Recent Projects
          </h2>
          <Link href="/projects" className="text-sm text-blue-400 hover:text-blue-300">
            View all
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : recentProjects.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 mb-4">No projects yet</p>
            <Link
              href="/projects/new"
              className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium"
            >
              Create your first project
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentProjects.map((project) => {
              const statusInfo = PROJECT_STATUS_LABELS[project.status] || { label: project.status, color: 'text-slate-400 bg-slate-400/10 border-slate-400/30' };
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-white">{project.title}</p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {formatUSDC(project.budget)} · {project.milestones?.length ?? 0} milestones
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
