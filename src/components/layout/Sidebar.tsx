'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  LogOut
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { LogoLockup } from '@/components/brand/Logo';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/sessions', label: 'Log Sessions', icon: FileText },
  { href: '/dashboard/alerts', label: 'Alerts', icon: AlertTriangle },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleSignOut = async () => {
    // Clear the in-memory accessToken + persisted user state first, then
    // ask the server to revoke the refresh cookie and clear it. We do the
    // client-side clear before the network call so the user is logged out
    // immediately even if the request fails.
    logout();
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // best-effort — the cookie is also httpOnly, so the server is the
      // source of truth. We've already cleared the client state.
    }
    router.push('/login');
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex h-16 items-center border-b border-zinc-800 px-5">
        <LogoLockup animated />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          Workspace
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-teal-500/10 text-cyan-100 ring-1 ring-inset ring-cyan-500/30'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 transition-colors',
                    isActive ? 'text-cyan-300' : 'text-zinc-500 group-hover:text-zinc-300'
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 text-cyan-200 ring-1 ring-inset ring-cyan-500/30 flex items-center justify-center text-xs font-semibold">
            {user?.name?.[0] || user?.email[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || 'Analyst'}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
