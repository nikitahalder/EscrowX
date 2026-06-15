'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { formatUSDC, PROJECT_STATUS_LABELS, formatDate } from '@/lib/utils';
import type { Project } from '@/types';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [freelancerProjects, setFreelancerProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<'client' | 'freelancer'>('client');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function loadProjects() {
    return Promise.all([
      projectsApi.list('client') as unknown as Promise<Project[]>,
      projectsApi.list('freelancer') as unknown as Promise<Project[]>,
    ]).then(([cp, fp]) => {
      setProjects(cp);
      setFreelancerProjects(fp);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { loadProjects(); }, []);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await projectsApi.delete(deleteId);
      setProjects(prev => prev.filter(p => p.id !== deleteId));
      setDeleteId(null);
    } catch (e: any) {
      alert(e.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  }

  const current = activeTab === 'client' ? projects : freelancerProjects;
  const filtered = current.filter(p =>
    search ? p.title.toLowerCase().includes(search.toLowerCase()) : true
  );

  const projectToDelete = projects.find(p => p.id === deleteId);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Project</h3>
                <p className="text-sm text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-slate-300 text-sm mb-2">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-white">"{projectToDelete?.title}"</span>?
            </p>
            <p className="text-slate-500 text-xs mb-6">
              The project will be permanently removed. This is only possible before the escrow is funded.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete Project
              </button>
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Projects</h1>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm"
        >
          <Plus className="h-4 w-4" /> New Project
        </Link>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex rounded-lg border border-slate-700 overflow-hidden">
          {(['client', 'freelancer'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              As {tab} ({(tab === 'client' ? projects : freelancerProjects).length})
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading projects...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 rounded-xl border border-slate-800">
          <p className="text-slate-400">No projects found</p>
          {activeTab === 'client' && (
            <Link href="/projects/new" className="mt-3 inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
              <Plus className="h-4 w-4" /> Create your first project
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(project => {
            const statusInfo = PROJECT_STATUS_LABELS[project.status] || { label: project.status, color: 'text-slate-400 bg-slate-400/10 border-slate-400/30' };
            const approved = project.milestones?.filter(m => m.status === 'APPROVED').length ?? 0;
            const total = project.milestones?.length ?? 0;
            const canDelete = activeTab === 'client' && project.status === 'AWAITING_FUNDING';

            return (
              <div key={project.id} className="relative group bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-600 transition-colors">
                <Link
                  href={`/projects/${project.id}`}
                  className="block p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-white truncate">{project.title}</h3>
                        <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-2">{project.description}</p>
                      <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                        <span>{formatUSDC(project.budget)}</span>
                        <span>{approved}/{total} milestones</span>
                        <span>{formatDate(project.createdAt)}</span>
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="flex-shrink-0 text-right">
                        <div className="text-sm text-slate-400 mb-1">{Math.round((approved / total) * 100)}%</div>
                        <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${(approved / total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Link>

                {canDelete && (
                  <button
                    onClick={e => { e.preventDefault(); setDeleteId(project.id); }}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Delete project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
