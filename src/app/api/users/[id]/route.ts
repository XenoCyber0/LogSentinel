import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, unauthorized } from '@/lib/auth/requireAuth';
import { z } from 'zod';
import { logger } from '@/lib/logger/winston';
import { getClientIp } from '@/lib/security/getClientIp';
import { getErrorMessage } from '@/lib/utils/errors';

// PATCH is *not* admin-only in the URL layout because /users/[id] is the natural
// "update my own profile" endpoint. Admin-level changes (role, ban) live under
// /api/admin/users/[id]. Here users can only touch their own row, and only fields
// that are safe (name — never email/password/role/isBanned).

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await requireAuth(request);
    if (!payload) return unauthorized();

    const { id } = await params;
    if (payload.userId !== id) {
      return NextResponse.json(
        { data: null, error: 'Cannot modify another user', status: 403 },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validated = schema.parse(body);

    if (Object.keys(validated).length === 0) {
      return NextResponse.json(
        { data: null, error: 'Nothing to update', status: 400 },
        { status: 400 },
      );
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
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: id,
        action: 'PROFILE_UPDATED',
        resource: 'User',
        resourceId: id,
        ipAddress: getClientIp(request),
        metadata: validated,
      },
    });

    return NextResponse.json({ data: { user }, error: null, status: 200 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { data: null, error: 'Invalid input', status: 400 },
        { status: 400 },
      );
    }
    logger.error('Profile update failed', { error: getErrorMessage(error) });
    return NextResponse.json(
      { data: null, error: 'Profile update failed', status: 500 },
      { status: 500 },
    );
  }
}
