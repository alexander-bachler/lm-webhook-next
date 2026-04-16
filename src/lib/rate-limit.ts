/**
 * Simple in-memory sliding-window rate limiter (per key, e.g. IP).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function getRateLimitConfig(): { max: number; windowMs: number } {
  const max = Math.max(1, parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX || '120', 10) || 120);
  const windowMs = Math.max(1000, parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || '60000', 10) || 60000);
  return { max, windowMs };
}

/**
 * Returns true if request is allowed, false if rate limited.
 */
export function checkRateLimit(key: string): boolean {
  const { max, windowMs } = getRateLimitConfig();
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) {
    return false;
  }
  b.count += 1;
  return true;
}

export function rateLimitKeyForRequest(ip: string | null, deviceEui?: string): string {
  const safeIp = ip || 'unknown';
  if (deviceEui) {
    return `${safeIp}:${deviceEui}`;
  }
  return safeIp;
}
