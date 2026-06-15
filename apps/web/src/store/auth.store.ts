import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  walletProvider: 'freighter' | 'lobstr' | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, provider: 'freighter' | 'lobstr') => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
}

const safeStorage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {}
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {}
  },
}));

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      walletProvider: null,
      isAuthenticated: false,
      setAuth: (user, token, provider) => {
        try { localStorage.setItem('escrowx_token', token); } catch {}
        set({ user, token, walletProvider: provider, isAuthenticated: true });
      },
      clearAuth: () => {
        try { localStorage.removeItem('escrowx_token'); } catch {}
        set({ user: null, token: null, walletProvider: null, isAuthenticated: false });
      },
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'escrowx-auth',
      storage: safeStorage,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        walletProvider: state.walletProvider,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
