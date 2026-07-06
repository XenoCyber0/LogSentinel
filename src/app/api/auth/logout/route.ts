import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger/winston';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (refreshToken) {
      // Revoke the refresh token
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      
      await prisma.refreshToken.updateMany({
        where: { token: tokenHash },
        data: { revokedAt: new Date() },
      });
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
