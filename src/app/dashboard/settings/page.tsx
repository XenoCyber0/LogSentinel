'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Copy, Trash2, User as UserIcon, Lock, Check } from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api/client';

interface ApiToken {
  id: string;
  name: string;
  createdAt: string;
  expiresAt: string;
}

interface TokensResponse {
  tokens: ApiToken[];
}

interface CreateTokenResponse {
  token: string;
  info: ApiToken;
}

export default function SettingsPage() {
  const { user, accessToken, setAuth, logout } = useAuthStore();
  const queryClient = useQueryClient();

  // Profile form — the "edited" flag tracks user intent so late hydration can
  // prefill the input without an effect call (setState-in-effect is forbidden
  // by the React Compiler because it cascades renders).
  const [name, setNameState] = useState(user?.name ?? '');
  const [nameDirty, setNameDirty] = useState(false);
  const setName = (value: string) => {
    setNameState(value);
    setNameDirty(true);
  };
  if (!nameDirty && user?.name != null && name !== user.name) {
    setNameState(user.name); // allowed: render-time sync to a prop/source of truth
  }

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // API token form
  const [tokenName, setTokenName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: tokensData } = useQuery<TokensResponse>({
    queryKey: ['api-tokens'],
    queryFn: async () => {
      const res = await apiClient.get('/auth/api-token');
      return res.data.data;
    },
    enabled: !!accessToken,
  });

  const profileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch(`/users/${user?.id}`, { name });
      return res.data.data.user as NonNullable<typeof user>;
    },
    onSuccess: (updated) => {
      if (accessToken) {
        // setAuth keeps the in-memory token, only swaps the user record so the
        // persisted store stays consistent with the server.
        setAuth(updated, accessToken);
      }
      toast.success('Profile updated');
    },
    onError: (error) => {
      toast.error(
        error instanceof AxiosError
          ? (error.response?.data?.error as string) ?? 'Update failed'
          : 'Update failed',
      );
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/change-password', { currentPassword, newPassword });
    },
    onSuccess: async () => {
      toast.success('Password changed — you need to sign in again');
      // The server has revoked every refresh token, so our sessions are dead.
      // Give the toast a beat to render, then force a clean re-login.
      setTimeout(() => {
        logout();
        window.location.href = '/login';
      }, 800);
    },
    onError: (error) => {
      toast.error(
        error instanceof AxiosError
          ? (error.response?.data?.error as string) ?? 'Password change failed'
          : 'Password change failed',
      );
    },
  });

  const createTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/auth/api-token', {
        name: tokenName.trim() || 'default',
      });
      return res.data.data as CreateTokenResponse;
    },
    onSuccess: (data) => {
      setNewToken(data.token);
      setTokenName('');
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
      toast.success('Token created — copy it now');
    },
    onError: () => toast.error('Failed to create token'),
  });

  const revokeTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete('/auth/api-token', { params: { id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
      toast.success('Token revoked');
    },
    onError: () => toast.error('Failed to revoke token'),
  });

  const copyToken = async () => {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    passwordMutation.mutate();
  };

  const tokens = tokensData?.tokens ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-zinc-400 mt-1">Profile, credentials, and API access</p>
      </div>

      {/* Profile */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-cyan-300" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ''} disabled />
            <p className="text-xs text-zinc-500">Email changes are not self-service yet.</p>
          </div>
          <Button
            onClick={() => profileMutation.mutate()}
            disabled={profileMutation.isPending || !name.trim()}
            className="bg-white text-black hover:bg-zinc-200"
          >
            {profileMutation.isPending ? 'Saving…' : 'Save profile'}
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-cyan-300" /> Change password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Current password</Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new">New password</Label>
                <Input
                  id="new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Changing your password signs you out of all other sessions immediately.
            </p>
            <Button
              type="submit"
              variant="outline"
              className="border-zinc-700"
              disabled={
                passwordMutation.isPending ||
                !currentPassword ||
                newPassword.length < 8
              }
            >
              {passwordMutation.isPending ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* API tokens */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4 text-cyan-300" /> API tokens
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-400">
            Use a token as a Bearer credential against <code className="text-xs bg-zinc-800 px-1 py-0.5 rounded">/api/auth/refresh</code> to
            mint short-lived access tokens for scripts.
          </p>

          {/* Newly created token — shown once */}
          {newToken && (
            <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-3">
              <p className="text-xs font-medium text-emerald-300 mb-2">
                Copy this token now — it won&apos;t be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-zinc-200 bg-zinc-950 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
                  {newToken}
                </code>
                <Button size="sm" variant="outline" onClick={() => void copyToken()}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}

          {/* Create */}
          <div className="flex gap-2">
            <Input
              placeholder="Token name (e.g. ci-scanner)"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              maxLength={50}
              className="flex-1"
            />
            <Button
              onClick={() => createTokenMutation.mutate()}
              disabled={createTokenMutation.isPending}
              className="bg-white text-black hover:bg-zinc-200"
            >
              {createTokenMutation.isPending ? 'Creating…' : 'Create token'}
            </Button>
          </div>

          {/* List */}
          {tokens.length > 0 && (
            <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg">
              {tokens.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-100 truncate">{t.name}</p>
                    <p className="text-xs text-zinc-500">
                      Created {new Date(t.createdAt).toLocaleDateString()} · expires{' '}
                      {new Date(t.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => revokeTokenMutation.mutate(t.id)}
                    disabled={revokeTokenMutation.isPending}
                    className="p-2 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition-colors disabled:opacity-50"
                    aria-label={`Revoke token ${t.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
