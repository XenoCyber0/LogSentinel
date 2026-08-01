'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Search, AlertTriangle, FileText, X, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { LogoMark } from '@/components/brand/Logo';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface SessionListItem {
  id: string;
  title: string;
  severity: string;
  analyzedAt: string | null;
  createdAt: string;
  tags: string[];
}

interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | string;
  isRead: boolean;
  createdAt: string;
  session?: { title: string; id: string };
}

interface SessionsResponse {
  sessions: SessionListItem[];
  pagination?: { total: number };
}

interface AlertsResponse {
  alerts: AlertItem[];
}

function SeverityDot({ severity }: { severity: string }) {
  const cls = severity.toLowerCase();
  const dotClass =
    {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-blue-500',
      info: 'bg-cyan-500',
    }[cls] ?? 'bg-zinc-600';
  return <span className={cn('inline-block h-2 w-2 rounded-full flex-none', dotClass)} />;
}

function severityIconClass(severity: string) {
  if (severity === 'CRITICAL') return 'text-red-400';
  if (severity === 'HIGH') return 'text-orange-400';
  if (severity === 'MEDIUM') return 'text-yellow-400';
  if (severity === 'LOW') return 'text-blue-400';
  if (severity === 'INFO') return 'text-cyan-400';
  return 'text-zinc-400';
}

export function Topbar() {
  const { user, accessToken } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [alertFilter, setAlertFilter] = useState<'unread' | 'all'>('unread');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Debounce the expensive filtering against a potentially large in-memory set.
  // 250ms feels instant while skipping work on every keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data: alertsData } = useQuery<AlertsResponse>({
    queryKey: ['alerts', 'meta'],
    queryFn: async () => {
      const res = await apiClient.get('/alerts');
      return res.data.data;
    },
    enabled: !!accessToken,
    // New alerts should surface promptly; 15s is cheap since the query is small.
    refetchInterval: 15000,
  });

  const { data: sessionsData } = useQuery<SessionsResponse>({
    queryKey: ['sessions', 'list'],
    queryFn: async () => {
      const res = await apiClient.get('/sessions', { params: { limit: 100 } });
      return res.data.data;
    },
    enabled: !!accessToken,
  });

  const allAlerts = useMemo(() => alertsData?.alerts ?? [], [alertsData]);
  const unreadCount = allAlerts.filter((a) => !a.isRead).length;
  const filteredAlerts =
    alertFilter === 'unread' ? allAlerts.filter((a) => !a.isRead) : allAlerts;

  // Toast when the last unread alert gets cleared — a small "all clear" signal.
  const prevUnreadRef = useRef<number>(unreadCount);
  useEffect(() => {
    const prev = prevUnreadRef.current;
    if (prev > 0 && unreadCount === 0) {
      toast.success('Inbox zero — all alerts read');
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const matching = useMemo(() => {
    if (!debouncedQuery)
      return {
        sessions: [] as SessionListItem[],
        alerts: [] as AlertItem[],
      };
    const q = debouncedQuery.toLowerCase();
    return {
      sessions:
        sessionsData?.sessions.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.tags.some((t) => t.toLowerCase().includes(q)),
        ) ?? [],
      alerts: allAlerts.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.session?.title?.toLowerCase().includes(q),
      ) ?? [],
    };
  }, [debouncedQuery, sessionsData, allAlerts]);

  const hasSearch = query.trim().length > 0;
  const hasAnyResult = matching.sessions.length > 0 || matching.alerts.length > 0;

  const clearSearch = () => {
    setQuery('');
    setDebouncedQuery('');
    setSearchOpen(false);
    searchInputRef.current?.blur();
  };

  const markAlertRead = async (alertId: string) => {
    try {
      await apiClient.patch(`/alerts/${alertId}`, { isRead: true });
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Marked as read');
    } catch {
      toast.error('Failed to update alert');
    }
  };

  // Clicking a session in the search picker just navigates.
  const navigateToSession = (id: string) => {
    clearSearch();
    router.push(`/dashboard/sessions/${id}`);
  };

  // Clicking an alert (search OR notifications dropdown) marks it read AND navigates.
  const handleAlertSelected = (a: AlertItem) => {
    if (!a.isRead) void markAlertRead(a.id);
    clearSearch();
    if (a.session?.id) {
      router.push(`/dashboard/sessions/${a.session.id}`);
    } else {
      router.push('/dashboard/alerts');
    }
  };

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-lg flex items-center gap-4 px-6 sticky top-0 z-50">
      <LogoMark className="h-6 w-6 lg:hidden" />
      <div className="flex items-center gap-4 flex-1 max-w-xl min-w-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') clearSearch();
              if (e.key === 'Enter' && matching.sessions[0]) navigateToSession(matching.sessions[0].id);
            }}
            placeholder="Search sessions, alerts, tags..."
            aria-label="Search sessions and alerts"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-10 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Search results dropdown */}
          {searchOpen && hasSearch && (
            <div className="absolute left-0 right-0 mt-2 rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/40 overflow-hidden z-40">
              <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-zinc-500">Results</span>
                <span className="text-xs text-zinc-500">
                  {matching.sessions.length + matching.alerts.length} match
                  {matching.sessions.length + matching.alerts.length === 1 ? '' : 'es'}
                </span>
              </div>

              {!hasAnyResult && (
                <div className="px-3 py-6 text-sm text-zinc-500 text-center">
                  No sessions or alerts match “{query}”
                </div>
              )}

              {matching.sessions.length > 0 && (
                <div className="py-1">
                  <div className="px-2 text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                    Sessions
                  </div>
                  <ul>
                    {matching.sessions.slice(0, 5).map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => navigateToSession(s.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-900 transition-colors"
                        >
                          <FileText className="h-4 w-4 text-zinc-500 flex-none" />
                          <span className="flex-1 min-w-0 truncate text-sm text-zinc-100">
                            {s.title}
                          </span>
                          <SeverityDot severity={s.severity} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {matching.alerts.length > 0 && (
                <div className="py-1 border-t border-zinc-800">
                  <div className="px-2 text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                    Alerts
                  </div>
                  <ul>
                    {matching.alerts.slice(0, 5).map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={() => handleAlertSelected(a)}
                          className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-zinc-900 transition-colors"
                        >
                          <AlertTriangle className="h-4 w-4 text-zinc-500 flex-none mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm text-zinc-100">{a.title}</span>
                              <SeverityDot severity={a.severity} />
                            </div>
                            {a.session?.title && (
                              <span className="text-xs text-cyan-300">{a.session.title}</span>
                            )}
                            <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
                              {a.description}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        {/* Notifications dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="relative p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-semibold text-zinc-950">
                {Math.min(unreadCount, 9)}
                {unreadCount > 9 ? '+' : ''}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 p-0 border-zinc-800 bg-zinc-950 overflow-hidden"
            sideOffset={8}
          >
            <div className="border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-zinc-500">Alerts</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setAlertFilter('unread')}
                  className={cn(
                    'h-7 px-2 rounded text-xs',
                    alertFilter === 'unread'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-200',
                  )}
                >
                  Unread
                </button>
                <button
                  onClick={() => setAlertFilter('all')}
                  className={cn(
                    'h-7 px-2 rounded text-xs',
                    alertFilter === 'all'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-200',
                  )}
                >
                  All
                </button>
              </div>
            </div>

            {filteredAlerts.length === 0 && (
              <div className="px-3 py-8 text-sm text-zinc-500 text-center">
                No {alertFilter === 'unread' ? 'unread' : ''} alerts right now
              </div>
            )}

            {filteredAlerts.length > 0 && (
              <ul className="max-h-[380px] overflow-y-auto divide-y divide-zinc-800">
                {filteredAlerts.slice(0, 12).map((a) => (
                  <li key={a.id} className="hover:bg-zinc-900 transition-colors">
                    <button
                      onClick={() => handleAlertSelected(a)}
                      className="w-full text-left px-3 py-2"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle
                          className={cn('h-4 w-4 flex-none mt-0.5', severityIconClass(a.severity))}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-zinc-100 truncate">{a.title}</span>
                            {!a.isRead && (
                              <span className="h-2 w-2 rounded-full bg-cyan-400 flex-none" />
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{a.description}</p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {a.session?.title ? (
                              <span className="text-xs text-cyan-300 truncate">{a.session.title}</span>
                            ) : (
                              <span />
                            )}
                            {!a.isRead && (
                              <span className="inline-flex items-center gap-1 text-xs text-zinc-400 flex-none">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Mark read
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-8 w-px bg-zinc-800" />

        <div className="hidden sm:block text-sm text-zinc-400">
          {user?.role} • {new Date().toLocaleDateString()}
        </div>

        <div className="h-8 w-8 rounded-full bg-cyan-500/20 text-cyan-200 ring-1 ring-inset ring-cyan-500/30 flex items-center justify-center text-xs font-semibold">
          {(user?.name?.[0] || user?.email?.[0] || 'L').toUpperCase()}
        </div>
      </div>
    </header>
  );
}
