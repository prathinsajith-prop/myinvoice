import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

const updateExpenseSchema = z.object({
    reference: z.string().optional().nullable(),
    description: z.string().min(1).optional(),
    expenseDate: z.string().datetime().optional(),
    category: z.string().optional(),
    merchantName: z.string().optional().nullable(),
    isPaid: z.boolean().optional(),
    paidAt: z.string().datetime().optional().nullable(),
    notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const expense = await prisma.expense.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                product: { select: { id: true, name: true } },
                attachments: true,
            },
        });

        if (!expense) throw new NotFoundError("Expense");
        return NextResponse.json(expense);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const body = await req.json();

        const expense = await prisma.expense.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!expense) throw new NotFoundError("Expense");

        const result = updateExpenseSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const updated = await prisma.expense.update({
            where: { id },
            data: {
                ...result.data,
                ...(result.data.expenseDate ? { expenseDate: new Date(result.data.expenseDate) } : {}),
                ...(result.data.paidAt ? { paidAt: new Date(result.data.paidAt) } : {}),
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

        const expense = await prisma.expense.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!expense) throw new NotFoundError("Expense");

        await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
