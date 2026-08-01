import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { z } from 'zod';
import { logger } from '@/lib/logger/winston';
import { getErrorMessage } from '@/lib/utils/errors';

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  isArchived: z.boolean().optional(),
});

export async function GET(
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

    const session = await prisma.logSession.findFirst({
      where: { id, userId: payload.userId },
      include: {
        alerts: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        ipRecords: true,
      },
    });

    if (!session) {
      return NextResponse.json({ data: null, error: 'Session not found', status: 404 }, { status: 404 });
    }

    return NextResponse.json({ data: { session }, error: null, status: 200 });
  } catch (error) {
    logger.error('Failed to fetch session', { error });
    return NextResponse.json({ data: null, error: 'Failed to fetch session', status: 500 }, { status: 500 });
  }
}

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

    const body = await request.json();
    const validated = updateSchema.parse(body);

    const session = await prisma.logSession.updateMany({
      where: { id, userId: payload.userId },
      data: validated,
    });

    if (session.count === 0) {
      return NextResponse.json({ data: null, error: 'Session not found', status: 404 }, { status: 404 });
    }

    return NextResponse.json({ data: { success: true }, error: null, status: 200 });
  } catch (error) {
    logger.error('Failed to update session', { error: getErrorMessage(error) });
    return NextResponse.json({ data: null, error: 'Update failed', status: 500 }, { status: 500 });
  }
}

export async function DELETE(
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

    await prisma.logSession.deleteMany({
      where: { id, userId: payload.userId },
    });

    return NextResponse.json({ data: { success: true }, error: null, status: 200 });
  } catch (error) {
    logger.error('Failed to delete session', { error: getErrorMessage(error) });
    return NextResponse.json({ data: null, error: 'Delete failed', status: 500 }, { status: 500 });
  }
}
