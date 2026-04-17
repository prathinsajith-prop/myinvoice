import crypto from "crypto";

export function generatePublicToken(size = 24): string {
    return crypto.randomBytes(size).toString("base64url");
}
