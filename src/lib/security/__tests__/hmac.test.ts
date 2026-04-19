import { describe, it, expect, vi, afterEach } from "vitest";
import { signPayload, verifyWebhookSignature } from "@/lib/security/hmac";

describe("HMAC Utilities", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("signPayload", () => {
        it("should return a signature in the expected format", () => {
            const sig = signPayload('{"event":"test"}', "secret-key");
            expect(sig).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
        });

        it("should produce different signatures for different payloads", () => {
            const sig1 = signPayload("payload-a", "secret");
            const sig2 = signPayload("payload-b", "secret");
            const v1 = sig1.split(",")[1];
            const v2 = sig2.split(",")[1];
            expect(v1).not.toBe(v2);
        });

        it("should produce different signatures for different secrets", () => {
            const payload = "same-payload";
            const sig1 = signPayload(payload, "secret-1");
            const sig2 = signPayload(payload, "secret-2");
            const v1 = sig1.split(",")[1];
            const v2 = sig2.split(",")[1];
            expect(v1).not.toBe(v2);
        });
    });

    describe("verifyWebhookSignature", () => {
        const secret = "my-webhook-secret";
        const payload = '{"event":"invoice.created","id":"123"}';

        it("should verify a valid signature", () => {
            const sig = signPayload(payload, secret);
            const result = verifyWebhookSignature(payload, sig, secret);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("should reject a signature with wrong secret", () => {
            const sig = signPayload(payload, secret);
            const result = verifyWebhookSignature(payload, sig, "wrong-secret");
            expect(result.valid).toBe(false);
            expect(result.error).toBe("Signature mismatch");
        });

        it("should reject a tampered payload", () => {
            const sig = signPayload(payload, secret);
            const result = verifyWebhookSignature(
                '{"event":"invoice.deleted","id":"123"}',
                sig,
                secret,
            );
            expect(result.valid).toBe(false);
            expect(result.error).toBe("Signature mismatch");
        });

        it("should reject an expired timestamp", () => {
            // Create a signature with a timestamp 6 minutes ago
            const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
            vi.spyOn(Date, "now").mockReturnValueOnce(sixMinutesAgo);
            const sig = signPayload(payload, secret);
            vi.restoreAllMocks();

            const result = verifyWebhookSignature(payload, sig, secret);
            expect(result.valid).toBe(false);
            expect(result.error).toBe("Timestamp expired");
        });

        it("should reject invalid signature format — missing t=", () => {
            const result = verifyWebhookSignature(
                payload,
                "v1=abc123",
                secret,
            );
            expect(result.valid).toBe(false);
            expect(result.error).toBe("Invalid signature format");
        });

        it("should reject invalid signature format — missing v1=", () => {
            const result = verifyWebhookSignature(
                payload,
                "t=1234567890",
                secret,
            );
            expect(result.valid).toBe(false);
            expect(result.error).toBe("Invalid signature format");
        });

        it("should reject non-numeric timestamp", () => {
            const result = verifyWebhookSignature(
                payload,
                "t=notanumber,v1=abc123",
                secret,
            );
            expect(result.valid).toBe(false);
            expect(result.error).toBe("Invalid timestamp");
        });
    });
});
