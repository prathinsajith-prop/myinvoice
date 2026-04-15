import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

const computeSchema = z.object({
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    save: z.boolean().optional().default(false),
});

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveApiContext(req);

        const rows = await prisma.vatReturn.findMany({
            where: { organizationId: ctx.organizationId },
            orderBy: { periodEnd: "desc" },
            take: 20,
        });

        return NextResponse.json({ data: rows });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveApiContext(req);
        const payload = computeSchema.safeParse(await req.json());

        if (!payload.success) {
            return NextResponse.json(
                { error: "Validation failed", details: payload.error.flatten() },
                { status: 400 }
            );
        }

        const periodStart = new Date(payload.data.periodStart);
        const periodEnd = new Date(payload.data.periodEnd);

        const [invoiceAgg, billAgg, expenseAgg] = await Promise.all([
            prisma.invoice.aggregate({
                where: {
                    organizationId: ctx.organizationId,
                    deletedAt: null,
                    status: { not: "VOID" },
                    issueDate: { gte: periodStart, lte: periodEnd },
                },
                _sum: { total: true, totalVat: true },
            }),
            prisma.bill.aggregate({
                where: {
                    organizationId: ctx.organizationId,
                    deletedAt: null,
                    status: { not: "VOID" },
                    issueDate: { gte: periodStart, lte: periodEnd },
                },
                _sum: { total: true, inputVatAmount: true },
            }),
            prisma.expense.aggregate({
                where: {
                    organizationId: ctx.organizationId,
                    deletedAt: null,
                    expenseDate: { gte: periodStart, lte: periodEnd },
                },
                _sum: { total: true, vatAmount: true },
            }),
        ]);

        const outputVat = Number(invoiceAgg._sum.totalVat ?? 0);
        const inputVat = Number(billAgg._sum.inputVatAmount ?? 0) + Number(expenseAgg._sum.vatAmount ?? 0);
        const netVat = outputVat - inputVat;

        const standardRatedSales = Number(invoiceAgg._sum.total ?? 0);
        const standardRatedPurchases = Number(billAgg._sum.total ?? 0) + Number(expenseAgg._sum.total ?? 0);

        const draft = {
            organizationId: ctx.organizationId,
            periodStart,
            periodEnd,
            dueDate: new Date(periodEnd.getTime() + 28 * 24 * 60 * 60 * 1000),
            standardRatedSales,
            zeroRatedSales: 0,
            exemptSales: 0,
            standardRatedPurchases,
            outputVat,
            inputVat,
            netVat,
            status: "DRAFT",
        };

        if (!payload.data.save) {
            return NextResponse.json({ data: draft, saved: false });
        }

        const saved = await prisma.vatReturn.upsert({
            where: {
                organizationId_periodStart_periodEnd: {
                    organizationId: ctx.organizationId,
                    periodStart,
                    periodEnd,
                },
            },
            create: draft,
            update: {
                dueDate: draft.dueDate,
                standardRatedSales: draft.standardRatedSales,
                zeroRatedSales: draft.zeroRatedSales,
                exemptSales: draft.exemptSales,
                standardRatedPurchases: draft.standardRatedPurchases,
                outputVat: draft.outputVat,
                inputVat: draft.inputVat,
                netVat: draft.netVat,
            },
        });

        return NextResponse.json({ data: saved, saved: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
