import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveApiContextWithPermission } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";
import { generateAppSecret, hashSecret } from "@/lib/crypto/token";

/** POST /api/apps/[id]/regenerate-secret — rotate app API key */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "manage_org");
        const { id } = await params;

        const app = await prisma.connectedApp.findFirst({
            where: { id, organizationId: ctx.organizationId },
        });
        if (!app) throw new NotFoundError("App not found");

        const plainSecret = generateAppSecret();

        await prisma.connectedApp.update({
            where: { id },
            data: { appSecret: hashSecret(plainSecret) },
        });

        logApiAudit({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            userEmail: ctx.email,
            action: "REGENERATE_SECRET",
            entityType: "ConnectedApp",
            entityId: app.id,
            metadata: { appName: app.name, secretType: "appSecret" },
            req,
        });

        return NextResponse.json({
            data: { apiSecret: plainSecret },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
