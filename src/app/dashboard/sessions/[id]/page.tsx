'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { AnalysisReport } from '@/components/sessions/AnalysisReport';
import { SeverityTimeline } from '@/components/sessions/SeverityTimeline';
import { AlertTriangle, Archive, ArrowLeft, ChevronDown, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AnalysisResult } from '@/lib/ai/analyzer';

type Tab = 'analysis' | 'raw' | 'timeline';

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;

const severityBadge: Record<string, string> = {
  CRITICAL: 'border-red-900 bg-red-950 text-red-300',
  HIGH: 'border-orange-900 bg-orange-950 text-orange-300',
  MEDIUM: 'border-yellow-900 bg-yellow-950 text-yellow-300',
  LOW: 'border-blue-900 bg-blue-950 text-blue-300',
  INFO: 'border-cyan-900 bg-cyan-950 text-cyan-300',
  UNKNOWN: 'border-zinc-700 bg-zinc-800 text-zinc-300',
  PENDING: 'border-zinc-700 bg-zinc-800 text-zinc-300',
};

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('analysis');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['session', id],
    queryFn: async () => {
      const res = await apiClient.get(`/sessions/${id}`);
      return res.data.data.session;
    },
    enabled: !!accessToken && !!id,
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: { isArchived?: boolean; severity?: string }) => {
      const res = await apiClient.patch(`/sessions/${id}`, payload);
      return res.data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      if (variables.isArchived) {
        toast.success('Session archived');
        router.push('/dashboard/sessions');
      } else {
        toast.success(`Severity set to ${variables.severity}`);
      }
    },
    onError: (error: unknown) => {
      const msg =
        error instanceof AxiosError
          ? (error.response?.data?.error as string) || 'Update failed'
          : 'Update failed';
      toast.error(msg);
    },
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
    onError: (error: unknown) => {
      const message =
        error instanceof AxiosError
          ? (error.response?.data?.error as string) || 'Re-analysis failed'
          : 'Re-analysis failed';
      toast.error(message);
    },
  });

  if (isLoading || !data) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="h-8 w-48 bg-zinc-900 animate-pulse rounded mb-8" />
        <div className="h-[480px] bg-zinc-900 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const analysis: AnalysisResult | null = data.analysis ?? null;
  const rawLog: string = data.rawLog ?? '';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/dashboard/sessions">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight truncate">{data.title}</h1>
            {data.description && (
              <p className="text-zinc-400 text-sm mt-0.5 truncate">{data.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Severity override */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'px-4 py-1.5 text-sm font-medium border rounded-full inline-flex items-center gap-2',
                  severityBadge[data.severity] ?? severityBadge.UNKNOWN,
                )}
              >
                {data.severity}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="p-1">
              <div className="px-2 py-1.5 text-xs text-zinc-500">Override severity</div>
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  onClick={() => patchMutation.mutate({ severity: s })}
                  disabled={patchMutation.isPending}
                  className={cn(
                    'w-full text-left px-2 py-1.5 text-sm rounded hover:bg-zinc-900 transition-colors',
                    data.severity === s ? 'text-cyan-300' : 'text-zinc-300',
                  )}
                >
                  {s}
                </button>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${analyzeMutation.isPending ? 'animate-spin' : ''}`}
            />
            {analyzeMutation.isPending ? 'Re-analyzing...' : 'Re-analyze'}
          </Button>

          <Button
            variant="outline"
            onClick={() => patchMutation.mutate({ isArchived: true })}
            disabled={patchMutation.isPending}
            className="text-zinc-400 hover:text-red-300"
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </Button>
        </div>
      </div>

      {!analysis && (
        <div className="bg-orange-950/40 border border-orange-900 rounded-2xl p-6 flex items-center gap-4">
          <AlertTriangle className="text-orange-400" />
          <div>
            <div className="font-medium">Analysis pending</div>
            <div className="text-sm text-zinc-400">This session has not been analyzed yet.</div>
          </div>
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="ml-auto"
          >
            Start AI Analysis
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <div className="flex gap-1">
          {(
            [
              { key: 'analysis', label: 'Analysis', disabled: !analysis },
              { key: 'raw', label: `Raw Log (${rawLog.length.toLocaleString()} chars)` },
              { key: 'timeline', label: 'Timeline', disabled: !analysis },
            ] as { key: Tab; label: string; disabled?: boolean }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => !t.disabled && setTab(t.key)}
              disabled={t.disabled}
              className={cn(
                'px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
                tab === t.key
                  ? 'border-cyan-400 text-cyan-200'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200',
                t.disabled && 'opacity-40 cursor-not-allowed hover:text-zinc-400',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panes */}
      {tab === 'analysis' && analysis && (
        <div className="space-y-6">
          <AnalysisReport analysis={analysis} sessionId={id as string} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetaCard label="Log Format" value={data.logFormat} />
            <MetaCard
              label="Analyzed"
              value={data.analyzedAt ? new Date(data.analyzedAt).toLocaleString() : 'Pending'}
            />
            <MetaCard label="Lines" value={data.totalLines?.toLocaleString() ?? '—'} />
            <MetaCard label="Alerts" value={String(data.alerts?.length ?? 0)} />
          </div>
        </div>
      )}

      {tab === 'raw' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="font-medium">Raw Log Content</div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(rawLog);
                toast.success('Copied to clipboard');
              }}
              className="text-xs text-cyan-300 hover:text-cyan-200"
            >
              Copy
            </button>
          </div>
          <div className="p-6 max-h-[70vh] overflow-auto log-viewer bg-zinc-950 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {rawLog}
          </div>
        </div>
      )}

      {tab === 'timeline' && analysis && <SeverityTimeline analysis={analysis} />}
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-sm text-zinc-100 truncate">{value}</div>
    </div>
  );
}
