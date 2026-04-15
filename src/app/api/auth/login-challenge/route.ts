import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { issueLoginChallenge, validatePrimaryCredentials } from "@/lib/auth/login-challenge";
import { getRequestMetadataFromHeaders } from "@/lib/security/request-metadata";

const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid login request" }, { status: 400 });
    }

    const requestMetadata = getRequestMetadataFromHeaders(req.headers);
    const result = await validatePrimaryCredentials(parsed.data.email, parsed.data.password, requestMetadata);
    if (!result.ok) {
        const status = result.reason.includes("locked") ? 423 : 401;
        return NextResponse.json({ error: result.reason }, { status });
    }

    try {
        const challenge = await issueLoginChallenge(result.user);

        return NextResponse.json({
            success: true,
            email: result.user.email,
            expiresInMinutes: challenge.expiresInMinutes,
            hasAuthenticatorApp: Boolean(result.user.twoFactorEnabled && result.user.twoFactorSecret),
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unable to issue authentication code" },
            { status: 502 },
        );
    }
}
