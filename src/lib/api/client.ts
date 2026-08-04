import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';

// Centralized axios client for the dashboard. On 401 it asks the server
// to mint a new access token via the httpOnly refresh cookie, then retries
// the original request once. If the refresh fails (cookie missing /
// expired / family-reuse trip), the user is marked as logged out so the
// dashboard layout will redirect them to /login.
export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await axios.post('/api/auth/refresh', null, {
        withCredentials: true,
      });
      const token = res.data?.data?.accessToken as string | undefined;
      if (token) {
        useAuthStore.getState().setAccessToken(token);
        return token;
      }
      useAuthStore.getState().logout();
      return null;
    } catch {
      useAuthStore.getState().logout();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (
      error.response?.status === 401 &&
      !original?._retried &&
      original?.url !== '/auth/refresh'
    ) {
      original._retried = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
    }
    return Promise.reject(error);
  },
);
