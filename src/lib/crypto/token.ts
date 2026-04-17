import crypto from "crypto";

export function generatePublicToken(size = 24): string {
    return crypto.randomBytes(size).toString("base64url");
}

/**
 * Generate a 16-digit numeric app identifier.
 * Uses crypto.randomBytes for uniform distribution.
 * 10^16 possible values — virtually collision-free.
 */
export function generateAppId(): string {
    const bytes = crypto.randomBytes(16);
    let id = "";
    for (let i = 0; i < 16; i++) {
        id += (bytes[i] % 10).toString();
    }
    // Ensure it doesn't start with 0
    if (id[0] === "0") {
        id = ((bytes[0] % 9) + 1).toString() + id.slice(1);
    }
    return id;
}

/** Generate a 256-bit hex secret for app API keys. */
export function generateAppSecret(): string {
    return crypto.randomBytes(32).toString("hex");
}

/** Hash a secret with SHA-256 for storage (one-way). */
export function hashSecret(secret: string): string {
    return crypto.createHash("sha256").update(secret).digest("hex");
}

/** Timing-safe comparison of two strings. */
export function timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
