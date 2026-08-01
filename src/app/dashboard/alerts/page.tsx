'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | string;
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

export default function AlertsPage() {
  const { accessToken } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data } = useQuery<AlertsResponse>({
    queryKey: ['alerts-page'],
    queryFn: async () => {
      const res = await apiClient.get('/alerts');
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

  const alerts = data?.alerts ?? [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Click a row to jump to the originating session. Unread alerts are highlighted.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950">
        {alerts.length === 0 && (
          <div className="py-16 text-center text-sm text-zinc-500">
            <AlertTriangle className="h-6 w-6 mx-auto mb-3 text-zinc-600" />
            No alerts right now. Analysis will populate this feed once threats are detected.
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
                        {unread && <span className="h-2 w-2 rounded-full bg-cyan-400 flex-none" />}
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
