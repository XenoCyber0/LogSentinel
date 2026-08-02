import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma, Severity, LogFormat } from '@prisma/client';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { analyzeLog } from '@/lib/ai/analyzer';
import { logger } from '@/lib/logger/winston';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { getClientIp } from '@/lib/security/getClientIp';
import { getErrorMessage } from '@/lib/utils/errors';
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
    const ip = getClientIp(request);

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

    const body = await request.json().catch(() => ({}));
    const validated = analyzeSchema.parse(body);

    // Return cached analysis unless the client explicitly requests a re-run
    // via { force: true }. (The previous `!request.body` check was dead code
    // — request.body is a ReadableStream that is always truthy.)
    //
    // Fallback-shape results (written by older builds before auth/config errors
    // were distinguished from real ones) must NOT be reused — they're the "AI
    // Threat Summary: Analysis failed" payload that made the product look
    // broken, and they were erroneously stamped analyzedAt. Detect by the
    // duplicate severity/logFormat=UNKNOWN plus empty threat list.
    const cached = session.analysis as {
      severity?: string;
      logFormat?: string;
      threats?: unknown[];
    } | null;
    const isCachedFallback =
      cached != null &&
      cached.severity === 'UNKNOWN' &&
      cached.logFormat === 'UNKNOWN' &&
      Array.isArray(cached.threats) &&
      cached.threats.length === 0;
    if (session.analysis && !validated.force && !isCachedFallback) {
      return NextResponse.json({ data: { analysis: session.analysis }, error: null, status: 200 });
    }

    const analysis = await analyzeLog(session.rawLog);

    await prisma.logSession.update({
      where: { id },
      data: {
        analysis: analysis as unknown as Prisma.InputJsonValue,
        severity: analysis.severity as Severity,
        logFormat: analysis.logFormat as LogFormat,
        analyzedAt: new Date(),
      },
    });

    // Create alerts from threats
    if (analysis.threats.length > 0) {
      // Clear previous alerts so re-analysis does not stack duplicates.
      await prisma.alert.deleteMany({ where: { sessionId: id } });

      const alerts = analysis.threats.map((threat) => ({
        sessionId: id,
        userId: payload.userId,
        type: 'ANOMALY' as const,
        severity: threat.severity as Severity,
        title: threat.title,
        description: threat.description,
        metadata: { evidence: threat.evidence, recommendation: threat.recommendation },
      }));

      await prisma.alert.createMany({ data: alerts });
    }

    // Create IP records
    if (analysis.ipAnalysis.length > 0) {
      // Clear previous IP records so re-analysis does not stack duplicates.
      await prisma.iPRecord.deleteMany({ where: { sessionId: id } });

      const ipRecords = analysis.ipAnalysis.map((ipData) => ({
        sessionId: id,
        ipAddress: ipData.ip,
        requestCount: ipData.requestCount,
        threatScore: ipData.threatScore,
        isTorExit: ipData.isTorExit,
        endpoints: ipData.endpoints,
        statusCodes: ipData.statusCodes as Prisma.InputJsonValue,
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
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    logger.error('Analysis failed', { error: message, sessionId: request.nextUrl.pathname });
    // Analyzer now throws on ALL failure paths with a rich message that names
    // the provider, status, and reason. Pass the whole thing through — the
    // analyst always needs to see the actual diagnosis to fix it.
    return NextResponse.json(
      { data: null, error: message, status: 500 },
      { status: 500 },
    );
  }
}
