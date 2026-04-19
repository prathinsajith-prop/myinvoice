import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { verifyWebhookSignature } from "@/lib/security/hmac";
import { logApiAudit } from "@/lib/api/audit";
import { toErrorResponse } from "@/lib/errors";

/**
 * POST /api/webhooks/[appId]
 *
 * Receives an inbound webhook signed with the app's webhook secret.
 * Header: `X-Webhook-Signature: t=<ms>,v1=<hex>`
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ appId: string }> },
) {
    try {
        const { appId } = await params;
        const signatureHeader = req.headers.get("x-webhook-signature");

        if (!signatureHeader) {
            return NextResponse.json(
                { error: "Missing X-Webhook-Signature header" },
                { status: 401 },
            );
        }

        const app = await prisma.connectedApp.findUnique({
            where: { id: appId },
            select: {
                id: true,
                organizationId: true,
                name: true,
                webhookSecret: true,
                status: true,
            },
        });

        if (!app || app.status !== "ACTIVE") {
            return NextResponse.json(
                { error: "Invalid or revoked app" },
                { status: 401 },
            );
        }

        const body = await req.text();

        const result = verifyWebhookSignature(
            body,
            signatureHeader,
            app.webhookSecret,
        );

        if (!result.valid) {
            logApiAudit({
                organizationId: app.organizationId,
                action: "ACCESS_DENIED",
                entityType: "ConnectedApp",
                entityId: app.id,
                metadata: { reason: result.error, appName: app.name },
                ipAddress:
                    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
                    null,
            });

            return NextResponse.json(
                { error: result.error },
                { status: 401 },
            );
        }

        // Parse the verified payload
        let payload: unknown;
        try {
            payload = JSON.parse(body);
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON payload" },
                { status: 400 },
            );
        }

        logApiAudit({
            organizationId: app.organizationId,
            action: "CREATE",
            entityType: "Webhook",
            entityId: app.id,
            metadata: { appName: app.name, event: (payload as Record<string, unknown>)?.event },
            ipAddress:
                req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
                null,
        });

        return NextResponse.json({ received: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
