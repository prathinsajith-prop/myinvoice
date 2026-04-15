import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

const updateQuotationSchema = z.object({
    reference: z.string().optional().nullable(),
    validUntil: z.string().datetime().optional(),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"]).optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const quotation = await prisma.quotation.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                customer: true,
                invoice: { select: { id: true, invoiceNumber: true, status: true } },
                versions: { orderBy: { version: "desc" } },
                attachments: true,
            },
        });

        if (!quotation) throw new NotFoundError("Quotation");
        return NextResponse.json(quotation);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const body = await req.json();

        const quotation = await prisma.quotation.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!quotation) throw new NotFoundError("Quotation");
        if (quotation.status === "CONVERTED") {
            throw new ForbiddenError("Cannot edit a converted quotation");
        }

        const result = updateQuotationSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const updated = await prisma.quotation.update({
            where: { id },
            data: {
                ...result.data,
                ...(result.data.validUntil ? { validUntil: new Date(result.data.validUntil) } : {}),
            },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                customer: { select: { id: true, name: true, email: true } },
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

        const quotation = await prisma.quotation.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!quotation) throw new NotFoundError("Quotation");
        if (!["DRAFT", "REJECTED", "EXPIRED"].includes(quotation.status as string)) {
            throw new ForbiddenError("Only DRAFT, REJECTED, or EXPIRED quotations can be deleted");
        }

        await prisma.quotation.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
