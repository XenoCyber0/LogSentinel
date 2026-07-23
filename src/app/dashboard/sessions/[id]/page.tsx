'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { AnalysisReport } from '@/components/sessions/AnalysisReport';
import { SeverityTimeline } from '@/components/sessions/SeverityTimeline';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuthStore();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['session', id],
    queryFn: async () => {
      const res = await apiClient.get(`/sessions/${id}`);
      return res.data.data.session;
    },
    enabled: !!accessToken && !!id,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/sessions/${id}/analyze`, { force: true });
      return res.data.data.analysis;
    },
    onSuccess: () => {
      toast.success('Re-analysis complete');
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Re-analysis failed');
    },
  });

  if (isLoading || !data) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="h-8 w-48 bg-zinc-900 animate-pulse rounded mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[1,2].map(i => <div key={i} className="h-96 bg-zinc-900 rounded-2xl animate-pulse" />)}
          </div>
          <div className="h-[600px] bg-zinc-900 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sessions">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
            <p className="text-zinc-400 text-sm mt-1">{data.description}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => analyzeMutation.mutate()} 
            disabled={analyzeMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${analyzeMutation.isPending ? 'animate-spin' : ''}`} />
            {analyzeMutation.isPending ? 'Re-analyzing...' : 'Re-analyze'}
          </Button>
          <div className={`px-4 py-1.5 text-sm font-medium border rounded-full severity-${data.severity.toLowerCase()}`}>
            {data.severity}
          </div>
        </div>
      </div>

      {!data.analysis && (
        <div className="bg-orange-950/40 border border-orange-900 rounded-2xl p-6 flex items-center gap-4">
          <AlertTriangle className="text-orange-400" />
          <div>
            <div className="font-medium">Analysis pending</div>
            <div className="text-sm text-zinc-400">This session has not been analyzed yet.</div>
          </div>
          <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending} className="ml-auto">
            Start AI Analysis
          </Button>
        </div>
      )}

      {data.analysis && (
        <>
          <AnalysisReport analysis={data.analysis} sessionId={id as string} />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <SeverityTimeline analysis={data.analysis} />
            </div>
            
            <div className="lg:col-span-2">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="font-semibold mb-4">Session Metadata</h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-400">Log Format</span> <span>{data.logFormat}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Created</span> <span>{new Date(data.createdAt).toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Analyzed</span> <span>{data.analyzedAt ? new Date(data.analyzedAt).toLocaleString() : 'Pending'}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Size</span> <span>{data.fileSize ? (data.fileSize / 1024).toFixed(1) + ' KB' : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Alerts</span> <span>{data.alerts?.length || 0}</span></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Raw Log Viewer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="font-medium">Raw Log Content</div>
          <div className="text-xs text-zinc-500">{data.rawLog.length.toLocaleString()} chars</div>
        </div>
        <div className="p-6 max-h-[400px] overflow-auto log-viewer bg-zinc-950 font-mono text-xs leading-relaxed">
          {data.rawLog}
        </div>
      </div>
    </div>
  );
}
