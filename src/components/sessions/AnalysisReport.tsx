'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Shield } from 'lucide-react';
import type { AnalysisResult } from '@/lib/ai/analyzer';

interface AnalysisReportProps {
  analysis: AnalysisResult;
  sessionId: string;
}

export function AnalysisReport({ analysis }: AnalysisReportProps) {
  const severityColor: Record<string, string> = {
    CRITICAL: 'text-red-400 bg-red-950 border-red-900',
    HIGH: 'text-orange-400 bg-orange-950 border-orange-900',
    MEDIUM: 'text-yellow-400 bg-yellow-950 border-yellow-900',
    LOW: 'text-blue-400 bg-blue-950 border-blue-900',
    INFO: 'text-zinc-400 bg-zinc-800 border-zinc-700',
    UNKNOWN: 'text-zinc-400 bg-zinc-800 border-zinc-700',
  };
  const color = severityColor[analysis.severity] || severityColor.UNKNOWN;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>AI Threat Summary</CardTitle>
            <div className={`px-4 py-1 rounded-full text-sm font-medium border ${color}`}>
              {analysis.severity}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-lg leading-relaxed text-zinc-200">{analysis.summary}</p>
          
          <div className="flex flex-wrap gap-2 mt-6">
            {analysis.recommendations?.slice(0, 4).map((rec: string, index: number) => (
              <div key={index} className="px-4 py-1.5 bg-zinc-950 border border-zinc-800 rounded-full text-xs text-zinc-300 flex items-center gap-2">
                <Shield className="h-3 w-3" /> {rec}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Threats */}
      {analysis.threats?.length > 0 && (
        <div>
          <h3 className="font-semibold text-xl mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" /> Detected Threats ({analysis.threats.length})
          </h3>
          
          <div className="space-y-4">
            {analysis.threats.map((threat, index) => (
              <div key={index} className="threat-card border-l-4 border-red-500 bg-zinc-900/70 p-5 rounded-r-xl">
                <div className="flex justify-between mb-3">
                  <div>
                    <div className="font-semibold text-lg">{threat.title}</div>
                    <div className="text-xs text-red-400 uppercase tracking-[1px]">{threat.type}</div>
                  </div>
                  <div className={`px-3 py-0.5 text-xs border rounded font-medium self-start severity-${threat.severity.toLowerCase()}`}>
                    {threat.severity}
                  </div>
                </div>
                
                <p className="text-zinc-300 mb-4">{threat.description}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Evidence</div>
                    <ul className="text-zinc-400 space-y-px">
                      {threat.evidence?.map((ev: string, i: number) => <li key={i}>• {ev}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Recommendation</div>
                    <div className="text-emerald-400 leading-tight">{threat.recommendation}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IP Analysis */}
      {analysis.ipAnalysis?.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>IP Intelligence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-zinc-400">
                    <th className="pb-3 font-normal">IP Address</th>
                    <th className="pb-3 font-normal">Requests</th>
                    <th className="pb-3 font-normal">Threat Score</th>
                    <th className="pb-3 font-normal">Status</th>
                    <th className="pb-3 font-normal">Endpoints</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {analysis.ipAnalysis.map((ip, idx) => (
                    <tr key={idx}>
                      <td className="py-3 font-mono text-xs">{ip.ip}</td>
                      <td className="py-3">{ip.requestCount}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden max-w-[80px]">
                            <div className="h-full bg-red-500" style={{ width: `${ip.threatScore}%` }} />
                          </div>
                          <span className="font-mono text-xs w-6">{ip.threatScore}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        {ip.isTorExit && <span className="text-xs px-2 py-px bg-purple-950 text-purple-400 rounded">Tor</span>}
                      </td>
                      <td className="py-3 text-xs text-zinc-400">{ip.endpoints?.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
