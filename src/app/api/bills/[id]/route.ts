import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

const updateBillSchema = z.object({
    supplierInvoiceNumber: z.string().optional().nullable(),
    reference: z.string().optional().nullable(),
    dueDate: z.string().datetime().optional(),
    notes: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    status: z.enum(["DRAFT", "RECEIVED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"]).optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const bill = await prisma.bill.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                supplier: true,
                paymentsOut: {
                    include: {
                        paymentOut: {
                            select: { id: true, paymentNumber: true, amount: true, paymentDate: true, method: true },
                        },
                    },
                },
                attachments: true,
            },
        });

        if (!bill) throw new NotFoundError("Bill");
        return NextResponse.json(bill);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const body = await req.json();

        const bill = await prisma.bill.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!bill) throw new NotFoundError("Bill");
        if (bill.status === "VOID") throw new ForbiddenError("Cannot edit a voided bill");

        const result = updateBillSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const updated = await prisma.bill.update({
            where: { id },
            data: {
                ...result.data,
                ...(result.data.dueDate ? { dueDate: new Date(result.data.dueDate) } : {}),
            },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                supplier: { select: { id: true, name: true, email: true } },
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

        const bill = await prisma.bill.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!bill) throw new NotFoundError("Bill");
        if (bill.status !== "DRAFT") throw new ForbiddenError("Only DRAFT bills can be deleted");

        await prisma.bill.update({ where: { id }, data: { deletedAt: new Date() } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
