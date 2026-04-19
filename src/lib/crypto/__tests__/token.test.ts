import { describe, it, expect } from "vitest";
import {
    generateAppSecret,
    hashSecret,
    timingSafeCompare,
} from "@/lib/crypto/token";

describe("Crypto Token Utilities", () => {
    describe("generateAppSecret", () => {
        it("should return a 64-char hex string (32 bytes)", () => {
            const secret = generateAppSecret();
            expect(secret).toHaveLength(64);
            expect(secret).toMatch(/^[0-9a-f]{64}$/);
        });

        it("should generate unique secrets", () => {
            const s1 = generateAppSecret();
            const s2 = generateAppSecret();
            expect(s1).not.toBe(s2);
        });
    });

    describe("hashSecret", () => {
        it("should return a 64-char hex SHA-256 hash", () => {
            const hash = hashSecret("my-secret");
            expect(hash).toHaveLength(64);
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });

        it("should produce the same hash for the same input", () => {
            const h1 = hashSecret("same-input");
            const h2 = hashSecret("same-input");
            expect(h1).toBe(h2);
        });

        it("should produce different hashes for different inputs", () => {
            const h1 = hashSecret("input-a");
            const h2 = hashSecret("input-b");
            expect(h1).not.toBe(h2);
        });
    });

    describe("timingSafeCompare", () => {
        it("should return true for equal strings", () => {
            expect(timingSafeCompare("abc123", "abc123")).toBe(true);
        });

        it("should return false for different strings of same length", () => {
            expect(timingSafeCompare("abc123", "abc124")).toBe(false);
        });

        it("should return false for strings of different length", () => {
            expect(timingSafeCompare("short", "longer-string")).toBe(false);
        });

        it("should return true for empty strings", () => {
            expect(timingSafeCompare("", "")).toBe(true);
        });
    });
});
