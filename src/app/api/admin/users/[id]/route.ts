import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, unauthorized, isAdmin, forbidden } from '@/lib/auth/requireAuth';
import { z } from 'zod';
import { logger } from '@/lib/logger/winston';
import { getClientIp } from '@/lib/security/getClientIp';
import { getErrorMessage } from '@/lib/utils/errors';

// Admin-only moderation endpoint. Never lets an admin lock themselves out of
// the last admin account, and immediately revokes all refresh tokens on ban so
// the banned user's sessions die within one access-token TTL.

const schema = z.object({
  role: z.enum(['ANALYST', 'ADMIN', 'VIEWER']).optional(),
  isBanned: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await requireAuth(request);
    if (!payload) return unauthorized();
    if (!isAdmin(payload)) return forbidden('Admin access required');

    const { id } = await params;
    const body = await request.json();
    const validated = schema.parse(body);

    if (Object.keys(validated).length === 0) {
      return NextResponse.json(
        { data: null, error: 'Nothing to update', status: 400 },
        { status: 400 },
      );
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json(
        { data: null, error: 'User not found', status: 404 },
        { status: 404 },
      );
    }

    const isSelf = payload.userId === id;

    // Lockout guards — never let an action remove the last functioning admin.
    const demotesSelf = isSelf && validated.role && validated.role !== 'ADMIN';
    const bansSelf = isSelf && validated.isBanned === true;
    if (demotesSelf || bansSelf) {
      return NextResponse.json(
        { data: null, error: 'You cannot demote or ban your own account', status: 400 },
        { status: 400 },
      );
    }
    const demotesTarget = validated.role && target.role === 'ADMIN' && validated.role !== 'ADMIN';
    const bansTarget = validated.isBanned === true && target.role === 'ADMIN';
    if (demotesTarget || bansTarget) {
      const otherAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isBanned: false, id: { not: id } },
      });
      if (otherAdmins === 0) {
        return NextResponse.json(
          { data: null, error: 'Cannot remove the last active admin', status: 400 },
          { status: 400 },
        );
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: validated,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        isBanned: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    // Banning must kill live sessions immediately, not wait for the natural
    // 30-day refresh-token expiry.
    if (validated.isBanned === true) {
      await prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: validated.isBanned === true ? 'USER_BANNED' : 'USER_UPDATED',
        resource: 'User',
        resourceId: id,
        ipAddress: getClientIp(request),
        metadata: validated,
      },
    });

    logger.info('Admin updated user', {
      adminId: payload.userId,
      targetUserId: id,
      changes: validated,
    });

    return NextResponse.json({ data: { user }, error: null, status: 200 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { data: null, error: 'Invalid input', status: 400 },
        { status: 400 },
      );
    }
    logger.error('Admin user update failed', { error: getErrorMessage(error) });
    return NextResponse.json(
      { data: null, error: 'Update failed', status: 500 },
      { status: 500 },
    );
  }
}
