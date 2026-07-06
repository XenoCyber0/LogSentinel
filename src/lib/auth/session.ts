import { prisma } from '@/lib/db/prisma';
import { signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken } from './jwt';
import { JWTPayload } from './jwt';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger/winston';

const BCRYPT_COST = 12;
const MAX_ACTIVE_SESSIONS = 5;
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUserSession(userId: string, userAgent?: string, ipAddress?: string) {
  // Clean up old sessions if needed
  const existingTokens = await prisma.refreshToken.count({
    where: { userId, revokedAt: null },
  });

  if (existingTokens >= MAX_ACTIVE_SESSIONS) {
    // Revoke oldest token
    const oldest = await prisma.refreshToken.findFirst({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    
    if (oldest) {
      await prisma.refreshToken.update({
        where: { id: oldest.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);

  const refreshRecord = await prisma.refreshToken.create({
    data: {
      token: tokenHash,
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      userAgent,
      ipAddress,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isVerified: true,
      isBanned: true,
    },
  });

  if (!user || user.isBanned) {
    throw new Error('User not found or banned');
  }

  const accessToken = await signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // Update last login
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    },
  });

  return {
    user,
    accessToken,
    refreshToken,
    refreshTokenId: refreshRecord.id,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);

  const record = await prisma.refreshToken.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new Error('Invalid or expired refresh token');
  }

  // Token rotation: invalidate old token immediately
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  // Check for token family abuse (reused rotated token)
  const recentRevoked = await prisma.refreshToken.count({
    where: {
      userId: record.userId,
      revokedAt: { not: null },
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 5) }, // last 5 min
    },
  });

  if (recentRevoked > 3) {
    // Possible token theft - invalidate all tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    
    logger.warn('Token family invalidated due to reuse detection', {
      userId: record.userId,
    });
    
    throw new Error('Security violation: All sessions invalidated');
  }

  // Create new refresh token
  const newRefreshToken = generateRefreshToken();
  const newTokenHash = hashRefreshToken(newRefreshToken);

  await prisma.refreshToken.create({
    data: {
      token: newTokenHash,
      userId: record.userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      userAgent: record.userAgent,
      ipAddress: record.ipAddress,
    },
  });

  const accessToken = await signAccessToken({
    userId: record.user.id,
    email: record.user.email,
    role: record.user.role,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: record.user,
  };
}

export async function revokeSession(refreshTokenId: string, userId: string) {
  await prisma.refreshToken.updateMany({
    where: {
      id: refreshTokenId,
      userId,
    },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
