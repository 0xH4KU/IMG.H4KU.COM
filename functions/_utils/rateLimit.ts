/**
 * Per-isolate rate limiter for Cloudflare Workers / Pages Functions.
 *
 * Each Worker isolate maintains its own counter map in module scope.
 * This won't catch distributed attacks across edge locations, but provides
 * a practical first line of defence for a private service. For stricter
 * global rate limiting, configure Cloudflare WAF Rate Limiting Rules.
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent memory buildup in long-lived isolates
let lastCleanup = 0;
const CLEANUP_INTERVAL_MS = 60_000;

function cleanup(): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    for (const [key, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(key);
    }
}

export interface RateLimitOptions {
    /** Maximum requests allowed in the window. */
    limit: number;
    /** Window duration in milliseconds. */
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
}

/**
 * Check (and consume) a rate-limit token for the given identifier.
 * Returns whether the request is allowed and how many tokens remain.
 */
export function checkRateLimit(
    identifier: string,
    { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
    cleanup();
    const now = Date.now();
    const entry = buckets.get(identifier);

    if (!entry || entry.resetAt <= now) {
        buckets.set(identifier, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }

    entry.count++;
    if (entry.count > limit) {
        return {
            allowed: false,
            remaining: 0,
            retryAfterMs: entry.resetAt - now,
        };
    }

    return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 };
}

/** Extract the client IP from Cloudflare headers. */
export function getClientIp(request: Request): string {
    return request.headers.get('CF-Connecting-IP')
        || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
        || 'unknown';
}

/** Build a 429 response with Retry-After header. */
export function rateLimitResponse(retryAfterMs: number): Response {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return new Response('Rate limit exceeded', {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSec) },
    });
}
