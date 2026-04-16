export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

export function getClientIp(headers: Headers): string {
    const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return fwd || headers.get("x-real-ip") || "unknown";
}

/**
 * In-memory sliding-window rate limiter.
 * Uses a Map keyed by `key:windowStart` with automatic eviction of expired entries.
 * No DB round-trip — sub-millisecond latency.
 */

interface WindowEntry {
    count: number;
    expiresAt: number;
}

const store = new Map<string, WindowEntry>();
const MAX_STORE_SIZE = 50_000;

function evictExpired() {
    const now = Date.now();
    for (const [k, v] of store) {
        if (v.expiresAt <= now) store.delete(k);
    }
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const expiresAt = windowStart + windowMs;
    const storeKey = `${key}:${windowStart}`;

    // Periodic eviction when store grows large
    if (store.size > MAX_STORE_SIZE) evictExpired();

    const entry = store.get(storeKey);
    const count = entry ? entry.count + 1 : 1;
    store.set(storeKey, { count, expiresAt });

    const remaining = Math.max(0, limit - count);
    return {
        allowed: count <= limit,
        remaining,
        resetAt: expiresAt,
    };
}
