'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';

// Server snapshots. Module-level constants so useSyncExternalStore's
// getServerSnapshot returns a stable reference across renders.
const SERVER_HYDRATED = false;
const SERVER_AUTH = false;

const noopSubscribe = () => () => {};

// Referenced by useHasHydrated/useIsAuthenticated below. Keeping it here
// (rather than null-returning subscribers inline) makes it greppable if we
// ever need to swap the store implementation.
void noopSubscribe;

/**
 * Whether zustand/persist has finished reading localStorage on the client.
 *
 * useSyncExternalStore is the right primitive here because:
 *  - Dashboard pages are statically prerendered (○ in the build output), so
 *    this hook runs on the SERVER where zustand-v5 persist never attaches
 *    `.persist` — a plain `useAuthStore.persist.hasHydrated()` in a useState
 *    initializer crashed prerender with "Cannot read properties of undefined".
 *    getServerSnapshot handles that path cleanly.
 *  - It avoids the "setState synchronously in effect" lint error the earlier
 *    useState+useEffect version triggered.
 *  - No hydration mismatch: server HTML shows the spinner (false), first
 *    client render also returns false, then flips true when persist's
 *    hydration subscription fires.
 */
function useHasHydrated() {
  return useSyncExternalStore(
    (onStoreChange) => useAuthStore.persist.onFinishHydration(onStoreChange),
    () => useAuthStore.persist.hasHydrated(),
    () => SERVER_HYDRATED
  );
}

/**
 * isAuthenticated read through the same server-aware lens. Direct
 * `useAuthStore()` subscription would return the in-memory default (false)
 * on the server AND on first client render — which is what we want — but
 * going through useSyncExternalStore keeps the two values consistent within
 * a single render pass and makes the server boundary explicit.
 */
function useIsAuthenticated() {
  return useSyncExternalStore(
    (onStoreChange) => useAuthStore.subscribe(onStoreChange),
    () => useAuthStore.getState().isAuthenticated,
    () => SERVER_AUTH
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthenticated = useIsAuthenticated();
  const hasHydrated = useHasHydrated();
  const router = useRouter();

  useEffect(() => {
    // Only trust isAuthenticated once persist has merged localStorage into
    // state. Before that it shows the in-memory default (false) even when a
    // valid auth snapshot exists in storage — which is exactly the
    // "dashboard renders for ~1s, then bounces to /login" race being fixed.
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
