import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { $Enums } from "@/generated/prisma";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";

type Params = { params: Promise<{ id: string }> };

const updateExpenseSchema = z.object({
    reference: z.string().optional().nullable(),
    description: z.string().min(1).optional(),
    expenseDate: z.string().datetime().optional(),
    category: z.string().optional(),
    amount: z.number().positive().optional(),
    currency: z.string().optional(),
    vatTreatment: z
        .enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE", "REVERSE_CHARGE"])
        .optional(),
    vatRate: z.number().min(0).max(100).optional(),
    isVatReclaimable: z.boolean().optional(),
    paymentMethod: z
        .enum(["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "STRIPE", "PAYBY", "TABBY", "TAMARA", "OTHER"])
        .optional(),
    merchantName: z.string().optional().nullable(),
    isPaid: z.boolean().optional(),
    paidAt: z.string().datetime().optional().nullable(),
    notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
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
        const ctx = await resolveRouteContext(req);
        const { id } = await params;
        const body = await req.json();

        const expense = await prisma.expense.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!expense) throw new NotFoundError("Expense");

        const result = updateExpenseSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const { expenseDate, paidAt, paymentMethod, category, vatTreatment, ...rest } = result.data;

        const updated = await prisma.expense.update({
            where: { id },
            data: {
                ...rest,
                ...(expenseDate ? { expenseDate: new Date(expenseDate) } : {}),
                ...(paidAt ? { paidAt: new Date(paidAt) } : {}),
                ...(paymentMethod ? { paymentMethod: paymentMethod as $Enums.PaymentMethod } : {}),
                ...(category ? { category: category as $Enums.ExpenseCategory } : {}),
                ...(vatTreatment ? { vatTreatment: vatTreatment as $Enums.VatTreatment } : {}),
                vatAmount:
                    result.data.amount !== undefined || result.data.vatRate !== undefined || vatTreatment !== undefined
                        ? ((result.data.amount ?? Number(expense.amount)) * (
                            ["STANDARD_RATED", "REVERSE_CHARGE"].includes(vatTreatment ?? expense.vatTreatment)
                                ? (result.data.vatRate ?? Number(expense.vatRate)) / 100
                                : 0
                        ))
                        : undefined,
                total:
                    result.data.amount !== undefined || result.data.vatRate !== undefined || vatTreatment !== undefined
                        ? (() => {
                            const amount = result.data.amount ?? Number(expense.amount);
                            const vatRate = ["STANDARD_RATED", "REVERSE_CHARGE"].includes(vatTreatment ?? expense.vatTreatment)
                                ? (result.data.vatRate ?? Number(expense.vatRate)) / 100
                                : 0;
                            return amount + amount * vatRate;
                        })()
                        : undefined,
            },
        });

        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "UPDATE", entityType: "Expense", entityId: id, entityRef: expense.expenseNumber, previousData: expense, newData: result.data, req });

        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const expense = await prisma.expense.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!expense) throw new NotFoundError("Expense");

        await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "DELETE", entityType: "Expense", entityId: id, entityRef: expense.expenseNumber, req });
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
