import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, unauthorized } from '@/lib/auth/requireAuth';
import { logger } from '@/lib/logger/winston';
import { getClientIp } from '@/lib/security/getClientIp';
import { getErrorMessage } from '@/lib/utils/errors';

// Server-side export so filters match the list APIs exactly, and so the raw
// download can be streamed with correct Content-Disposition headers (browser
// fetch + blob also works — that's what the UI buttons do). CSV cells are
// escaped against formula injection (=, +, -, @ prefixes) since analysts paste
// these exports into spreadsheets, where a hostile log line could otherwise
// execute.

const VALID_TYPES = ['sessions', 'alerts'] as const;
const VALID_FORMATS = ['csv', 'json'] as const;

type ExportType = (typeof VALID_TYPES)[number];
type ExportFormat = (typeof VALID_FORMATS)[number];

function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value);
  // Spreadsheet formula injection guard
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return '\uFEFF' + lines.join('\r\n'); // BOM so Excel opens as UTF-8
}

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'UNKNOWN'] as const;

export async function GET(request: NextRequest) {
  try {
    const payload = await requireAuth(request);
    if (!payload) return unauthorized();

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') ?? '') as ExportType;
    const format = (searchParams.get('format') ?? 'csv') as ExportFormat;

    if (!VALID_TYPES.includes(type) || !VALID_FORMATS.includes(format)) {
      return NextResponse.json(
        { data: null, error: 'Expected ?type=sessions|alerts&format=csv|json', status: 400 },
        { status: 400 },
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    let filename: string;
    let body: string;

    if (type === 'sessions') {
      // Mirror /api/sessions filters so the export matches what the user sees
      const where: { userId: string; isArchived: boolean; severity?: (typeof SEVERITIES)[number] } = {
        userId: payload.userId,
        isArchived: searchParams.get('archived') === 'true',
      };
      const severity = searchParams.get('severity');
      if (severity && (SEVERITIES as readonly string[]).includes(severity)) {
        where.severity = severity as (typeof SEVERITIES)[number];
      }

      const sessions = await prisma.logSession.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          severity: true,
          logFormat: true,
          fileSize: true,
          tags: true,
          analyzedAt: true,
          createdAt: true,
          _count: { select: { alerts: true, ipRecords: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5000, // hard cap so a huge account can't OOM the request
      });

      filename = `logsentinel-sessions-${stamp}.${format}`;
      if (format === 'json') {
        body = JSON.stringify(sessions, null, 2);
      } else {
        body = toCsv(
          ['id', 'title', 'description', 'severity', 'logFormat', 'fileSize', 'tags', 'alerts', 'ipRecords', 'analyzedAt', 'createdAt'],
          sessions.map((s) => [
            s.id,
            s.title,
            s.description,
            s.severity,
            s.logFormat,
            s.fileSize,
            s.tags.join(';'),
            s._count.alerts,
            s._count.ipRecords,
            s.analyzedAt?.toISOString() ?? '',
            s.createdAt.toISOString(),
          ]),
        );
      }
    } else {
      // Mirror /api/alerts filters
      const where: {
        userId: string;
        isDismissed: boolean;
        severity?: (typeof SEVERITIES)[number];
        isRead?: boolean;
      } = { userId: payload.userId, isDismissed: false };
      const severity = searchParams.get('severity');
      if (severity && (SEVERITIES as readonly string[]).includes(severity)) {
        where.severity = severity as (typeof SEVERITIES)[number];
      }
      const readParam = searchParams.get('read');
      if (readParam === 'true') where.isRead = true;
      else if (readParam === 'false') where.isRead = false;

      const alerts = await prisma.alert.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          severity: true,
          type: true,
          ipAddress: true,
          isRead: true,
          createdAt: true,
          session: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      });

      filename = `logsentinel-alerts-${stamp}.${format}`;
      if (format === 'json') {
        body = JSON.stringify(alerts, null, 2);
      } else {
        body = toCsv(
          ['id', 'title', 'description', 'severity', 'type', 'ipAddress', 'isRead', 'sessionTitle', 'sessionId', 'createdAt'],
          alerts.map((a) => [
            a.id,
            a.title,
            a.description,
            a.severity,
            a.type,
            a.ipAddress,
            a.isRead,
            a.session?.title ?? '',
            a.session?.id ?? '',
            a.createdAt.toISOString(),
          ]),
        );
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'EXPORT',
        resource: type === 'sessions' ? 'LogSession' : 'Alert',
        ipAddress: getClientIp(request),
        metadata: { type, format },
      },
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': format === 'json' ? 'application/json' : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('Export failed', { error: getErrorMessage(error) });
    return NextResponse.json(
      { data: null, error: 'Export failed', status: 500 },
      { status: 500 },
    );
  }
}
