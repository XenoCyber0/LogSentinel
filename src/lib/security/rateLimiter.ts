import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/env';
import { logger } from '@/lib/logger/winston';

// Distributed rate limiting backed by Upstash Redis (REST). Counters are shared
// across all Node instances, so the configured limit is the effective limit even
// behind a load balancer or in multi-instance deployments. Uses UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN from env.ts.
//
// A previous version of this file used in-memory `RateLimiterMemory`, which is
// per-process and silently multiplied limits by instance count. It also tried
// `new Redis(UPSTASH_REDIS_REST_URL)` from ioredis, but ioredis expects a TCP
// connection string while Upstash exposes HTTPS REST — that connection failed
// silently. Using the official @upstash/redis REST client avoids both problems.

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// Sliding-window limiters. `prefix` namespaces keys in Redis.
const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '60 s'),
  prefix: 'rl:ip',
});

const userLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1000, '60 m'),
  prefix: 'rl:user',
});

const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  prefix: 'rl:auth',
});

export async function checkRateLimit(
  identifier: string,
  type: 'ip' | 'user' | 'auth' = 'ip'
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  // Development convenience: when placeholder credentials are in use, skip the
  // network hop and allow everything. Real limiting kicks in once real Upstash
  // credentials are provisioned.
  if (!env.UPSTASH_REDIS_REST_TOKEN || env.UPSTASH_REDIS_REST_TOKEN.startsWith('placeholder')) {
    return { allowed: true, remaining: 1, resetTime: 0 };
  }

  try {
    const limiter =
      type === 'auth' ? authLimiter : type === 'user' ? userLimiter : ipLimiter;

    const result = await limiter.limit(identifier);

    return {
      allowed: result.success,
      remaining: result.remaining,
      // ms until the window resets — matches prior RateLimiterMemory semantics.
      resetTime: Math.max(0, result.reset - Date.now()),
    };
  } catch (error: unknown) {
    // Fail-open on Redis/network errors so a rate-limit outage doesn't take the
    // API down. Log loudly so the failure is observable.
    logger.error('Rate limiter error', { error: String(error) });
    return { allowed: true, remaining: 0, resetTime: 0 };
  }
}
