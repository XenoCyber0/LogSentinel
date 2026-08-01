import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, unauthorized, isAdmin, forbidden } from '@/lib/auth/requireAuth';
import { logger } from '@/lib/logger/winston';
import { getErrorMessage } from '@/lib/utils/errors';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireAuth(request);
    if (!payload) return unauthorized();
    if (!isAdmin(payload)) return forbidden('Admin access required');

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        isBanned: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        _count: {
          select: { sessions: true, alerts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return NextResponse.json({ data: { users }, error: null, status: 200 });
  } catch (error) {
    logger.error('Failed to list users', { error: getErrorMessage(error) });
    return NextResponse.json(
      { data: null, error: 'Failed to list users', status: 500 },
      { status: 500 },
    );
  }
}
