'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { ExportButton } from '@/components/ExportButton';
import { formatDate } from '@/lib/utils';

interface SessionListItem {
  id: string;
  title: string;
  description?: string | null;
  severity: string;
  analyzedAt: string | null;
  createdAt: string;
  tags?: string[];
  _count?: { alerts: number; ipRecords: number };
}

export default function SessionsPage() {
  const { accessToken } = useAuthStore();

  const { data, isLoading } = useQuery<{ sessions: SessionListItem[] }>({
    queryKey: ['sessions-list'],
    queryFn: async () => {
      const res = await apiClient.get('/sessions');
      return res.data.data;
    },
    enabled: !!accessToken,
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Log Sessions</h1>
          <p className="text-zinc-400 mt-1">All analyzed log files and paste sessions</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton type="sessions" />
          <Link href="/dashboard/sessions/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Session
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-zinc-900 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {data?.sessions && data.sessions.length > 0 ? (
            data.sessions.map((session) => (
              <Link 
                key={session.id} 
                href={`/dashboard/sessions/${session.id}`}
                className="block p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg group-hover:text-white transition-colors">{session.title}</h3>
                      <div className={`px-3 py-0.5 text-xs font-medium border rounded-full severity-${session.severity.toLowerCase()}`}>
                        {session.severity}
                      </div>
                    </div>
                    <p className="text-sm text-zinc-400 mt-1 line-clamp-1">{session.description || 'No description'}</p>
                    
                    <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> {formatDate(session.createdAt)}
                      </div>
                      <div>{session._count?.alerts || 0} alerts</div>
                      <div>{session._count?.ipRecords || 0} IPs</div>
                      {session.analyzedAt && <div className="text-emerald-400">Analyzed</div>}
                    </div>
                  </div>
                  
                  <div className="text-right text-xs text-zinc-500">
                    {session.tags && session.tags.length > 0 && (
                      <div className="flex gap-1 justify-end">
                        {session.tags.slice(0, 2).map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-zinc-800 rounded text-[10px]">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-20 bg-zinc-900 border border-zinc-800 rounded-2xl">
              <FileText className="mx-auto h-12 w-12 text-zinc-600 mb-4" />
              <h3 className="text-xl font-medium">No log sessions yet</h3>
              <p className="text-zinc-400 mt-2">Upload or paste your first log file to begin analysis</p>
              <Link href="/dashboard/sessions/new" className="inline-block mt-6">
                <Button>Create First Session</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
