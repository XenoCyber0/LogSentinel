import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the provider layer so tests never hit a network / real AI provider.
vi.mock('./provider', () => {
  class AIProviderError extends Error {
    constructor(
      message: string,
      readonly status?: number,
      readonly provider?: string,
    ) {
      super(message);
      this.name = 'AIProviderError';
    }
  }

  return {
    AIProviderError,
    getAIProvider: vi.fn(),
  };
});

import {
  analyzeLog,
  detectLogFormatLocally,
  resolveFinalLogFormat,
} from './analyzer';
import { AIProviderError, getAIProvider } from './provider';

const mockedGetProvider = vi.mocked(getAIProvider);

const okAnalysisJson = JSON.stringify({
  summary: 'No threats detected.',
  severity: 'INFO',
  logFormat: 'NGINX',
  timeRange: { start: '2026-08-02T00:00:00Z', end: '2026-08-02T01:00:00Z' },
  totalLines: 10,
  threats: [],
  ipAnalysis: [],
  timeline: [],
  recommendations: ['Keep monitoring'],
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Local format detection (the mixed-paste regression)
// ---------------------------------------------------------------------------
describe('detectLogFormatLocally', () => {
  it('classifies pure nginx access logs', () => {
    const log = `10.0.0.1 - - [02/Aug/2026:03:00:01 +0000] "GET /index.html HTTP/1.1" 200 1024
10.0.0.2 - - [02/Aug/2026:03:00:02 +0000] "POST /api/login HTTP/1.1" 401 233
10.0.0.1 - - [02/Aug/2026:03:00:03 +0000] "GET /admin HTTP/1.1" 403 89`;
    expect(detectLogFormatLocally(log)).toBe('NGINX');
  });

  it('classifies auth.log with sshd markers despite syslog prefix', () => {
    const log = `Dec 10 06:55:46 server02 sshd[26443]: Invalid user service-account from 198.51.100.55 port 49231 ssh2
Dec 10 06:55:48 server02 sshd[26445]: Invalid user support from 198.51.100.55 port 49238 ssh2
Dec 10 06:55:50 server02 sshd[26447]: Failed password for invalid user service-account from 198.51.100.55 port 49231 ssh2`;
    expect(detectLogFormatLocally(log)).toBe('AUTH');
  });

  it('classifies generic syslog', () => {
    const log = `Dec 10 06:55:46 server01 cron[1060]: (root) CMD (run-parts /etc/cron.hourly)
Dec 10 06:56:12 server01 systemd[1]: Started Daily apt upgrade and clean activities.
Dec 10 06:57:01 server01 kernel: [UFW BLOCK] IN=eth0 OUT= SRC=203.0.113.9`;
    expect(detectLogFormatLocally(log)).toBe('SYSLOG');
  });

  it('classifies docker json-file driver logs', () => {
    const log = `{"log":"listening on :8080\\n","stream":"stdout","time":"2026-08-02T03:35:05.1Z"}
{"log":"GET /health 200\\n","stream":"stdout","time":"2026-08-02T03:35:06.1Z"}
{"log":"GET / 404\\n","stream":"stdout","time":"2026-08-02T03:35:07.1Z"}`;
    expect(detectLogFormatLocally(log)).toBe('DOCKER');
  });

  it('classifies Windows/Sysmon style logs as APP', () => {
    const log = `EventID: 4688
Process Create:
Image: C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe
CommandLine: powershell.exe -ExecutionPolicy Bypass -File C:\\Users\\Public\\update.ps1
NewProcessId: 0x1bc4`;
    expect(detectLogFormatLocally(log)).toBe('APP');
  });

  it('classifies ISO-timestamped level app logs as APP', () => {
    const log = `2026-08-02T13:11:14.000Z ERROR Upload failed for /var/www/uploads
2026-08-02T13:12:30.000Z INFO Cache updated for user 9042
2026-08-02T13:13:00.000Z WARN Slow query 1200ms`;
    expect(detectLogFormatLocally(log)).toBe('APP');
  });

  it('recovers from genuinely mixed pastes via strict majority', () => {
    const mixed = `203.0.113.42 - - [02/Aug/2026:03:34:10 +0000] "GET /products.php?id=SELECT%20* HTTP/1.1" 200 532
198.51.100.55 - - [02/Aug/2026:03:34:11 +0000] "POST /admin/login.php HTTP/1.1" 401 221
203.0.113.42 - - [02/Aug/2026:03:34:12 +0000] "GET /uploads/test_script.php HTTP/1.1" 404 152
GET /products.php?id=SELECT%20* HTTP/1.1
Invalid user service-account from 198.51.100.55 port 49231 ssh2
Invalid user support from 198.51.100.55 port 49238 ssh2
powershell.exe -ExecutionPolicy Bypass -File C:\\Users\\Public\\update.ps1`;
    expect(detectLogFormatLocally(mixed)).toBe('NGINX');
  });

  it('returns UNKNOWN with no strict majority (honest fallback)', () => {
    const tie = `10.0.0.1 - - [02/Aug/2026:03:00:01 +0000] "GET /a HTTP/1.1" 200 1
Dec 10 06:55:46 srv sshd[1]: Invalid user x from 1.1.1.1 port 22 ssh2
powershell.exe -ExecutionPolicy Bypass -File C:\\a.ps1
2026-08-02T03:00:01.000Z ERROR something happened`;
    // NGINX 1, AUTH 1, APP 2 → 2/4 is not > 0.5
    expect(detectLogFormatLocally(tie)).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for empty or unclassifiable input', () => {
    expect(detectLogFormatLocally('')).toBe('UNKNOWN');
    expect(detectLogFormatLocally('foo\nbar\nbaz')).toBe('UNKNOWN');
  });

  it('caps the scan so huge pastes stay fast', () => {
    const line = '10.0.0.1 - - [02/Aug/2026:03:00:01 +0000] "GET / HTTP/1.1" 200 1\n';
    const log = line.repeat(5000); // 5000 lines, cap is 2000
    expect(detectLogFormatLocally(log)).toBe('NGINX');
  });
});

// ---------------------------------------------------------------------------
// Final verdict resolution (AI + local)
// ---------------------------------------------------------------------------
describe('resolveFinalLogFormat', () => {
  const threeNginxLines = `10.0.0.1 - - [02/Aug/2026:03:00:01 +0000] "GET / HTTP/1.1" 200 1
10.0.0.1 - - [02/Aug/2026:03:00:02 +0000] "GET /b HTTP/1.1" 404 2
10.0.0.1 - - [02/Aug/2026:03:00:03 +0000] "POST /login HTTP/1.1" 401 3`;

  it('trusts the AI when local is undecided', () => {
    const prose = 'just some\nrandom prose\nno log shapes here';
    expect(resolveFinalLogFormat('AUTH', prose)).toBe('AUTH');
  });

  it('takes the local verdict when AI punted', () => {
    expect(resolveFinalLogFormat('UNKNOWN', threeNginxLines)).toBe('NGINX');
  });

  it('never overrides a confident AI on disagreement', () => {
    expect(resolveFinalLogFormat('APP', threeNginxLines)).toBe('APP');
  });
});

// ---------------------------------------------------------------------------
// Payload sizing — Groq HTTP 413 regression
// ---------------------------------------------------------------------------
describe('analyzeLog payload sizing', () => {
  it('passes the full log when it fits under the provider cap', async () => {
    let sentUser = '';
    mockedGetProvider.mockReturnValue({
      maxInputTokens: 6000,
      complete: vi.fn(async (req: { user: string }) => {
        sentUser = req.user;
        return okAnalysisJson;
      }),
    } as unknown as ReturnType<typeof getAIProvider>);

    const log = 'short log line '.repeat(50); // ~750 chars
    const result = await analyzeLog(log);
    expect(sentUser).toContain(log.trim());
    expect(result.summary).toBe('No threats detected.');
  });

  it('truncates to provider.maxInputTokens × 2.2 chars when larger', async () => {
    let sentUser = '';
    mockedGetProvider.mockReturnValue({
      maxInputTokens: 1000, // → maxChars = 2200
      complete: vi.fn(async (req: { user: string }) => {
        sentUser = req.user;
        return okAnalysisJson;
      }),
    } as unknown as ReturnType<typeof getAIProvider>);

    const longLine = 'a'.repeat(200);
    const log = Array.from({ length: 200 }, () => longLine).join('\n'); // 40k chars
    expect(log.length).toBeGreaterThan(2200);

    await analyzeLog(log);

    // Trailing content preserved (recent events), head cut, marker present
    expect(sentUser.length).toBeLessThan(3000);
    expect(sentUser).toContain('Log truncated');
    expect(sentUser).toContain('token budget');
    expect(sentUser.endsWith(longLine)).toBe(true); // tail kept
  });

  it('does not truncate when provider has no cap (Anthropic-style)', async () => {
    let sentUser = '';
    mockedGetProvider.mockReturnValue({
      maxInputTokens: undefined,
      complete: vi.fn(async (req: { user: string }) => {
        sentUser = req.user;
        return okAnalysisJson;
      }),
    } as unknown as ReturnType<typeof getAIProvider>);

    const log = 'x'.repeat(110000); // just under the 120000 cap
    await analyzeLog(log);
    expect(sentUser).not.toContain('Log truncated');
  });

  it('surfaces auth/config errors verbatim (not wrapped as "analysis failed")', async () => {
    mockedGetProvider.mockReturnValue({
      complete: vi.fn(async () => {
        throw new AIProviderError('OpenAI-compatible request failed (413 ): {}', 413, 'openai-compatible');
      }),
    } as unknown as ReturnType<typeof getAIProvider>);

    await expect(analyzeLog('some log content here')).rejects.toThrow(/openai-compatible.*413|HTTP 413/);
  });
});
