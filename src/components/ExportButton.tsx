'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

interface ExportButtonProps {
  type: 'sessions' | 'alerts';
  /** Extra filters are appended verbatim, e.g. { severity: 'CRITICAL', read: 'unread' } */
  filters?: Record<string, string>;
  variant?: 'default' | 'icon';
  className?: string;
}

// Uses a raw fetch (not apiClient) because we need blob access and axios's
// default transforms get in the way. The access token comes from the same
// zustand store, so the auth contract stays identical.
export function ExportButton({ type, filters = {}, variant = 'default', className }: ExportButtonProps) {
  const { accessToken } = useAuthStore();
  const [downloading, setDownloading] = useState<'csv' | 'json' | null>(null);

  const download = async (format: 'csv' | 'json') => {
    if (!accessToken) {
      toast.error('Sign in to export');
      return;
    }
    setDownloading(format);
    try {
      const params = new URLSearchParams({ type, format, ...filters });
      const res = await fetch(`/api/export?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        toast.error('Export failed');
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const filename = /filename="([^"]+)"/.exec(cd)?.[1] ?? `logsentinel-${type}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${type} as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    } finally {
      setDownloading(null);
    }
  };

  if (variant === 'icon') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <button
          onClick={() => void download('csv')}
          disabled={downloading !== null}
          title="Export CSV"
          className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={() => void download('csv')}
        disabled={downloading !== null}
        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" />
        {downloading === 'csv' ? 'Preparing…' : 'CSV'}
      </button>
      <button
        onClick={() => void download('json')}
        disabled={downloading !== null}
        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" />
        {downloading === 'json' ? 'Preparing…' : 'JSON'}
      </button>
    </div>
  );
}
