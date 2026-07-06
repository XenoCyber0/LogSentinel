'use client';

// Minimal AuthProvider stub. The real auth state lives in the Zustand
// `useAuthStore` (see src/stores/authStore.ts); this component exists
// purely because src/app/layout.tsx wraps the tree in it, and the actual
// access-token hydration on mount is handled by <AuthHydrator/> sitting
// inside it. The Zustand store is the single source of truth — no React
// context is needed because the store is a global hook.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
