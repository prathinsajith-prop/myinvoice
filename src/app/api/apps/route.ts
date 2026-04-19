import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContextWithPermission } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";
import {
    generateAppId,
    generateAppSecret,
    hashSecret,
} from "@/lib/crypto/token";
import { getAllScopes } from "@/lib/constants/app-scopes";

const validScopes = getAllScopes();

const createAppSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    scopes: z
        .array(z.string())
        .min(1, "At least one scope required")
        .refine(
            (s) => s.every((v) => validScopes.includes(v as (typeof validScopes)[number])),
            { message: "Invalid scope value" },
        ),
    ipWhitelist: z
        .array(z.string().min(1))
        .optional()
        .default([]),
});

/** GET /api/apps — list connected apps for the organization */
export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "manage_org");

        const apps = await prisma.connectedApp.findMany({
            where: { organizationId: ctx.organizationId },
            select: {
                id: true,
                name: true,
                description: true,
                status: true,
                scopes: true,
                ipWhitelist: true,
                lastUsedAt: true,
                requestCount: true,
                createdAt: true,
                updatedAt: true,
                revokedAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ data: apps });
    } catch (error) {
        return toErrorResponse(error);
    }
}

/** POST /api/apps — create a new connected app */
export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "manage_org");
        const body = await req.json();

        const result = createAppSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
                { status: 400 },
            );
        }

        const { name, description, scopes, ipWhitelist } =
            result.data;

        // Check duplicate name within org
        const existing = await prisma.connectedApp.findFirst({
            where: { organizationId: ctx.organizationId, name },
        });
        if (existing) {
            return NextResponse.json(
                { error: "An app with this name already exists" },
                { status: 409 },
            );
        }

        const plainSecret = generateAppSecret();

        // Generate a short, unique app ID with retry to prevent duplicates
        let appId: string;
        for (let attempt = 0; ; attempt++) {
            appId = generateAppId();
            const collision = await prisma.connectedApp.findUnique({ where: { id: appId } });
            if (!collision) break;
            if (attempt >= 5) {
                return NextResponse.json(
                    { error: "Failed to generate unique app ID. Please try again." },
                    { status: 500 },
                );
            }
        }

        const app = await prisma.connectedApp.create({
            data: {
                id: appId,
                organizationId: ctx.organizationId,
                name,
                description: description || null,
                appSecret: hashSecret(plainSecret),
                scopes,
                ipWhitelist,
            },
        });

        logApiAudit({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            userEmail: ctx.email,
            action: "CREATE",
            entityType: "ConnectedApp",
            entityId: app.id,
            newData: { name, scopes },
            req,
        });

        // Return the plain secret only on creation — it won't be shown again
        return NextResponse.json(
            {
                data: {
                    id: app.id,
                    name: app.name,
                    apiSecret: plainSecret,
                    scopes: app.scopes,
                    createdAt: app.createdAt,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        return toErrorResponse(error);
    }
}
