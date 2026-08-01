import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, unauthorized } from '@/lib/auth/requireAuth';
import type { Prisma, Severity, AlertType } from '@prisma/client';
import { logger } from '@/lib/logger/winston';
import { getErrorMessage } from '@/lib/utils/errors';

const SEVERITIES: readonly Severity[] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
  'UNKNOWN',
];
const ALERT_TYPES: readonly AlertType[] = [
  'BRUTE_FORCE',
  'SUSPICIOUS_IP',
  'SQL_INJECTION',
  'PATH_TRAVERSAL',
  'PRIVILEGE_ESCALATION',
  'ANOMALY',
  'RATE_LIMIT',
  'UNKNOWN',
];
const READ_STATES = new Set(['all', 'unread', 'read']);

export async function GET(request: NextRequest) {
  try {
    const payload = await requireAuth(request);
    if (!payload) return unauthorized();

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');
    const read = searchParams.get('read') ?? 'all';
    const q = searchParams.get('q')?.trim();

    // Dismissed alerts never surface in the main feed — they were explicitly
    // cleared by the analyst and there's no "dismissed" view yet.
    const where: Prisma.AlertWhereInput = { userId: payload.userId, isDismissed: false };

    if (severity && (SEVERITIES as readonly string[]).includes(severity)) {
      where.severity = severity as Severity;
    }
    if (type && (ALERT_TYPES as readonly string[]).includes(type)) {
      where.type = type as AlertType;
    }
    if (READ_STATES.has(read)) {
      if (read === 'unread') where.isRead = false;
      else if (read === 'read') where.isRead = true;
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { ipAddress: { contains: q, mode: 'insensitive' } },
      ];
    }

    const alerts = await prisma.alert.findMany({
      where,
      include: { session: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ data: { alerts }, error: null, status: 200 });
  } catch (error) {
    logger.error('Failed to fetch alerts', { error: getErrorMessage(error) });
    return NextResponse.json(
      { data: null, error: 'Failed to fetch alerts', status: 500 },
      { status: 500 },
    );
  }
}
