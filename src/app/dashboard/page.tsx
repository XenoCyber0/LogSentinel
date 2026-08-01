'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText, TrendingUp, ShieldAlert, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  AreaChart, Area, XAxis, YAxis,
} from 'recharts';
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
  severity: string;
  isRead: boolean;
  createdAt: string;
  session?: { title: string; id: string } | null;
}

interface SessionsResponse {
  sessions: SessionListItem[];
  pagination?: { total: number };
}

interface AlertsResponse {
  alerts: AlertItem[];
}

// Round a millisecond timestamp to UTC calendar-day boundaries so derived values
// only change when the data or the day changes — never within a render.
const DAY_MS = 86_400_000;
const dayFloor = (t: number) => Math.floor(t / DAY_MS) * DAY_MS;

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  INFO: '#22d3ee',
  UNKNOWN: '#71717a',
  PENDING: '#71717a',
};

export default function DashboardHome() {
  const { accessToken } = useAuthStore();
  const router = useRouter();

  const { data: sessionsData, dataUpdatedAt: sessionsUpdatedAt } = useQuery<SessionsResponse>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await apiClient.get('/sessions', { params: { limit: 100 } });
      return res.data.data;
    },
    enabled: !!accessToken,
  });

  const { data: alertsData, dataUpdatedAt: alertsUpdatedAt } = useQuery<AlertsResponse>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await apiClient.get('/alerts');
      return res.data.data;
    },
    enabled: !!accessToken,
    refetchInterval: 15000, // stay fresh
  });

  const sessions = sessionsData?.sessions ?? [];
  const alerts = alertsData?.alerts ?? [];
  const unreadAlerts = alerts.filter((a) => !a.isRead);
  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;

  // Sessions analyzed in the last 24h — a real value, not a fake "+12%".
  // `dataUpdatedAt` is supplied by React Query (no impure Date.now() during render).
  const analyzed24h = useMemo(() => {
    const now = dayFloor(sessionsUpdatedAt) + DAY_MS;
    return sessions.filter(
      (s) => s.analyzedAt && now - new Date(s.analyzedAt).getTime() < DAY_MS,
    ).length;
  }, [sessions, sessionsUpdatedAt]);

  // Activity over the last 7 days (sessions + alerts per day) for the trendline.
  // Keys off UTC day boundaries of refetch timestamps so it's pure during render.
  const activityData = useMemo(() => {
    const today = dayFloor(Math.max(sessionsUpdatedAt, alertsUpdatedAt));
    const days: { day: string; sessions: number; alerts: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = today - i * DAY_MS;
      const inDay = (iso: string | null) => {
        if (!iso) return false;
        const t = new Date(iso).getTime();
        return t >= dayStart && t < dayStart + DAY_MS;
      };
      const key = new Date(dayStart).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
      days.push({
        day: key,
        sessions: sessions.filter((s) => inDay(s.createdAt)).length,
        alerts: alerts.filter((a) => inDay(a.createdAt)).length,
      });
    }
    return days;
  }, [sessions, alerts, sessionsUpdatedAt, alertsUpdatedAt]);

  // Severity distribution across *sessions* for the donut.
  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) counts[s.severity] = (counts[s.severity] ?? 0) + 1;
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0);
  }, [sessions]);

  const topAlerts = [...unreadAlerts]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 10);

  const stats = [
    {
      title: 'Total Sessions',
      value: sessionsData?.pagination?.total ?? sessions.length,
      icon: FileText,
      hint: `${analyzed24h} analyzed in last 24h`,
    },
    {
      title: 'Unread Alerts',
      value: unreadAlerts.length,
      icon: AlertTriangle,
      hint: `${alerts.length} total`,
    },
    {
      title: 'Critical Threats',
      value: criticalCount,
      icon: ShieldAlert,
      hint: 'across all sessions',
      accent: criticalCount > 0,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Security Overview</h1>
          <p className="text-zinc-400 mt-1">Threat intelligence at a glance</p>
        </div>
        <Link href="/dashboard/sessions/new">
          <Button className="bg-white text-black hover:bg-zinc-200">New Analysis</Button>
        </Link>
      </div>

      {/* Stat cards — real values, informative hints (no fake percentages) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={index}
              className={cn(
                'bg-zinc-900 border-zinc-800',
                stat.accent && 'border-red-900/60 bg-red-950/20',
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">{stat.title}</CardTitle>
                <Icon className={cn('h-4 w-4', stat.accent ? 'text-red-400' : 'text-zinc-500')} />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-semibold tracking-tighter">{stat.value}</div>
                <p className="text-xs text-zinc-500 mt-1">{stat.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity distribution donut */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Sessions by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            {severityData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-zinc-500">
                No sessions yet. Run an analysis to populate this chart.
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {severityData.map((d) => (
                        <Cell key={d.name} fill={SEVERITY_COLORS[d.name] ?? '#71717a'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      formatter={(v) => <span style={{ color: '#d4d4d8', fontSize: 12 }}>{v}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity trend (7-day sessions + alerts) */}
        <Card className="bg-zinc-900 border-zinc-800 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">7-Day Activity</CardTitle>
            <TrendingUp className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <defs>
                    <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gAlerts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#3f3f46" fontSize={11} tickLine={false} />
                  <YAxis stroke="#3f3f46" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    fill="url(#gSessions)"
                  />
                  <Area
                    type="monotone"
                    dataKey="alerts"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="url(#gAlerts)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unread alert feed */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Needs Attention</CardTitle>
          <Link href="/dashboard/alerts">
            <Button variant="ghost" size="sm" className="text-cyan-300 hover:text-cyan-200">
              View all <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {topAlerts.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">
              You&apos;re all caught up — no unread alerts.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {topAlerts.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => {
                      if (a.session?.id) router.push(`/dashboard/sessions/${a.session.id}`);
                      else router.push('/dashboard/alerts');
                    }}
                    className="w-full flex items-start gap-3 py-2.5 text-left hover:bg-zinc-950/60 rounded px-2 -mx-2 transition-colors"
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 rounded-full flex-none',
                        a.severity === 'CRITICAL'
                          ? 'bg-red-500'
                          : a.severity === 'HIGH'
                            ? 'bg-orange-500'
                            : a.severity === 'MEDIUM'
                              ? 'bg-yellow-500'
                              : 'bg-blue-500',
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-zinc-100 truncate">{a.title}</div>
                      <div className="text-xs text-zinc-500 truncate">
                        {a.session?.title ?? 'Manual alert'} •{' '}
                        {new Date(a.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <span className="flex-none text-[10px] uppercase tracking-wider text-zinc-500">
                      {a.severity}
                    </span>
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
