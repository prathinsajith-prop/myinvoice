import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";

type Params = { params: Promise<{ id: string }> };

const updateInvoiceSchema = z.object({
    reference: z.string().optional().nullable(),
    poNumber: z.string().optional().nullable(),
    dueDate: z.string().datetime().optional(),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    status: z
        .enum(["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID", "CREDITED"])
        .optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                customer: true,
                quotation: { select: { id: true, quoteNumber: true } },
                creditNotes: {
                    where: { deletedAt: null },
                    select: { id: true, creditNoteNumber: true, total: true, status: true },
                },
                payments: {
                    include: {
                        payment: {
                            select: {
                                id: true,
                                paymentNumber: true,
                                amount: true,
                                paymentDate: true,
                                method: true,
                            },
                        },
                    },
                },
                attachments: true,
            },
        });

        if (!invoice) throw new NotFoundError("Invoice");
        return NextResponse.json(invoice);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const body = await req.json();

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!invoice) throw new NotFoundError("Invoice");
        if (invoice.status === "VOID") {
            throw new ForbiddenError("Cannot edit a voided invoice");
        }

        const result = updateInvoiceSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        // FTA compliance: snapshot before-state as an immutable InvoiceVersion
        const versionCount = await prisma.invoiceVersion.count({ where: { invoiceId: id } });
        prisma.invoiceVersion.create({
            data: {
                invoiceId: id,
                version: versionCount + 1,
                snapshot: invoice as object,
                changedBy: ctx.userId,
            },
        }).catch(() => {}); // fire-and-forget — non-critical to response

        const updated = await prisma.invoice.update({
            where: { id },
            data: {
                ...result.data,
                ...(result.data.dueDate ? { dueDate: new Date(result.data.dueDate) } : {}),
            },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                customer: { select: { id: true, name: true, email: true } },
            },
        });

        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "UPDATE", entityType: "Invoice", entityId: id, entityRef: updated.invoiceNumber ?? id, previousData: invoice, newData: result.data, req });

        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}

// DELETE = soft delete (only DRAFT invoices)
export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!invoice) throw new NotFoundError("Invoice");
        if (invoice.status !== "DRAFT") {
            throw new ForbiddenError("Only DRAFT invoices can be deleted");
        }

        await prisma.invoice.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "DELETE", entityType: "Invoice", entityId: id, entityRef: invoice.invoiceNumber ?? id, req });

        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
