import { RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '@/lib/logger/winston';

// NOTE: Limiters below are in-memory and per-process. They are NOT shared
// across instances — running multiple Node processes (or the standalone
// server behind a load balancer) will give each instance its own counter
// and the effective limit will be N * configured_limit. A previous version
// of this file tried to use `new Redis(UPSTASH_REDIS_REST_URL)` from ioredis
// to share state, but ioredis expects a TCP connection string and Upstash
// exposes an HTTPS REST API, so the connection failed silently and we fell
// back to in-memory anyway. To enable real distributed rate limiting, use
// @upstash/ratelimit with the existing UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN env vars once real Upstash credentials are
// provisioned.

const ipLimiter = new RateLimiterMemory({
  keyPrefix: 'ip',
  points: 100,
  duration: 60,
});

const userLimiter = new RateLimiterMemory({
  keyPrefix: 'user',
  points: 1000,
  duration: 3600,
});

const authLimiter = new RateLimiterMemory({
  keyPrefix: 'auth',
  points: 10,
  duration: 60,
});

export async function checkRateLimit(
  identifier: string,
  type: 'ip' | 'user' | 'auth' = 'ip'
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  try {
    let limiter;
    switch (type) {
      case 'auth':
        limiter = authLimiter;
        break;
      case 'user':
        limiter = userLimiter;
        break;
      default:
        limiter = ipLimiter;
    }

    const result = await limiter.consume(identifier);
    
    return {
      allowed: true,
      remaining: result.remainingPoints,
      resetTime: result.msBeforeNext,
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'remainingPoints' in error) {
      const rateError = error as { remainingPoints: number; msBeforeNext: number };
      return {
        allowed: false,
        remaining: rateError.remainingPoints,
        resetTime: rateError.msBeforeNext,
      };
    }
    
    logger.error('Rate limiter error', { error: String(error) });
    return { allowed: true, remaining: 0, resetTime: 0 };
  }
}
