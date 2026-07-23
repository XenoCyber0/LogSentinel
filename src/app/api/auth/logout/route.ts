import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger/winston';
import { createHash } from 'crypto';
import { getClientIp } from '@/lib/security/getClientIp';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || '';
    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (refreshToken) {
      // Revoke the refresh token
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

      const existing = await prisma.refreshToken.findUnique({
        where: { token: tokenHash },
        select: { id: true, userId: true },
      });

      await prisma.refreshToken.updateMany({
        where: { token: tokenHash },
        data: { revokedAt: new Date() },
      });

      // Audit-log the logout if we could identify the user.
      if (existing) {
        await prisma.auditLog.create({
          data: {
            userId: existing.userId,
            action: 'LOGOUT',
            resource: 'User',
            resourceId: existing.userId,
            ipAddress: ip,
            userAgent,
          },
        });
      }
    }

    const response = NextResponse.json({
      data: { success: true },
      error: null,
      status: 200,
    });

    response.cookies.delete('refreshToken');

    return response;
  } catch (error: any) {
    logger.error('Logout failed', { error: error.message });
    return NextResponse.json(
      { data: null, error: 'Logout failed', status: 500 },
      { status: 500 }
    );
  }
}
