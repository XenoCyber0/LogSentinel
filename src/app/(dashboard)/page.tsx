'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';

export default function DashboardHome() {
  const { accessToken } = useAuthStore();

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await apiClient.get('/sessions');
      return res.data.data;
    },
    enabled: !!accessToken,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await apiClient.get('/alerts');
      return res.data.data;
    },
    enabled: !!accessToken,
  });

  const stats = [
    {
      title: 'Total Sessions',
      value: sessionsData?.pagination?.total || 0,
      icon: FileText,
      change: '+12%',
    },
    {
      title: 'Active Alerts',
      value: alertsData?.alerts?.filter((a: any) => !a.isRead).length || 0,
      icon: AlertTriangle,
      change: '-4%',
    },
    {
      title: 'Analyzed Today',
      value: sessionsData?.sessions?.filter((s: any) => 
        new Date(s.analyzedAt).toDateString() === new Date().toDateString()
      ).length || 0,
      icon: TrendingUp,
      change: '+28%',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Security Dashboard</h1>
          <p className="text-zinc-400 mt-1">Real-time threat intelligence overview</p>
        </div>
        <Link href="/dashboard/sessions/new">
          <Button className="bg-white text-black hover:bg-zinc-200">
            New Analysis
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-zinc-500" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-semibold tracking-tighter">{stat.value}</div>
                <p className="text-xs text-emerald-400 mt-1">{stat.change} from last week</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {sessionsData?.sessions?.slice(0, 5).map((session: any) => (
              <Link 
                key={session.id} 
                href={`/dashboard/sessions/${session.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <div>
                  <div className="font-medium">{session.title}</div>
                  <div className="text-sm text-zinc-500">{new Date(session.createdAt).toLocaleDateString()}</div>
                </div>
                <div className={`px-3 py-1 text-xs rounded-full border severity-${session.severity.toLowerCase()}`}>
                  {session.severity}
                </div>
              </Link>
            ))}
            {!sessionsData?.sessions?.length && (
              <div className="text-center py-8 text-zinc-500">No sessions yet. Create your first analysis.</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Critical Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {alertsData?.alerts?.filter((a: any) => a.severity === 'CRITICAL').slice(0, 4).map((alert: any, idx: number) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-red-500 bg-zinc-950 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm">{alert.title}</div>
                  <div className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{alert.description}</div>
                </div>
              </div>
            )) || <div className="text-center py-8 text-zinc-500">No critical alerts</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
