'use client';

import { AuthHydrator } from './AuthHydrator';

// Composition wrapper around the auth-hydration logic. The real auth state
// lives in the Zustand `useAuthStore` (see src/stores/authStore.ts);
// AuthStore persists only `user + isAuthenticated` (never the accessToken),
// and AuthHydrator calls /api/auth/refresh on mount to mint a fresh access
// token if the user is still logged in. This component exists solely to group
// those concerns so the root layout (src/app/layout.tsx) reads naturally.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthHydrator />
      {children}
    </>
  );
}
