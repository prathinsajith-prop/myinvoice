import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";
import { parsePagination } from "@/lib/utils";

const createPaymentSchema = z.object({
    customerId: z.string().min(1),
    amount: z.coerce.number().positive(),
    currencyCode: z.string().default("AED"),
    exchangeRate: z.coerce.number().positive().default(1),
    paymentDate: z.string(),
    method: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "STRIPE", "PAYBY", "TABBY", "TAMARA", "OTHER"]),
    reference: z.string().optional().nullable(),
    bankCharge: z.coerce.number().min(0).default(0),
    notes: z.string().optional().nullable(),
    allocations: z
        .array(
            z.object({
                invoiceId: z.string(),
                amount: z.coerce.number().positive(),
            })
        )
        .optional()
        .default([]),
});

function genPaymentNumber(last: string | null): string {
    const next = last ? String(Number(last.replace(/[^0-9]/g, "")) + 1).padStart(4, "0") : "0001";
    return `PAY-${next}`;
}

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const { searchParams } = new URL(req.url);

        const customerId = searchParams.get("customerId");
        const search = searchParams.get("search") ?? "";
        const { page, limit, skip } = parsePagination(searchParams);

        const where = {
            organizationId: ctx.organizationId,
            ...(customerId ? { customerId } : {}),
            ...(search
                ? {
                    OR: [
                        { paymentNumber: { contains: search, mode: "insensitive" as const } },
                        { reference: { contains: search, mode: "insensitive" as const } },
                        { customer: { name: { contains: search, mode: "insensitive" as const } } },
                    ],
                }
                : {}),
        };

        const [records, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, email: true } },
                    _count: { select: { allocations: true } },
                },
                orderBy: { paymentDate: "desc" },
                skip,
                take: limit,
            }),
            prisma.payment.count({ where }),
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
        const body = await req.json();

        const result = createPaymentSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const data = result.data;

        const amountNet = data.amount - data.bankCharge;

        const payment = await prisma.$transaction(async (tx) => {
            // Serialize payment number generation per organization.
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`pay:${ctx.organizationId}`}))`;

            // Generate payment number atomically inside the transaction
            const last = await tx.payment.findFirst({
                where: { organizationId: ctx.organizationId },
                orderBy: { createdAt: "desc" },
                select: { paymentNumber: true },
            });
            const paymentNumber = genPaymentNumber(last?.paymentNumber ?? null);
            const pay = await tx.payment.create({
                data: {
                    organizationId: ctx.organizationId,
                    customerId: data.customerId,
                    paymentNumber,
                    reference: data.reference ?? null,
                    method: data.method,
                    status: "COMPLETED",
                    currency: data.currencyCode,
                    exchangeRate: data.exchangeRate,
                    amount: data.amount,
                    bankCharge: data.bankCharge,
                    amountNet,
                    paymentDate: new Date(data.paymentDate),
                    notes: data.notes ?? null,
                    allocations: data.allocations.length
                        ? { create: data.allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount })) }
                        : undefined,
                },
                include: {
                    customer: { select: { id: true, name: true } },
                    allocations: true,
                },
            });

            // Update invoice outstanding amounts — batch fetch then parallel update
            if (data.allocations.length > 0) {
                const invoiceIds = data.allocations.map((a) => a.invoiceId);
                const invoices = await tx.invoice.findMany({
                    where: { id: { in: invoiceIds } },
                    select: { id: true, outstanding: true, status: true },
                });
                const invoiceMap = new Map(invoices.map((i) => [i.id, i]));

                await Promise.all(
                    data.allocations.map((alloc) => {
                        const invoice = invoiceMap.get(alloc.invoiceId);
                        if (!invoice) return Promise.resolve();
                        const newOutstanding = Math.max(0, Number(invoice.outstanding) - alloc.amount);
                        return tx.invoice.update({
                            where: { id: alloc.invoiceId },
                            data: {
                                outstanding: newOutstanding,
                                amountPaid: { increment: alloc.amount },
                                status:
                                    newOutstanding <= 0.01
                                        ? "PAID"
                                        : newOutstanding < Number(invoice.outstanding)
                                            ? "PARTIALLY_PAID"
                                            : invoice.status,
                            },
                        });
                    })
                );
            }

            return pay;
        });

        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "CREATE", entityType: "Payment", entityId: payment.id, entityRef: payment.paymentNumber, newData: result.data, req });

        return NextResponse.json(payment, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
