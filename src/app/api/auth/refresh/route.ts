import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken } from '@/lib/auth/session';
import { logger } from '@/lib/logger/winston';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { getClientIp } from '@/lib/security/getClientIp';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const rateCheck = await checkRateLimit(ip, 'auth');
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { data: null, error: 'Too many refresh attempts', status: 429 },
        { status: 429 }
      );
    }

    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { data: null, error: 'No refresh token provided', status: 401 },
        { status: 401 }
      );
    }

    // refreshAccessToken: hash-compares the token, checks expiresAt + revokedAt,
    // revokes the old token, runs family-reuse detection, and returns a new
    // accessToken + refreshToken. Throws on invalid/expired/revoked/steal.
    const result = await refreshAccessToken(refreshToken);

    const response = NextResponse.json({
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      error: null,
      status: 200,
    });

    // Rotate the httpOnly cookie to the new refresh token. Same flags as login.
    response.cookies.set('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: any) {
    logger.warn('Refresh token rejected', { error: error.message });

    // All refresh failures (invalid, expired, family-reuse trip) result in
    // clearing the cookie so the client falls back to login.
    const response = NextResponse.json(
      { data: null, error: 'Invalid or expired refresh token', status: 401 },
      { status: 401 }
    );
    response.cookies.delete('refreshToken');
    return response;
  }
}
