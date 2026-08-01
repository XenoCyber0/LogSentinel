import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { logger } from '@/lib/logger/winston';
import { getErrorMessage } from '@/lib/utils/errors';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ data: null, error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyAccessToken(token);

    const alerts = await prisma.alert.findMany({
      where: { userId: payload.userId },
      include: { session: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ data: { alerts }, error: null, status: 200 });
  } catch (error) {
    logger.error('Failed to fetch alerts', { error: getErrorMessage(error) });
    return NextResponse.json({ data: null, error: 'Failed to fetch alerts', status: 500 }, { status: 500 });
  }
}
