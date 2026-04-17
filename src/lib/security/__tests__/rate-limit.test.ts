import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

describe('Rate Limiting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rateLimit', () => {
        it('should allow requests within limit', async () => {
            const result = await rateLimit('test-user', 5, 60000);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBeGreaterThanOrEqual(0);
        });

        it('should enforce rate limit', async () => {
            const limit = 2;
            const key = `rate-limit-test-${Date.now()}`;

            // Make 2 requests (at limit)
            let result = await rateLimit(key, limit, 60000);
            expect(result.allowed).toBe(true);

            result = await rateLimit(key, limit, 60000);
            expect(result.allowed).toBe(true);

            // 3rd request should be blocked
            result = await rateLimit(key, limit, 60000);
            expect(result.allowed).toBe(false);
        });

        it('should include reset time', async () => {
            const result = await rateLimit('test-reset', 1, 1000);
            expect(result.resetAt).toBeGreaterThan(Date.now());
            expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 1000);
        });

        it('should track remaining requests', async () => {
            const key = `remaining-test-${Date.now()}`;
            const limit = 3;

            const r1 = await rateLimit(key, limit, 60000);
            expect(r1.remaining).toBe(2); // 3 - 1

            const r2 = await rateLimit(key, limit, 60000);
            expect(r2.remaining).toBe(1); // 3 - 2

            const r3 = await rateLimit(key, limit, 60000);
            expect(r3.remaining).toBe(0); // 3 - 3

            const r4 = await rateLimit(key, limit, 60000);
            expect(r4.allowed).toBe(false);
        });
    });

    describe('getClientIp', () => {
        it('should extract IP from x-forwarded-for header', () => {
            const headers = new Headers({
                'x-forwarded-for': '192.168.1.1, 10.0.0.1',
            });
            const ip = getClientIp(headers);
            expect(ip).toBe('192.168.1.1');
        });

        it('should extract IP from x-real-ip header', () => {
            const headers = new Headers({
                'x-real-ip': '203.0.113.1',
            });
            const ip = getClientIp(headers);
            expect(ip).toBe('203.0.113.1');
        });

        it('should return unknown if no headers found', () => {
            const headers = new Headers({});
            const ip = getClientIp(headers);
            expect(ip).toBe('unknown');
        });
    });
});
