'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const userId = useAuthStore((s) => s.user?.id ?? null);

  // The QueryClient instance lives for the lifetime of the page, but query
  // keys (['sessions'], ['alerts'], ['session', id], …) are NOT user-scoped.
  // Without this, log in as user B on the same browser after user A and the
  // dashboard briefly renders A's cached sessions/alerts while B's queries
  // refetch — a real data-leak UX bug in addition to looking broken.
  // Clearing whenever the authenticated identity changes (login, logout,
  // account switch) removes A's data from every observer synchronously.
  const prevUserIdRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevUserIdRef.current = userId;
      return;
    }
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      queryClient.clear();
    }
  }, [userId, queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
