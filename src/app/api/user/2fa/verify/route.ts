import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveUserContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { verifyTotpCode } from "@/lib/security/totp";

const schema = z.object({ code: z.string().regex(/^\d{6}$/) });

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveUserContext(req);
        const payload = schema.safeParse(await req.json());

        if (!payload.success) {
            return NextResponse.json(
                { error: "Validation failed", details: payload.error.flatten() },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { twoFactorSecret: true },
        });

        if (!user?.twoFactorSecret) {
            return NextResponse.json({ error: "2FA setup not initialized" }, { status: 400 });
        }

        const valid = verifyTotpCode(user.twoFactorSecret, payload.data.code);
        if (!valid) {
            return NextResponse.json({ error: "Invalid authentication code" }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: ctx.userId },
            data: { twoFactorEnabled: true },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
