'use client';

import { Bell, Search } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export function Topbar() {
  const { user } = useAuthStore();

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-lg flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search sessions, alerts, IPs..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-zinc-400 hover:text-white transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
        </button>
        
        <div className="h-8 w-px bg-zinc-800" />
        
        <div className="text-sm text-zinc-400">
          {user?.role} • {new Date().toLocaleDateString()}
        </div>
      </div>
    </header>
  );
}
