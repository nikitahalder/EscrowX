'use client';

import { useEffect, useState } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let addToast: (toast: Omit<Toast, 'id'>) => void = () => {};

export function toast(message: string, type: Toast['type'] = 'info') {
  addToast({ message, type });
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    addToast = (t) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm ${
            t.type === 'success'
              ? 'bg-green-500 text-white'
              : t.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-slate-800 text-white border border-slate-700'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
