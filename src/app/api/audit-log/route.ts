import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") ?? "";
        const action = searchParams.get("action");
        const entityType = searchParams.get("entityType");
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
        const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "30"));
        const skip = (page - 1) * limit;

        const where = {
            organizationId: ctx.organizationId,
            ...(action ? { action: action as never } : {}),
            ...(entityType ? { entityType } : {}),
            ...(search
                ? {
                    OR: [
                        { userEmail: { contains: search, mode: "insensitive" as const } },
                        { entityRef: { contains: search, mode: "insensitive" as const } },
                        { entityId: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {}),
        };

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    userId: true,
                    userEmail: true,
                    userRole: true,
                    action: true,
                    entityType: true,
                    entityId: true,
                    entityRef: true,
                    ipAddress: true,
                    createdAt: true,
                    metadata: true,
                },
            }),
            prisma.auditLog.count({ where }),
        ]);

        return NextResponse.json({
            data: logs,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
