'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Users,
  ScrollText,
  Ban,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: 'ANALYST' | 'ADMIN' | 'VIEWER';
  isVerified: boolean;
  isBanned: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  _count: { sessions: number; alerts: number };
}

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { email: string; name: string | null } | null;
}

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'audit', label: 'Audit log', icon: ScrollText },
] as const;

type Tab = (typeof TABS)[number]['id'];

const roleBadge: Record<string, string> = {
  ADMIN: 'border-red-900/60 bg-red-950/40 text-red-300',
  ANALYST: 'border-cyan-900/60 bg-cyan-950/40 text-cyan-300',
  VIEWER: 'border-zinc-700 bg-zinc-800 text-zinc-300',
};

export default function AdminPage() {
  const { accessToken, user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('users');
  const [userSearch, setUserSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: AdminUser[] }>({
    queryKey: ['admin-users', userSearch],
    queryFn: async () => {
      const res = await apiClient.get('/admin/users', {
        params: userSearch.trim() ? { q: userSearch.trim() } : undefined,
      });
      return res.data.data;
    },
    enabled: !!accessToken && currentUser?.role === 'ADMIN',
  });

  const { data: auditData, isLoading: auditLoading } = useQuery<{
    logs: AuditLog[];
    pagination: { page: number; pages: number };
  }>({
    queryKey: ['admin-audit', auditPage],
    queryFn: async () => {
      const res = await apiClient.get('/admin/audit', { params: { page: auditPage } });
      return res.data.data;
    },
    enabled: !!accessToken && currentUser?.role === 'ADMIN' && tab === 'audit',
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { role?: string; isBanned?: boolean } }) => {
      await apiClient.patch(`/admin/users/${id}`, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User updated');
    },
    onError: (error) => {
      toast.error(
        error instanceof AxiosError
          ? (error.response?.data?.error as string) ?? 'Update failed'
          : 'Update failed',
      );
    },
  });

  // Non-admins hit the API guard anyway; this is just a front-door redirect.
  if (currentUser && currentUser.role !== 'ADMIN') {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center">
        <Shield className="h-10 w-10 mx-auto mb-4 text-red-400" />
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="text-zinc-400 mt-2">Your account doesn&apos;t have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-red-400" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin console</h1>
          <p className="text-zinc-400 mt-1">User management and audit trail</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm transition-colors border-b-2 -mb-px',
              tab === id
                ? 'border-red-500 text-red-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Users tab ─────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="space-y-3">
          <input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search by email or name…"
            className="w-full max-w-sm h-9 bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700"
          />

          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950">
            {usersLoading && (
              <div className="py-16 text-center text-sm text-zinc-500">Loading users…</div>
            )}
            {!usersLoading && (usersData?.users ?? []).length === 0 && (
              <div className="py-16 text-center text-sm text-zinc-500">
                {userSearch ? 'No users match that search' : 'No users yet'}
              </div>
            )}
            {(usersData?.users ?? []).length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left">
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      User
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Role
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Sessions / Alerts
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Last login
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500 w-40 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {usersData!.users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className={cn(u.isBanned && 'opacity-50')}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-xs font-semibold flex-none">
                              {(u.name?.[0] ?? u.email[0]).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-zinc-100 truncate">
                                {u.name ?? '(no name)'}
                                {isSelf && (
                                  <span className="ml-2 text-[10px] uppercase tracking-wider text-zinc-500">
                                    you
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              disabled={isSelf}
                              className={cn(
                                'px-2 py-1 rounded text-xs border transition-colors',
                                roleBadge[u.role],
                                isSelf ? 'cursor-not-allowed' : 'hover:border-zinc-600 cursor-pointer',
                              )}
                            >
                              {u.role}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="border-zinc-800 bg-zinc-950">
                              {(['ANALYST', 'ADMIN', 'VIEWER'] as const).map((r) => (
                                <DropdownMenuItem
                                  key={r}
                                  onClick={() =>
                                    updateUserMutation.mutate({ id: u.id, patch: { role: r } })
                                  }
                                  className="justify-between"
                                >
                                  {r}
                                  {u.role === r && <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {u._count.sessions} / {u._count.alerts}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-xs">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'never'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!isSelf && (
                            <button
                              onClick={() =>
                                updateUserMutation.mutate({
                                  id: u.id,
                                  patch: { isBanned: !u.isBanned },
                                })
                              }
                              disabled={updateUserMutation.isPending}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2 h-7 text-xs rounded-md border transition-colors',
                                u.isBanned
                                  ? 'border-emerald-900/60 text-emerald-300 hover:bg-emerald-950/30'
                                  : 'border-red-900/60 text-red-300 hover:bg-red-950/30',
                              )}
                            >
                              <Ban className="h-3 w-3" />
                              {u.isBanned ? 'Unban' : 'Ban'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Audit log tab ─────────────────────────────────────────────── */}
      {tab === 'audit' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950">
            {auditLoading && (
              <div className="py-16 text-center text-sm text-zinc-500">Loading audit log…</div>
            )}
            {!auditLoading && (auditData?.logs ?? []).length === 0 && (
              <div className="py-16 text-center text-sm text-zinc-500">No audit events yet</div>
            )}
            {(auditData?.logs ?? []).length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left">
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Time
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      User
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Action
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {auditData!.logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-2.5 text-zinc-400 text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-200 max-w-48 truncate">
                        {log.user?.email ?? '(system)'}
                      </td>
                      <td className="px-4 py-2.5">
                        <code className="text-xs text-cyan-300 bg-zinc-900 px-1.5 py-0.5 rounded">
                          {log.action}
                        </code>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 text-xs">
                        {log.resource}
                        {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}…` : ''}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs font-mono">
                        {log.ipAddress ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {auditData && auditData.pagination.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-zinc-400">
              <span>
                Page {auditData.pagination.page} of {auditData.pagination.pages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  disabled={auditPage === 1}
                  className="p-1.5 rounded-md border border-zinc-800 hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setAuditPage((p) => Math.min(auditData.pagination.pages, p + 1))}
                  disabled={auditPage >= auditData.pagination.pages}
                  className="p-1.5 rounded-md border border-zinc-800 hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
