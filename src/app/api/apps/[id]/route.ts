import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContextWithPermission } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";
import { getAllScopes } from "@/lib/constants/app-scopes";

const validScopes = getAllScopes();

const updateAppSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    scopes: z
        .array(z.string())
        .min(1)
        .refine(
            (s) => s.every((v) => validScopes.includes(v as (typeof validScopes)[number])),
            { message: "Invalid scope value" },
        )
        .optional(),
    ipWhitelist: z.array(z.string().min(1)).optional(),
});

async function getApp(organizationId: string, appId: string) {
    const app = await prisma.connectedApp.findFirst({
        where: { id: appId, organizationId },
    });
    if (!app) throw new NotFoundError("App not found");
    return app;
}

/** GET /api/apps/[id] — get a single connected app */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "manage_org");
        const { id } = await params;
        const app = await getApp(ctx.organizationId, id);

        return NextResponse.json({
            data: {
                id: app.id,
                name: app.name,
                description: app.description,
                status: app.status,
                scopes: app.scopes,
                ipWhitelist: app.ipWhitelist,
                lastUsedAt: app.lastUsedAt,
                requestCount: app.requestCount,
                createdAt: app.createdAt,
                updatedAt: app.updatedAt,
                revokedAt: app.revokedAt,
            },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}

/** PATCH /api/apps/[id] — update an app's settings */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "manage_org");
        const { id } = await params;
        const existing = await getApp(ctx.organizationId, id);

        const body = await req.json();
        const result = updateAppSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
                { status: 400 },
            );
        }

        const updates = result.data;

        // Check duplicate name within org (if changing name)
        if (updates.name && updates.name !== existing.name) {
            const dup = await prisma.connectedApp.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    name: updates.name,
                    id: { not: id },
                },
            });
            if (dup) {
                return NextResponse.json(
                    { error: "An app with this name already exists" },
                    { status: 409 },
                );
            }
        }

        const app = await prisma.connectedApp.update({
            where: { id },
            data: {
                ...(updates.name !== undefined && { name: updates.name }),
                ...(updates.description !== undefined && {
                    description: updates.description || null,
                }),
                ...(updates.scopes !== undefined && { scopes: updates.scopes }),
                ...(updates.ipWhitelist !== undefined && {
                    ipWhitelist: updates.ipWhitelist,
                }),
            },
        });

        logApiAudit({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            userEmail: ctx.email,
            action: "UPDATE",
            entityType: "ConnectedApp",
            entityId: app.id,
            previousData: {
                name: existing.name,
                scopes: existing.scopes,
            },
            newData: updates,
            req,
        });

        return NextResponse.json({ data: app });
    } catch (error) {
        return toErrorResponse(error);
    }
}

/** DELETE /api/apps/[id] — revoke (soft-delete) an app */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "manage_org");
        const { id } = await params;
        await getApp(ctx.organizationId, id);

        const app = await prisma.connectedApp.update({
            where: { id },
            data: { status: "REVOKED", revokedAt: new Date() },
        });

        logApiAudit({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            userEmail: ctx.email,
            action: "REVOKE",
            entityType: "ConnectedApp",
            entityId: app.id,
            metadata: { appName: app.name },
            req,
        });

        return NextResponse.json({ message: "App revoked" });
    } catch (error) {
        return toErrorResponse(error);
    }
}
