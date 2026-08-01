import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, unauthorized } from '@/lib/auth/requireAuth';
import { generateRefreshToken, hashRefreshToken } from '@/lib/auth/jwt';
import { logger } from '@/lib/logger/winston';
import { getClientIp } from '@/lib/security/getClientIp';
import { getErrorMessage } from '@/lib/utils/errors';

// Personal access tokens reuse the RefreshToken table. The `userAgent` column
// carries the "api-token:<name>" marker that distinguishes them from browser
// sessions. This avoids a schema migration while still giving us expiry +
// revocation for free. Tokens are shown exactly once (raw) and only the SHA-256
// hash is stored — same treatment as browser refresh tokens.

const API_TOKEN_PREFIX = 'api-token:';
const API_TOKEN_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

interface ApiTokenInfo {
  id: string;
  name: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
}

function toInfo(token: {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}): ApiTokenInfo {
  return {
    id: token.id,
    name: (token.userAgent ?? API_TOKEN_PREFIX).slice(API_TOKEN_PREFIX.length),
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    lastUsedAt: null, // refresh tokens don't track per-use; omitted for API tokens
  };
}

export async function GET(request: NextRequest) {
  try {
    const payload = await requireAuth(request);
    if (!payload) return unauthorized();

    const tokens = await prisma.refreshToken.findMany({
      where: {
        userId: payload.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        userAgent: { startsWith: API_TOKEN_PREFIX },
      },
      select: { id: true, userAgent: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      data: { tokens: tokens.map(toInfo) },
      error: null,
      status: 200,
    });
  } catch (error) {
    logger.error('Failed to list API tokens', { error: getErrorMessage(error) });
    return NextResponse.json(
      { data: null, error: 'Failed to load tokens', status: 500 },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await requireAuth(request);
    if (!payload) return unauthorized();

    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const name = (body.name ?? 'default').slice(0, 50).replace(/[^a-zA-Z0-9 _-]/g, '') || 'default';

    const raw = generateRefreshToken();
    const tokenHash = hashRefreshToken(raw);

    const record = await prisma.refreshToken.create({
      data: {
        token: tokenHash,
        userId: payload.userId,
        userAgent: `${API_TOKEN_PREFIX}${name}`,
        ipAddress: getClientIp(request),
        expiresAt: new Date(Date.now() + API_TOKEN_EXPIRY_MS),
      },
      select: { id: true, userAgent: true, createdAt: true, expiresAt: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'API_TOKEN_CREATED',
        resource: 'RefreshToken',
        resourceId: record.id,
        ipAddress: getClientIp(request),
      },
    });

    logger.info('API token issued', { userId: payload.userId, tokenId: record.id, name });

    // Return the raw token ONCE. It can never be recovered because we only store
    // the SHA-256 hash.
    return NextResponse.json(
      {
        data: { token: raw, info: toInfo(record) },
        error: null,
        status: 201,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error('Failed to create API token', { error: getErrorMessage(error) });
    return NextResponse.json(
      { data: null, error: 'Failed to create token', status: 500 },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await requireAuth(request);
    if (!payload) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { data: null, error: 'Missing token id', status: 400 },
        { status: 400 },
      );
    }

    // userId check ensures users can only revoke their own tokens
    const result = await prisma.refreshToken.updateMany({
      where: {
        id,
        userId: payload.userId,
        userAgent: { startsWith: API_TOKEN_PREFIX },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { data: null, error: 'Token not found', status: 404 },
        { status: 404 },
      );
    }

    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'API_TOKEN_REVOKED',
        resource: 'RefreshToken',
        resourceId: id,
        ipAddress: getClientIp(request),
      },
    });

    return NextResponse.json({ data: { success: true }, error: null, status: 200 });
  } catch (error) {
    logger.error('Failed to revoke API token', { error: getErrorMessage(error) });
    return NextResponse.json(
      { data: null, error: 'Failed to revoke token', status: 500 },
      { status: 500 },
    );
  }
}
