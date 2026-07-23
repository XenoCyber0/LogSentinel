'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api/client';
import { AlertTriangle } from 'lucide-react';

interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: string;
  isRead: boolean;
  ipAddress?: string | null;
  createdAt: string;
  session?: { title: string } | null;
}

export default function AlertsPage() {
  const { accessToken } = useAuthStore();

  const { data } = useQuery<AlertItem[]>({
    queryKey: ['alerts-page'],
    queryFn: async () => {
      const res = await apiClient.get('/alerts');
      return res.data.data.alerts;
    },
    enabled: !!accessToken,
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Security Alerts</h1>
        <p className="text-zinc-400">All detected threats across your log sessions</p>
      </div>

      <div className="space-y-3">
        {data?.map((alert) => (
          <div key={alert.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex gap-4">
            <div className="mt-1">
              <AlertTriangle className="text-red-400 h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="font-medium text-lg">{alert.title}</div>
                <div className={`px-3 py-px text-xs rounded border severity-${alert.severity.toLowerCase()}`}>{alert.severity}</div>
              </div>
              <div className="text-sm mt-1 text-zinc-300">{alert.description}</div>
              <div className="text-xs mt-3 flex gap-4 text-zinc-500">
                <span>{alert.session?.title}</span>
                {alert.ipAddress && <span>IP: {alert.ipAddress}</span>}
                <span>{new Date(alert.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
        {!data?.length && (
          <div className="text-center py-20 text-zinc-500">No alerts found</div>
        )}
      </div>
    </div>
  );
}
