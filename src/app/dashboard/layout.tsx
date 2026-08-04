'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Tracks whether zustand/persist has finished reading localStorage on the
 * client. Until it has, `isAuthenticated` shows the in-memory default
 * (false) even when a real auth snapshot exists in storage. Gating the
 * redirect + render on this prevents the "logged-in dashboard renders for
 * ~1s, then bounces to /login" race.
 *
 * Subscribes to `persist.onFinishHydration` so the flag flips
 * reactivley — a plain `useEffect(() => setHydrated(true))` would also
 * work but runs *after* first paint, which lets a forbidden-route
 * `router.push('/login')` slip through before we get a chance to stop it.
 */
function useHasHydrated() {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    // useState's lazy initializer above already handled the case where
    // hydration finished before first render; this subscription catches
    // the case where it finishes AFTER first render.
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuthStore();
  const hasHydrated = useHasHydrated();
  const router = useRouter();

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
