import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword, createUserSession } from '@/lib/auth/session';
import { z } from 'zod';
import { logger } from '@/lib/logger/winston';
import { checkRateLimit } from '@/lib/security/rateLimiter';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    const rateCheck = await checkRateLimit(ip, 'auth');
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { data: null, error: 'Too many login attempts', status: 429 },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validated = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user || user.isBanned) {
      return NextResponse.json(
        { data: null, error: 'Invalid credentials', status: 401 },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(validated.password, user.passwordHash);

    if (!isValidPassword) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_FAILED',
          resource: 'User',
          resourceId: user.id,
          ipAddress: ip,
          userAgent,
        },
      });
      
      return NextResponse.json(
        { data: null, error: 'Invalid credentials', status: 401 },
        { status: 401 }
      );
    }

    const session = await createUserSession(user.id, userAgent, ip);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        resource: 'User',
        resourceId: user.id,
        ipAddress: ip,
        userAgent,
      },
    });

    logger.info('User logged in', { userId: user.id });

    const response = NextResponse.json({
      data: {
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      },
      error: null,
      status: 200,
    });

    // Set secure httpOnly cookie for refresh token
    response.cookies.set('refreshToken', session.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: any) {
    logger.error('Login failed', { error: error.message });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { data: null, error: 'Invalid input', status: 400 },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { data: null, error: 'Login failed', status: 500 },
      { status: 500 }
    );
  }
}
