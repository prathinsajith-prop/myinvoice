import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
    reason: z.string().min(1).optional(),
    notes: z.string().optional().nullable(),
    status: z.enum(["DRAFT", "ISSUED", "APPLIED", "VOID"]).optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
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
        const ctx = await resolveApiContext(req);
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
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const updated = await prisma.creditNote.update({
            where: { id },
            data: {
                ...result.data,
                ...(result.data.status === "ISSUED" ? { issuedAt: new Date() } : {}),
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const creditNote = await prisma.creditNote.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!creditNote) throw new NotFoundError("Credit Note");
        if (creditNote.status !== "DRAFT") {
            throw new ForbiddenError("Only DRAFT credit notes can be deleted");
        }

        await prisma.creditNote.update({ where: { id }, data: { deletedAt: new Date() } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
