import crypto from "crypto";
import { timingSafeCompare } from "@/lib/crypto/token";

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

export interface HmacVerifyResult {
    valid: boolean;
    error?: string;
}

/**
 * Compute HMAC-SHA256 signature for a payload.
 *
 * Format: `t=<unix-ms>,v1=<hex-signature>`
 */
export function signPayload(payload: string, secret: string): string {
    const timestamp = Date.now();
    const toSign = `${timestamp}.${payload}`;
    const signature = crypto
        .createHmac("sha256", secret)
        .update(toSign)
        .digest("hex");
    return `t=${timestamp},v1=${signature}`;
}

/**
 * Verify an incoming webhook signature with replay-attack protection.
 *
 * Expected header format: `t=<unix-ms>,v1=<hex-signature>`
 */
export function verifyWebhookSignature(
    payload: string,
    signatureHeader: string,
    secret: string,
): HmacVerifyResult {
    const parts = signatureHeader.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const signaturePart = parts.find((p) => p.startsWith("v1="));

    if (!timestampPart || !signaturePart) {
        return { valid: false, error: "Invalid signature format" };
    }

    const timestamp = parseInt(timestampPart.slice(2), 10);
    const receivedSig = signaturePart.slice(3);

    if (isNaN(timestamp)) {
        return { valid: false, error: "Invalid timestamp" };
    }

    // Replay attack prevention
    const drift = Math.abs(Date.now() - timestamp);
    if (drift > MAX_TIMESTAMP_DRIFT_MS) {
        return { valid: false, error: "Timestamp expired" };
    }

    const toSign = `${timestamp}.${payload}`;
    const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(toSign)
        .digest("hex");

    if (!timingSafeCompare(expectedSig, receivedSig)) {
        return { valid: false, error: "Signature mismatch" };
    }

    return { valid: true };
}
