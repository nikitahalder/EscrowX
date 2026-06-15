'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search, Globe, DollarSign, Target, Clock, ArrowRight,
  ArrowLeft, Briefcase, Users, CheckCircle2,
} from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatUSDC, formatDate } from '@/lib/utils';
import type { Project } from '@/types';

export default function BrowseProjectsPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    projectsApi.browse(page, 20).then((data: any) => {
      const list: Project[] = Array.isArray(data) ? data : data?.projects || [];
      setProjects(list);
      setHasMore(list.length === 20);
    }).catch(() => setProjects([])
    ).finally(() => setLoading(false));
  }, [page]);

  const filtered = projects.filter(p =>
    search
      ? p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase())
      : true
  );

  // Split: open (CREATED) vs already taken (AWAITING_FUNDING)
  const openProjects = filtered.filter(p => p.status === 'CREATED');
  const takenProjects = filtered.filter(p => p.status !== 'CREATED');

  const SkeletonCard = () => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
      <div className="h-5 bg-slate-800 rounded w-2/3 mb-3" />
      <div className="h-4 bg-slate-800 rounded w-full mb-2" />
      <div className="h-4 bg-slate-800 rounded w-3/4 mb-4" />
      <div className="flex gap-4">
        <div className="h-4 bg-slate-800 rounded w-24" />
        <div className="h-4 bg-slate-800 rounded w-20" />
      </div>
    </div>
  );

  const ProjectCard = ({ project }: { project: Project }) => {
    const isOpen = project.status === 'CREATED';
    const isMyProject = isAuthenticated && project.clientId === user?.id;
    const totalMilestones = project.milestones?.length ?? 0;
    const totalBudget = formatUSDC(project.budget);

    return (
      <div className={`bg-slate-900 border rounded-xl overflow-hidden transition-all group ${
        isOpen
          ? 'border-blue-500/20 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5'
          : 'border-slate-800 opacity-70'
      }`}>
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className={`font-semibold text-base leading-snug flex-1 ${isOpen ? 'text-white' : 'text-slate-400'}`}>
              {project.title}
            </h3>
            {isOpen ? (
              <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Open
              </span>
            ) : (
              <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-500 text-xs font-medium">
                Taken
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-slate-400 line-clamp-2 mb-4 leading-relaxed">
            {project.description}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-sm mb-4">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <DollarSign className="h-4 w-4" />
              {totalBudget}
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Target className="h-4 w-4" />
              {totalMilestones} milestone{totalMilestones !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="h-4 w-4" />
              {formatDate(project.createdAt)}
            </div>
          </div>

          {/* Client */}
          <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
              {project.client?.displayName?.[0]?.toUpperCase() || 'C'}
            </div>
            <span className="text-xs text-slate-500">
              {project.client?.displayName || 'Anonymous Client'}
            </span>
          </div>

          {/* Milestones preview */}
          {project.milestones && project.milestones.length > 0 && (
            <div className="pt-3 space-y-1.5">
              {project.milestones.slice(0, 3).map((m, i) => (
                <div key={m.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-slate-600 font-bold">{i + 1}</span>
                    {m.title}
                  </span>
                  <span className="text-slate-400 font-medium">{formatUSDC(m.amount)}</span>
                </div>
              ))}
              {project.milestones.length > 3 && (
                <p className="text-xs text-slate-600 pl-5">+{project.milestones.length - 3} more milestones</p>
              )}
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="px-5 pb-5">
          {isMyProject ? (
            <Link
              href={`/projects/${project.id}`}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition-colors"
            >
              View My Project
            </Link>
          ) : isOpen ? (
            <Link
              href={`/projects/${project.id}/join`}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition-colors shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30"
            >
              <Briefcase className="h-4 w-4" />
              Apply & Join Project
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-500 text-sm cursor-not-allowed">
              <Users className="h-4 w-4" />
              Freelancer Already Assigned
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white mb-4 text-sm">
          <ArrowLeft className="h-4 w-4" /> My Projects
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Globe className="h-6 w-6 text-blue-400" />
              Browse Open Projects
            </h1>
            <p className="text-slate-400 text-sm mt-1">Find a project, accept it, and get paid securely through escrow</p>
          </div>
          {!isAuthenticated && (
            <Link href="/connect" className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors">
              Connect Wallet to Apply
            </Link>
          )}
        </div>
      </div>

      {/* How it works for freelancers */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { step: '1', label: 'Browse & Apply', desc: 'Find an open project and click "Apply & Join"', icon: Search },
          { step: '2', label: 'Client Funds Escrow', desc: 'Client locks USDC in a smart contract', icon: DollarSign },
          { step: '3', label: 'Work & Get Paid', desc: 'Submit milestones, get paid on approval', icon: CheckCircle2 },
        ].map(({ step, label, desc, icon: Icon }) => (
          <div key={step} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {step}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects by title or description..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm transition-colors"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-slate-900 rounded-2xl border border-slate-800">
          <Globe className="h-14 w-14 text-slate-700 mx-auto mb-4" />
          <p className="text-white font-semibold mb-1">No open projects right now</p>
          <p className="text-slate-400 text-sm mb-6">Check back soon or create your own project as a client</p>
          <Link href="/projects/new" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors">
            Create a Project
          </Link>
        </div>
      ) : (
        <>
          {/* Open projects */}
          {openProjects.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">
                  {openProjects.length} Open Project{openProjects.length !== 1 ? 's' : ''} — Apply Now
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {openProjects.map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            </div>
          )}

          {/* Taken projects */}
          {takenProjects.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                {takenProjects.length} Project{takenProjects.length !== 1 ? 's' : ''} Already Taken
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {takenProjects.map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-sm disabled:opacity-40 hover:border-slate-600 transition-colors"
            >
              Previous
            </button>
            <span className="text-slate-400 text-sm">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-sm disabled:opacity-40 hover:border-slate-600 transition-colors"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
