import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { normalizeDocumentBody } from "@/lib/api/normalize";
import { toErrorResponse } from "@/lib/errors";
import { notifyOrgMembers } from "@/lib/notifications/create";
import { logApiAudit } from "@/lib/api/audit";
import { parsePagination } from "@/lib/utils";

const createExpenseSchema = z.object({
    productId: z.string().optional().nullable(),
    reference: z.string().optional().nullable(),
    description: z.string().min(1),
    expenseDate: z.string().optional(),
    category: z
        .enum([
            "RENT",
            "UTILITIES",
            "TRAVEL",
            "MEALS_ENTERTAINMENT",
            "OFFICE_SUPPLIES",
            "MARKETING",
            "SOFTWARE_SUBSCRIPTIONS",
            "PROFESSIONAL_FEES",
            "INSURANCE",
            "MAINTENANCE_REPAIRS",
            "SALARIES_WAGES",
            "TAX_PAYMENTS",
            "BANK_CHARGES",
            "OTHER",
        ])
        .default("OTHER"),
    amount: z.coerce.number().positive(),
    currency: z.string().default("AED"),
    vatTreatment: z
        .enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE", "REVERSE_CHARGE"])
        .default("STANDARD_RATED"),
    vatRate: z.coerce.number().min(0).max(100).default(5),
    isVatReclaimable: z.boolean().default(true),
    paymentMethod: z
        .enum(["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "STRIPE", "PAYBY", "TABBY", "TAMARA", "OTHER"])
        .default("CASH"),
    isPaid: z.boolean().default(true),
    paidAt: z.string().optional().nullable(),
    merchantName: z.string().optional().nullable(),
    receiptUrl: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});

function generateExpenseNumber(existing: string | null): string {
    const next = existing
        ? String(Number(existing.replace(/[^0-9]/g, "")) + 1).padStart(4, "0")
        : "0001";
    return `EXP-${next}`;
}

function normalizeExpenseCategory(category: string) {
    const valid = [
        "RENT", "UTILITIES", "TRAVEL", "MEALS_ENTERTAINMENT",
        "OFFICE_SUPPLIES", "MARKETING", "SOFTWARE_SUBSCRIPTIONS",
        "PROFESSIONAL_FEES", "INSURANCE", "MAINTENANCE_REPAIRS",
        "SALARIES_WAGES", "TAX_PAYMENTS", "BANK_CHARGES", "OTHER",
    ];
    return valid.includes(category) ? category : "OTHER";
}

function normalizePaymentMethod(method: string) {
    const valid = [
        "CASH", "BANK_TRANSFER", "CHEQUE", "CARD",
        "STRIPE", "PAYBY", "TABBY", "TAMARA", "OTHER",
    ];
    return valid.includes(method) ? method : "OTHER";
}

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const { searchParams } = new URL(req.url);

        const category = searchParams.get("category");
        const search = searchParams.get("search") ?? "";
        const { page, limit, skip } = parsePagination(searchParams);

        const where = {
            organizationId: ctx.organizationId,
            deletedAt: null,
            ...(category ? { category: category as unknown as never } : {}),
            ...(search
                ? {
                    OR: [
                        { description: { contains: search, mode: "insensitive" as const } },
                        { merchantName: { contains: search, mode: "insensitive" as const } },
                        { expenseNumber: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {}),
        };

        const [records, total] = await Promise.all([
            prisma.expense.findMany({
                where: where as never,
                select: {
                    id: true,
                    expenseNumber: true,
                    description: true,
                    merchantName: true,
                    category: true,
                    amount: true,
                    vatAmount: true,
                    total: true,
                    currency: true,
                    vatTreatment: true,
                    paymentMethod: true,
                    expenseDate: true,
                    isVatReclaimable: true,
                    createdAt: true,
                    product: { select: { id: true, name: true } },
                },
                orderBy: { expenseDate: "desc" },
                skip,
                take: limit,
            }),
            prisma.expense.count({ where: where as never }),
        ]);

        return NextResponse.json({
            data: records,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const raw = await req.json();
        const body = normalizeDocumentBody(raw);

        const result = createExpenseSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const data = result.data;

        // Calculate VAT
        const vatRate = ["STANDARD_RATED", "REVERSE_CHARGE"].includes(data.vatTreatment)
            ? data.vatRate / 100
            : 0;
        const vatAmount = data.amount * vatRate;
        const total = data.amount + vatAmount;

        const expense = await prisma.$transaction(async (tx) => {
            // Serialize expense number generation per organization
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`exp:${ctx.organizationId}`}))`;

            const last = await tx.expense.findFirst({
                where: { organizationId: ctx.organizationId },
                orderBy: { createdAt: "desc" },
                select: { expenseNumber: true },
            });
            const expenseNumber = generateExpenseNumber(last?.expenseNumber ?? null);

            return tx.expense.create({
                data: {
                    organizationId: ctx.organizationId,
                    productId: data.productId ?? null,
                    expenseNumber,
                    reference: data.reference ?? null,
                    description: data.description,
                    expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
                    category: normalizeExpenseCategory(data.category) as never,
                    amount: data.amount,
                    vatAmount,
                    total,
                    currency: data.currency,
                    vatTreatment: data.vatTreatment,
                    vatRate: data.vatRate,
                    isVatReclaimable: data.isVatReclaimable,
                    paymentMethod: normalizePaymentMethod(data.paymentMethod) as never,
                    isPaid: data.isPaid,
                    paidAt: data.paidAt ? new Date(data.paidAt) : data.isPaid ? new Date() : null,
                    merchantName: data.merchantName ?? null,
                    receiptUrl: data.receiptUrl ?? null,
                    notes: data.notes ?? null,
                },
            });
        });

        // Notify org members about new expense
        notifyOrgMembers({
            organizationId: ctx.organizationId,
            excludeUserId: ctx.userId,
            title: "New Expense Recorded",
            message: `Expense ${expense.expenseNumber} — ${data.description}`,
            type: "GENERAL",
            entityType: "Expense",
            entityId: expense.id,
            actionUrl: `/expenses`,
        }).catch(() => { });

        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "CREATE", entityType: "Expense", entityId: expense.id, entityRef: expense.expenseNumber, newData: result.data, req });

        return NextResponse.json(expense, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
