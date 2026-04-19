import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContextWithPermission } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";

const bulkSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("void"),
        ids: z.array(z.string()).min(1).max(100),
        reason: z.string().min(1, "Void reason is required"),
    }),
    z.object({
        action: z.literal("delete"),
        ids: z.array(z.string()).min(1).max(100),
    }),
]);

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "edit");
        const body = await req.json();

        const result = bulkSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
                { status: 400 },
            );
        }

        const { action, ids } = result.data;

        // Verify all invoices belong to this org and are in a voidable state
        const invoices = await prisma.invoice.findMany({
            where: {
                id: { in: ids },
                organizationId: ctx.organizationId,
                deletedAt: null,
            },
            select: { id: true, status: true, invoiceNumber: true },
        });

        if (invoices.length !== ids.length) {
            return NextResponse.json(
                { error: "One or more invoices not found or do not belong to this organization" },
                { status: 404 },
            );
        }

        if (action === "void") {
            const { reason } = result.data;

            // Filter invoices that can be voided
            const voidable = invoices.filter(
                (inv) => !["VOID", "PAID", "PARTIALLY_PAID"].includes(inv.status),
            );
            const skipped = invoices.filter((inv) =>
                ["VOID", "PAID", "PARTIALLY_PAID"].includes(inv.status),
            );

            if (voidable.length === 0) {
                return NextResponse.json(
                    {
                        error: "No invoices can be voided. Paid or already-voided invoices cannot be voided.",
                        skipped: skipped.map((i) => i.invoiceNumber),
                    },
                    { status: 422 },
                );
            }

            await prisma.invoice.updateMany({
                where: {
                    id: { in: voidable.map((i) => i.id) },
                    organizationId: ctx.organizationId,
                },
                data: {
                    status: "VOID",
                    voidedAt: new Date(),
                    voidReason: reason,
                    outstanding: 0,
                },
            });

            logApiAudit({
                organizationId: ctx.organizationId,
                userId: ctx.userId,
                action: "VOID",
                entityType: "invoice",
                entityId: voidable[0]?.id ?? ids[0],
                newData: { bulkIds: voidable.map((i) => i.id), count: voidable.length, reason },
            });

            return NextResponse.json({
                success: true,
                voided: voidable.length,
                skipped: skipped.length,
                skippedNumbers: skipped.map((i) => i.invoiceNumber),
            });
        }

        if (action === "delete") {
            // Soft-delete — only DRAFT invoices can be deleted
            const deletable = invoices.filter((inv) => inv.status === "DRAFT");
            const skipped = invoices.filter((inv) => inv.status !== "DRAFT");

            if (deletable.length === 0) {
                return NextResponse.json(
                    {
                        error: "Only DRAFT invoices can be deleted. Use Void for sent/unpaid invoices.",
                        skipped: skipped.map((i) => i.invoiceNumber),
                    },
                    { status: 422 },
                );
            }

            await prisma.invoice.updateMany({
                where: {
                    id: { in: deletable.map((i) => i.id) },
                    organizationId: ctx.organizationId,
                },
                data: { deletedAt: new Date() },
            });

            logApiAudit({
                organizationId: ctx.organizationId,
                userId: ctx.userId,
                action: "DELETE",
                entityType: "invoice",
                entityId: deletable[0]?.id ?? ids[0],
                newData: { bulkIds: deletable.map((i) => i.id), count: deletable.length },
            });

            return NextResponse.json({
                success: true,
                deleted: deletable.length,
                skipped: skipped.length,
                skippedNumbers: skipped.map((i) => i.invoiceNumber),
            });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
