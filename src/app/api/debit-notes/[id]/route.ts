import { NextRequest, NextResponse } from "next/server";
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

        const debitNote = await prisma.debitNote.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                customer: true,
                invoice: { select: { id: true, invoiceNumber: true, status: true } },
                attachments: true,
            },
        });

        if (!debitNote) throw new NotFoundError("Debit Note");
        return NextResponse.json(debitNote);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;
        const body = await req.json();

        const debitNote = await prisma.debitNote.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!debitNote) throw new NotFoundError("Debit Note");
        if (debitNote.status === "VOID") throw new ForbiddenError("Cannot edit a voided debit note");

        const result = updateSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const updated = await prisma.debitNote.update({
            where: { id },
            data: {
                ...result.data,
                ...(result.data.status === "ISSUED" ? { issuedAt: new Date() } : {}),
            },
        });

        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "UPDATE", entityType: "DebitNote", entityId: id, entityRef: updated.debitNoteNumber ?? id, previousData: debitNote, newData: result.data, req });

        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const debitNote = await prisma.debitNote.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!debitNote) throw new NotFoundError("Debit Note");
        if (debitNote.status !== "DRAFT") {
            throw new ForbiddenError("Only DRAFT debit notes can be deleted");
        }

        await prisma.debitNote.update({ where: { id }, data: { deletedAt: new Date() } });
        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "DELETE", entityType: "DebitNote", entityId: id, entityRef: debitNote.debitNoteNumber ?? id, req });
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
