import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/session';
import { z } from 'zod';
import { logger } from '@/lib/logger/winston';
import { checkRateLimit } from '@/lib/security/rateLimiter';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    const rateCheck = await checkRateLimit(ip, 'auth');
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { data: null, error: 'Too many registration attempts', status: 429 },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validated = registerSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { data: null, error: 'Email already registered', status: 409 },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(validated.password);

    const user = await prisma.user.create({
      data: {
        email: validated.email,
        passwordHash,
        name: validated.name || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'REGISTER',
        resource: 'User',
        resourceId: user.id,
        ipAddress: ip,
      },
    });

    logger.info('User registered successfully', { userId: user.id, email: user.email });

    return NextResponse.json({
      data: { user },
      error: null,
      status: 201,
    }, { status: 201 });
  } catch (error: any) {
    logger.error('Registration failed', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { data: null, error: 'Invalid input', status: 400 },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { data: null, error: 'Registration failed', status: 500 },
      { status: 500 }
    );
  }
}
