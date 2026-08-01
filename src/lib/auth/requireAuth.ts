import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, type JWTPayload } from '@/lib/auth/jwt';
import { logger } from '@/lib/logger/winston';
import { getErrorMessage } from '@/lib/utils/errors';

/**
 * Verifies the Bearer access token and returns the decoded payload.
 * Returns null (after setting the 401 on the return value) when invalid/missing.
 */
export async function requireAuth(request: NextRequest): Promise<JWTPayload | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  try {
    return await verifyAccessToken(token);
  } catch (error) {
    logger.warn('Invalid access token', { error: getErrorMessage(error) });
    return null;
  }
}

export function unauthorized() {
  return NextResponse.json({ data: null, error: 'Unauthorized', status: 401 }, { status: 401 });
}

export function isAdmin(payload: JWTPayload) {
  return payload.role === 'ADMIN';
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ data: null, error: message, status: 403 }, { status: 403 });
}
