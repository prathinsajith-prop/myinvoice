import prisma from "@/lib/db/prisma";
import type { NextRequest } from "next/server";

/**
 * Log an audit entry from an API route handler.
 * Fire-and-forget: errors are silently caught so they never break the response.
 */
export function logApiAudit(params: {
    organizationId: string;
    userId: string;
    userEmail?: string | null;
    action: string;
    entityType: string;
    entityId?: string;
    entityRef?: string;
    previousData?: unknown;
    newData?: unknown;
    metadata?: Record<string, unknown>;
    req?: NextRequest;
}) {
    const ipAddress = params.req
        ? params.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        params.req.headers.get("x-real-ip") ??
        null
        : null;

    // Fire-and-forget — do not await in the calling code
    prisma.auditLog
        .create({
            data: {
                organizationId: params.organizationId,
                userId: params.userId,
                userEmail: params.userEmail ?? undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                action: params.action as any,
                entityType: params.entityType,
                entityId: params.entityId,
                entityRef: params.entityRef,
                previousData: params.previousData as object | undefined,
                newData: params.newData as object | undefined,
                metadata: params.metadata as object | undefined,
                ipAddress,
            },
        })
        .catch(() => {
            // Silently fail — audit logging should never break the request
        });
}
