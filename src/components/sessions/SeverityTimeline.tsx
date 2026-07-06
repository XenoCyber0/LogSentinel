'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface SeverityTimelineProps {
  analysis: any;
}

export function SeverityTimeline({ analysis }: SeverityTimelineProps) {
  if (!analysis.timeline || analysis.timeline.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-sm text-zinc-500">
        No timeline data available
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <div className="font-semibold mb-6">Threat Timeline</div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={analysis.timeline}>
            <XAxis dataKey="timestamp" stroke="#3f3f46" />
            <YAxis stroke="#3f3f46" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#18181b', 
                border: '1px solid #3f3f46',
                borderRadius: '8px'
              }} 
            />
            <Line 
              type="monotone" 
              dataKey="count" 
              stroke="#ef4444" 
              strokeWidth={2.5} 
              dot={{ fill: '#ef4444', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
