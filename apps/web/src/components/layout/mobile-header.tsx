'use client';

import { Menu, Shield } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Link href="/dashboard" className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-blue-400" />
        <span className="font-bold text-white">EscrowX</span>
      </Link>

      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">
        {user?.displayName?.[0]?.toUpperCase() || user?.walletAddress?.[0] || '?'}
      </div>
    </header>
  );
}
