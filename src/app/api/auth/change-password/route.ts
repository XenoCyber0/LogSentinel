import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword, hashPassword } from '@/lib/auth/session';
import { requireAuth, unauthorized } from '@/lib/auth/requireAuth';
import { z } from 'zod';
import { logger } from '@/lib/logger/winston';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { getClientIp } from '@/lib/security/getClientIp';
import { getErrorMessage } from '@/lib/utils/errors';

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const payload = await requireAuth(request);
    if (!payload) return unauthorized();

    const rateCheck = await checkRateLimit(payload.userId, 'auth');
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { data: null, error: 'Too many password attempts', status: 429 },
        { status: 429 },
      );
    }

    const body = await request.json();
    const validated = schema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) return unauthorized();

    const valid = await verifyPassword(validated.currentPassword, user.passwordHash);
    if (!valid) {
      // Audit the failed attempt so a password-spray attack shows up in the log
      // even though it never touches an account.
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_CHANGE_FAILED',
          resource: 'User',
          resourceId: user.id,
          ipAddress: getClientIp(request),
        },
      });
      return NextResponse.json(
        { data: null, error: 'Current password is incorrect', status: 400 },
        { status: 400 },
      );
    }

    const newHash = await hashPassword(validated.newPassword);

    // Update password and revoke every refresh token — any other device/session
    // stays signed in until its access token expires (max 15m), so a stolen
    // session can't linger after a legit user rotates their credential.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_CHANGED',
          resource: 'User',
          resourceId: user.id,
          ipAddress: getClientIp(request),
        },
      }),
    ]);

    logger.info('Password changed, sessions revoked', { userId: user.id });

    return NextResponse.json(
      { data: { success: true }, error: null, status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { data: null, error: 'New password must be at least 8 characters', status: 400 },
        { status: 400 },
      );
    }
    logger.error('Password change failed', { error: getErrorMessage(error) });
    return NextResponse.json(
      { data: null, error: 'Password change failed', status: 500 },
      { status: 500 },
    );
  }
}
