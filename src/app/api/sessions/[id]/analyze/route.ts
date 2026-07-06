import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { analyzeLog } from '@/lib/ai/analyzer';
import { logger } from '@/lib/logger/winston';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { z } from 'zod';

const analyzeSchema = z.object({
  force: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    const rateCheck = await checkRateLimit(ip, 'user');
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { data: null, error: 'AI analysis rate limit exceeded (1000/hour)', status: 429 },
        { status: 429 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ data: null, error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyAccessToken(token);

    const session = await prisma.logSession.findFirst({
      where: { id, userId: payload.userId },
    });

    if (!session) {
      return NextResponse.json({ data: null, error: 'Session not found', status: 404 }, { status: 404 });
    }

    if (session.analyzedAt && !request.body) {
      return NextResponse.json({ data: { analysis: session.analysis }, error: null, status: 200 });
    }

    const body = await request.json().catch(() => ({}));
    const validated = analyzeSchema.parse(body);

    if (session.analysis && !validated.force) {
      return NextResponse.json({ data: { analysis: session.analysis }, error: null, status: 200 });
    }

    const analysis = await analyzeLog(session.rawLog);

    await prisma.logSession.update({
      where: { id },
      data: {
        analysis: analysis as any,
        severity: analysis.severity as any,
        logFormat: analysis.logFormat as any,
        analyzedAt: new Date(),
      },
    });

    // Create alerts from threats
    if (analysis.threats.length > 0) {
      const alerts = analysis.threats.map((threat) => ({
        sessionId: id,
        userId: payload.userId,
        type: 'ANOMALY' as const,
        severity: threat.severity as any,
        title: threat.title,
        description: threat.description,
        metadata: { evidence: threat.evidence, recommendation: threat.recommendation },
      }));

      await prisma.alert.createMany({ data: alerts });
    }

    // Create IP records
    if (analysis.ipAnalysis.length > 0) {
      const ipRecords = analysis.ipAnalysis.map((ipData) => ({
        sessionId: id,
        ipAddress: ipData.ip,
        requestCount: ipData.requestCount,
        threatScore: ipData.threatScore,
        isTorExit: ipData.isTorExit,
        endpoints: ipData.endpoints,
        statusCodes: ipData.statusCodes as any,
        firstSeen: new Date(),
        lastSeen: new Date(),
      }));

      await prisma.iPRecord.createMany({ data: ipRecords });
    }

    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'AI_ANALYSIS',
        resource: 'LogSession',
        resourceId: id,
        ipAddress: ip,
      },
    });

    logger.info('AI analysis completed', { sessionId: id, severity: analysis.severity });

    return NextResponse.json({ data: { analysis }, error: null, status: 200 });
  } catch (error: any) {
    logger.error('Analysis failed', { error: error.message });
    return NextResponse.json({ data: null, error: 'Analysis failed', status: 500 }, { status: 500 });
  }
}
