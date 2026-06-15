'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderKanban, Plus, Scale, User, Shield, LogOut, Globe,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/projects', label: 'My Projects', icon: FolderKanban, exact: true },
  { href: '/projects/browse', label: 'Browse', icon: Globe, exact: true },
  { href: '/projects/new', label: 'New Project', icon: Plus, exact: false },
  { href: '/disputes', label: 'Disputes', icon: Scale, exact: true },
  { href: '/profile', label: 'Profile', icon: User, exact: true },
];

const adminItems = [
  { href: '/admin', label: 'Admin Panel', icon: Shield, exact: true },
];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

interface SidebarProps {
  onNavClick?: () => void;
}

export function Sidebar({ onNavClick }: SidebarProps = {}) {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();

  return (
    <aside className="w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-2 text-white font-bold text-xl">
          <Shield className="h-7 w-7 text-blue-400" />
          EscrowX
        </Link>
        <p className="text-xs text-slate-500 mt-0.5 ml-9">Decentralized Escrow</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent',
              )}
            >
              <item.icon className="h-4.5 w-4.5 flex-shrink-0" style={{ width: '1.125rem', height: '1.125rem' }} />
              {item.label}
            </Link>
          );
        })}

        {user?.role === 'ADMIN' && (
          <>
            <div className="pt-4 pb-1 px-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
              Admin
            </div>
            {adminItems.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavClick}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    active
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent',
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Network Badge */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-slate-500 capitalize">
            {process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet'}
          </span>
        </div>
      </div>

      {/* User footer */}
      {user && (
        <div className="px-3 py-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-600/30 flex items-center justify-center text-blue-400 text-sm font-bold flex-shrink-0">
              {user.displayName?.[0]?.toUpperCase() || user.walletAddress[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.displayName || `${user.walletAddress.slice(0, 8)}...`}
              </p>
              <p className="text-xs text-slate-400 capitalize">{user.role.toLowerCase()}</p>
            </div>
            <button
              onClick={clearAuth}
              className="p-1.5 rounded-md hover:bg-slate-700 text-slate-500 hover:text-white transition-colors flex-shrink-0"
              title="Disconnect wallet"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
