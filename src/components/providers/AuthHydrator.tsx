'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

// Mounts once at the top of the React tree (see src/app/layout.tsx via
// <AuthHydrator/>) and hydrates the access token from the httpOnly
// refresh cookie on first paint. This is how the app survives a hard
// refresh / new tab: the user object + isAuthenticated are persisted in
// localStorage, but the access token is in memory only.
export function AuthHydrator() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return null;
}
