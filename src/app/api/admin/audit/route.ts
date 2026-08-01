import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, unauthorized, isAdmin, forbidden } from '@/lib/auth/requireAuth';
import type { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger/winston';
import { getErrorMessage } from '@/lib/utils/errors';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireAuth(request);
    if (!payload) return unauthorized();
    if (!isAdmin(payload)) return forbidden('Admin access required');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 100);
    const action = searchParams.get('action')?.trim();
    const q = searchParams.get('q')?.trim();

    const where: Prisma.AuditLogWhereInput = {};
    if (action) where.action = action;
    if (q) {
      where.OR = [
        { resource: { contains: q, mode: 'insensitive' } },
        { ipAddress: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        logs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
      error: null,
      status: 200,
    });
  } catch (error) {
    logger.error('Failed to list audit logs', { error: getErrorMessage(error) });
    return NextResponse.json(
      { data: null, error: 'Failed to list audit logs', status: 500 },
      { status: 500 },
    );
  }
}
