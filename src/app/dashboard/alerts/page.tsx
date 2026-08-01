'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Filter,
  Search,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api/client';
import { ExportButton } from '@/components/ExportButton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type AlertTypeValue =
  | 'BRUTE_FORCE'
  | 'SUSPICIOUS_IP'
  | 'SQL_INJECTION'
  | 'PATH_TRAVERSAL'
  | 'PRIVILEGE_ESCALATION'
  | 'ANOMALY'
  | 'RATE_LIMIT'
  | 'UNKNOWN';

interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | string;
  type: AlertTypeValue;
  isRead: boolean;
  ipAddress?: string | null;
  createdAt: string;
  session?: { title: string; id: string } | null;
}

interface AlertsResponse {
  alerts: AlertItem[];
}

const severityIcon: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-orange-400',
  MEDIUM: 'text-yellow-400',
  LOW: 'text-blue-400',
  INFO: 'text-cyan-400',
};

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
const ALERT_TYPES: { value: AlertTypeValue; label: string }[] = [
  { value: 'BRUTE_FORCE', label: 'Brute force' },
  { value: 'SUSPICIOUS_IP', label: 'Suspicious IP' },
  { value: 'SQL_INJECTION', label: 'SQL injection' },
  { value: 'PATH_TRAVERSAL', label: 'Path traversal' },
  { value: 'PRIVILEGE_ESCALATION', label: 'Privilege escalation' },
  { value: 'ANOMALY', label: 'Anomaly' },
  { value: 'RATE_LIMIT', label: 'Rate limit' },
];

export default function AlertsPage() {
  const { accessToken } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [severity, setSeverity] = useState<string>('all');
  const [alertType, setAlertType] = useState<string>('all');
  const [read, setRead] = useState<'all' | 'unread' | 'read'>('unread');
  const [q, setQ] = useState('');

  const hasFilters =
    severity !== 'all' || alertType !== 'all' || read !== 'all' || q.trim() !== '';

  const { data, isLoading } = useQuery<AlertsResponse>({
    // Every filter is part of the key so React Query caches each combination
    // separately and refetches automatically when one changes.
    queryKey: ['alerts-page', severity, alertType, read, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (severity !== 'all') params.set('severity', severity);
      if (alertType !== 'all') params.set('type', alertType);
      if (read !== 'all') params.set('read', read);
      if (q.trim()) params.set('q', q.trim());
      const res = await apiClient.get('/alerts', { params });
      return res.data.data;
    },
    enabled: !!accessToken,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/alerts/${id}`, { isRead: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Marked as read');
    },
    onError: () => toast.error('Failed to update alert'),
  });

  const clearFilters = () => {
    setSeverity('all');
    setAlertType('all');
    setRead('all');
    setQ('');
  };

  const alerts = data?.alerts ?? [];

  // Export passes current filters so the file matches what's on screen.
  const exportFilters: Record<string, string> = {};
  if (severity !== 'all') exportFilters.severity = severity;
  if (read === 'read') exportFilters.read = 'true';
  else if (read === 'unread') exportFilters.read = 'false';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Click a row to jump to the originating session.
          </p>
        </div>
        <ExportButton type="alerts" filters={exportFilters} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <Filter className="h-4 w-4 text-zinc-500 flex-none" />

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, description, IP…"
            className="w-full h-8 bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 text-xs placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>

        {/* Severity */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSeverity('all')}
            className={cn(
              'px-2 h-7 text-xs rounded-md transition-colors',
              severity === 'all'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            Any severity
          </button>
          {SEVERITIES.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(severity === s ? 'all' : s)}
              className={cn(
                'px-2 h-7 text-xs rounded-md transition-colors',
                severity === s
                  ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-inset ring-cyan-500/40'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Type */}
        <select
          value={alertType}
          onChange={(e) => setAlertType(e.target.value)}
          className="h-7 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="all">All types</option>
          {ALERT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {/* Read state */}
        <div className="flex items-center rounded-md border border-zinc-800 overflow-hidden">
          {(['unread', 'read', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRead(r)}
              className={cn(
                'px-2 h-7 text-xs transition-colors capitalize',
                read === r
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              {r}
            </button>
          ))}
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-2 h-7 text-xs text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950">
        {isLoading && alerts.length === 0 && (
          <div className="py-16 text-center text-sm text-zinc-500">Loading alerts…</div>
        )}
        {!isLoading && alerts.length === 0 && (
          <div className="py-16 text-center text-sm text-zinc-500">
            <AlertTriangle className="h-6 w-6 mx-auto mb-3 text-zinc-600" />
            No alerts match these filters.
          </div>
        )}
        {alerts.length > 0 && (
          <ul className="divide-y divide-zinc-800">
            {alerts.map((alert) => {
              const iconCls = severityIcon[alert.severity] ?? 'text-zinc-400';
              const unread = !alert.isRead;
              const sessionId = alert.session?.id;
              return (
                <li key={alert.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (unread) markReadMutation.mutate(alert.id);
                      if (sessionId) router.push(`/dashboard/sessions/${sessionId}`);
                    }}
                    className={cn(
                      'w-full group flex items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-zinc-900',
                      unread ? 'bg-cyan-950/10' : '',
                    )}
                  >
                    <AlertTriangle className={cn('h-5 w-5 mt-0.5 flex-none', iconCls)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-sm font-medium truncate',
                            unread ? 'text-zinc-100' : 'text-zinc-300',
                          )}
                        >
                          {alert.title}
                        </span>
                        <span className="flex-none text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          {alert.type.replace(/_/g, ' ')}
                        </span>
                        {unread && (
                          <span className="h-2 w-2 rounded-full bg-cyan-400 flex-none" />
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-zinc-400 line-clamp-2">
                        {alert.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        {alert.session?.title && (
                          <span className="truncate text-cyan-300">{alert.session.title}</span>
                        )}
                        {alert.ipAddress && <span>IP: {alert.ipAddress}</span>}
                        <span>{new Date(alert.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    {unread && (
                      <span className="flex-none self-center inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 group-hover:text-zinc-200">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark read
                      </span>
                    )}
                    {sessionId && (
                      <ChevronRight className="h-4 w-4 text-zinc-600 flex-none self-center group-hover:text-zinc-300 transition-colors" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
