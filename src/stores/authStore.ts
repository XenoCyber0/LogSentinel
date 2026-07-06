import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@/types/auth';

interface AuthState {
  user: User | null;
  // accessToken is intentionally NOT persisted — it lives in memory only to
  // limit XSS blast radius. The refresh token is an httpOnly cookie (see
  // src/app/api/auth/login/route.ts + /refresh), and the app calls
  // /api/auth/refresh on mount to mint a new access token if the user
  // is marked as authenticated but no access token is in memory.
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () => set({ user: null, accessToken: null, isAuthenticated: false }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      // Called on app mount: if we previously persisted an authenticated
      // user but the accessToken is in memory only, ask the server to
      // mint a new one using the httpOnly refresh cookie. If the refresh
      // cookie is missing/expired, the server will clear it and we mark
      // the user as logged out.
      hydrate: async () => {
        const { isAuthenticated, accessToken, user } = get();
        if (!isAuthenticated || !user) return;
        if (accessToken) return; // already in memory, nothing to do

        try {
          const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });
          if (!res.ok) {
            // refresh failed — bounce to logged-out state
            set({ user: null, accessToken: null, isAuthenticated: false });
            return;
          }
          const json = await res.json();
          const newAccessToken = json?.data?.accessToken as string | undefined;
          const newUser = json?.data?.user as User | undefined;
          if (!newAccessToken) {
            set({ user: null, accessToken: null, isAuthenticated: false });
            return;
          }
          set({
            accessToken: newAccessToken,
            user: newUser ?? user,
          });
        } catch {
          // Network error during hydrate — leave the state as-is and let
          // the next API call trigger a refresh via the 401 interceptor.
        }
      },
    }),
    {
      name: 'auth-storage',
      // Only persist user + isAuthenticated. accessToken stays in memory.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      // Use a no-op SSR-safe storage so persist doesn't crash on the
      // server during initial render. The browser's localStorage is
      // picked up automatically on the client.
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : (undefined as unknown as Storage)
      ),
      skipHydration: true,
    }
  )
);
