type Bucket = {
    count: number;
    resetAt: number;
};

const buckets = new Map<string, Bucket>();

// Periodic cleanup of expired buckets to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let lastCleanup = Date.now();

function cleanupExpiredBuckets() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) {
            buckets.delete(key);
        }
    }
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

export function getClientIp(headers: Headers): string {
    const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return fwd || headers.get("x-real-ip") || "unknown";
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
    cleanupExpiredBuckets();

    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
        const resetAt = now + windowMs;
        buckets.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: limit - 1, resetAt };
    }

    current.count += 1;
    buckets.set(key, current);

    const remaining = Math.max(0, limit - current.count);
    return {
        allowed: current.count <= limit,
        remaining,
        resetAt: current.resetAt,
    };
}
