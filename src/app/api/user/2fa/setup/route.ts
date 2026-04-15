import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveUserContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { createTotpSecret, getTotpOtpAuthUrl, getTotpQrDataUrl } from "@/lib/security/totp";

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveUserContext(req);

        const user = await prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { email: true, twoFactorEnabled: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const secret = createTotpSecret();
        const otpauthUrl = getTotpOtpAuthUrl(user.email, secret);
        const qrCodeDataUrl = await getTotpQrDataUrl(user.email, secret);

        // Store secret first; account is protected only after verify endpoint toggles enabled=true.
        await prisma.user.update({
            where: { id: ctx.userId },
            data: { twoFactorSecret: secret, twoFactorEnabled: false },
        });

        return NextResponse.json({
            secret,
            otpauthUrl,
            qrCodeDataUrl,
            alreadyEnabled: user.twoFactorEnabled,
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
