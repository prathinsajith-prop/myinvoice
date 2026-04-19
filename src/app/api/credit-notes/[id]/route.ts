import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
    reason: z.string().min(1).optional(),
    notes: z.string().optional().nullable(),
    status: z.enum(["DRAFT", "ISSUED", "APPLIED", "VOID"]).optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const creditNote = await prisma.creditNote.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                customer: true,
                invoice: { select: { id: true, invoiceNumber: true, status: true } },
                attachments: true,
            },
        });

        if (!creditNote) throw new NotFoundError("Credit Note");
        return NextResponse.json(creditNote);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;
        const body = await req.json();

        const creditNote = await prisma.creditNote.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!creditNote) throw new NotFoundError("Credit Note");
        if (creditNote.status === "VOID") throw new ForbiddenError("Cannot edit a voided credit note");

        const result = updateSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
                { status: 400 }
            );
        }

        // Handle FTA compliance: when credit note is ISSUED, update parent invoice outstanding balance
        if (result.data.status === "ISSUED" && creditNote.status !== "ISSUED") {
            const parentInvoice = await prisma.invoice.findUnique({
                where: { id: creditNote.invoiceId },
                select: { outstanding: true, status: true, amountPaid: true, total: true },
            });
            if (parentInvoice) {
                const newOutstanding = Math.max(0, Number(parentInvoice.outstanding) - Number(creditNote.total));
                const newStatus =
                    newOutstanding <= 0.01
                        ? "CREDITED"
                        : newOutstanding < Number(parentInvoice.outstanding)
                        ? "PARTIALLY_PAID"
                        : parentInvoice.status;

                // Update parent invoice in transaction
                await prisma.$transaction([
                    prisma.invoice.update({
                        where: { id: creditNote.invoiceId },
                        data: {
                            outstanding: newOutstanding,
                            status: newStatus,
                        },
                    }),
                    prisma.creditNote.update({
                        where: { id },
                        data: {
                            ...result.data,
                            issuedAt: new Date(),
                        },
                    }),
                ]);

                logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "UPDATE", entityType: "CreditNote", entityId: id, entityRef: creditNote.creditNoteNumber ?? id, previousData: creditNote, newData: result.data, req });

                return NextResponse.json(
                    await prisma.creditNote.findFirst({
                        where: { id, organizationId: ctx.organizationId, deletedAt: null },
                    })
                );
            }
        }

        const updated = await prisma.creditNote.update({
            where: { id },
            data: {
                ...result.data,
                ...(result.data.status === "ISSUED" ? { issuedAt: new Date() } : {}),
            },
        });

        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "UPDATE", entityType: "CreditNote", entityId: id, entityRef: updated.creditNoteNumber ?? id, previousData: creditNote, newData: result.data, req });

        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const creditNote = await prisma.creditNote.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!creditNote) throw new NotFoundError("Credit Note");
        if (creditNote.status !== "DRAFT") {
            throw new ForbiddenError("Only DRAFT credit notes can be deleted");
        }

        await prisma.creditNote.update({ where: { id }, data: { deletedAt: new Date() } });
        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "DELETE", entityType: "CreditNote", entityId: id, entityRef: creditNote.creditNoteNumber ?? id, req });
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
