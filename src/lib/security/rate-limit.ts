/**
 * Rate limiting — Local Redis with in-memory fallback.
 *
 * Uses a local Redis instance (default: localhost:6379) for distributed rate limiting.
 * Redis connection pool is lazy-initialized on first use and reused across requests.
 *
 * When Redis is unavailable (dev without Redis running), falls back to an in-process
 * sliding-window Map — effective for single-instance use only.
 *
 * Requires REDIS_URL env var (default: redis://localhost:6379)
 */

import { createClient, type RedisClientType } from "redis";
import { logger } from "@/lib/logger";

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

export function getClientIp(headers: Headers): string {
    const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return fwd || headers.get("x-real-ip") || "unknown";
}

// ─── Local Redis (primary) ─────────────────────────────────────────────────────

let redisClient: RedisClientType | null = null;
let redisConnected = false;

async function getRedisClient(): Promise<RedisClientType | null> {
    if (redisClient) return redisClient;

    try {
        const url = process.env.REDIS_URL || "redis://localhost:6379";
        redisClient = createClient({ url });

        redisClient.on("error", (err) => {
            logger.warn({ error: err.message }, "Redis connection error");
            redisConnected = false;
        });

        redisClient.on("connect", () => {
            logger.info("Redis connected");
            redisConnected = true;
        });

        await redisClient.connect();
        redisConnected = true;
        return redisClient;
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.warn({ error: errMsg }, "Failed to initialize Redis client");
        redisClient = null;
        return null;
    }
}

async function redisRateLimit(
    key: string,
    limit: number,
    windowMs: number
): Promise<RateLimitResult | null> {
    if (!redisConnected) return null;

    const client = await getRedisClient();
    if (!client) return null;

    try {
        const now = Date.now();
        const windowStart = now - windowMs;
        const redisKey = `ratelimit:${key}`;

        // Remove old entries outside the window
        await client.zRemRangeByScore(redisKey, "-inf", windowStart);

        // Count entries in current window
        const count = await client.zCard(redisKey);

        // Add current request
        const zMember = {
            score: now,
            value: `${now}-${Math.random()}`,
        };
        await client.zAdd(redisKey, zMember);
        // Set expiration to window size + some buffer
        await client.expire(redisKey, Math.ceil(windowMs / 1000) + 60);

        const allowed = count < limit;
        const resetAt = now + windowMs;

        return {
            allowed,
            remaining: Math.max(0, limit - count - 1),
            resetAt,
        };
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.warn({ error: errMsg }, "Redis rate limit error");
        return null;
    }
}

// ─── In-memory fallback ────────────────────────────────────────────────────────

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

function inMemoryRateLimit(
    key: string,
    limit: number,
    windowMs: number
): RateLimitResult {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const expiresAt = windowStart + windowMs;
    const storeKey = `${key}:${windowStart}`;

    if (store.size > MAX_STORE_SIZE) evictExpired();

    const entry = store.get(storeKey);
    const count = entry ? entry.count + 1 : 1;
    store.set(storeKey, { count, expiresAt });

    return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt: expiresAt,
    };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function rateLimit(
    key: string,
    limit: number,
    windowMs: number
): Promise<RateLimitResult> {
    // Try Redis first
    const redisResult = await redisRateLimit(key, limit, windowMs);
    if (redisResult) return redisResult;

    // Fall back to in-memory
    return inMemoryRateLimit(key, limit, windowMs);
}
