import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { z } from 'zod';
import { logger } from '@/lib/logger/winston';
import { getErrorMessage } from '@/lib/utils/errors';

const updateSchema = z.object({
  isRead: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ data: null, error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyAccessToken(token);

    const alert = await prisma.alert.findFirst({
      where: { id, userId: payload.userId },
    });

    if (!alert) {
      return NextResponse.json({ data: null, error: 'Not found', status: 404 }, { status: 404 });
    }

    const body = await request.json();
    const validated = updateSchema.parse(body);

    await prisma.alert.update({
      where: { id },
      data: validated,
    });

    return NextResponse.json({ data: { success: true }, error: null, status: 200 });
  } catch (error) {
    logger.error('Failed to update alert', { error: getErrorMessage(error) });
    return NextResponse.json({ data: null, error: 'Failed to update alert', status: 500 }, { status: 500 });
  }
}
