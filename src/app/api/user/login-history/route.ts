import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveUserContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

/** GET /api/user/login-history — paginated login events (cursor-based, 5 per page) */
export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveUserContext(req);

        const cursor = req.nextUrl.searchParams.get("cursor");
        const limit = 5;

        const records = await prisma.loginHistory.findMany({
            where: { userId: ctx.userId },
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            ...(cursor
                ? { cursor: { id: cursor }, skip: 1 }
                : {}),
            select: {
                id: true,
                ipAddress: true,
                device: true,
                browser: true,
                os: true,
                city: true,
                country: true,
                success: true,
                failReason: true,
                createdAt: true,
            },
        });

        const hasMore = records.length > limit;
        const data = hasMore ? records.slice(0, limit) : records;
        const nextCursor = hasMore ? data[data.length - 1].id : null;

        return NextResponse.json({ data, nextCursor });
    } catch (error) {
        return toErrorResponse(error);
    }
}

/** PATCH /api/user/login-history — update the most-recent login record with device/browser info sent by client */
export async function PATCH(req: NextRequest) {
    try {
        const ctx = await resolveUserContext(req);
        const body = await req.json() as {
            device?: string;
            browser?: string;
            os?: string;
        };

        const ip =
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            req.headers.get("x-real-ip") ??
            null;
        const ua = req.headers.get("user-agent") ?? null;

        // Update the most recent record for this user that was created in the last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const latest = await prisma.loginHistory.findFirst({
            where: {
                userId: ctx.userId,
                createdAt: { gte: fiveMinutesAgo },
            },
            orderBy: { createdAt: "desc" },
        });

        if (latest) {
            await prisma.loginHistory.update({
                where: { id: latest.id },
                data: {
                    ipAddress: ip,
                    userAgent: ua,
                    device: body.device ?? null,
                    browser: body.browser ?? null,
                    os: body.os ?? null,
                },
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
