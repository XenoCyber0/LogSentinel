import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { logger } from '@/lib/logger/winston';
import { checkRateLimit } from '@/lib/security/rateLimiter';

const createSessionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  rawLog: z.string().min(10).max(5 * 1024 * 1024),
  tags: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ data: null, error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyAccessToken(token);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;

    const sessions = await prisma.logSession.findMany({
      where: { userId: payload.userId, isArchived: false },
      select: {
        id: true,
        title: true,
        description: true,
        severity: true,
        logFormat: true,
        fileSize: true,
        analyzedAt: true,
        createdAt: true,
        tags: true,
        _count: {
          select: { alerts: true, ipRecords: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.logSession.count({
      where: { userId: payload.userId, isArchived: false },
    });

    return NextResponse.json({
      data: { sessions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
      error: null,
      status: 200,
    });
  } catch (error) {
    logger.error('Failed to fetch sessions', { error });
    return NextResponse.json({ data: null, error: 'Failed to fetch sessions', status: 500 }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateCheck = await checkRateLimit(ip, 'user');
    if (!rateCheck.allowed) {
      return NextResponse.json({ data: null, error: 'Rate limit exceeded', status: 429 }, { status: 429 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ data: null, error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyAccessToken(token);

    const body = await request.json();
    const validated = createSessionSchema.parse(body);

    const session = await prisma.logSession.create({
      data: {
        userId: payload.userId,
        title: validated.title,
        description: validated.description,
        rawLog: validated.rawLog,
        tags: validated.tags || [],
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'CREATE_SESSION',
        resource: 'LogSession',
        resourceId: session.id,
        ipAddress: ip,
      },
    });

    logger.info('Log session created', { userId: payload.userId, sessionId: session.id });

    return NextResponse.json({
      data: { session },
      error: null,
      status: 201,
    }, { status: 201 });
  } catch (error: any) {
    logger.error('Failed to create session', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ data: null, error: 'Invalid input', status: 400 }, { status: 400 });
    }
    
    return NextResponse.json({ data: null, error: 'Failed to create session', status: 500 }, { status: 500 });
  }
}
