import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const { searchParams } = new URL(req.url);

        const from = searchParams.get("from")
            ? new Date(searchParams.get("from")!)
            : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const to = searchParams.get("to")
            ? new Date(searchParams.get("to")!)
            : new Date();

        // Outstanding invoices (need payment/reconciliation)
        const outstandingInvoices = await prisma.invoice.findMany({
            where: {
                organizationId: ctx.organizationId,
                deletedAt: null,
                status: { in: ["APPROVED", "SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
                outstanding: { gt: 0 },
            },
            select: {
                id: true,
                invoiceNumber: true,
                issueDate: true,
                dueDate: true,
                status: true,
                total: true,
                amountPaid: true,
                outstanding: true,
                currency: true,
                customer: { select: { id: true, name: true } },
            },
            orderBy: { dueDate: "asc" },
        });

        // Payments in date range with their allocations
        const payments = await prisma.payment.findMany({
            where: {
                organizationId: ctx.organizationId,
                paymentDate: { gte: from, lte: to },
            },
            select: {
                id: true,
                paymentNumber: true,
                paymentDate: true,
                method: true,
                amount: true,
                amountNet: true,
                currency: true,
                reference: true,
                customer: { select: { id: true, name: true } },
                allocations: {
                    select: { invoiceId: true, amount: true },
                },
            },
            orderBy: { paymentDate: "desc" },
        });

        // Identify unallocated payments (allocated < amount)
        const unallocatedPayments = payments
            .map((p) => {
                const allocatedTotal = p.allocations.reduce(
                    (sum, a) => sum + Number(a.amount),
                    0
                );
                const unallocated = Number(p.amount) - allocatedTotal;
                return { ...p, allocatedTotal, unallocated };
            })
            .filter((p) => p.unallocated > 0.01);

        // Summary stats
        const totalOutstanding = outstandingInvoices.reduce(
            (sum, inv) => sum + Number(inv.outstanding),
            0
        );
        const totalPaymentsInPeriod = payments.reduce(
            (sum, p) => sum + Number(p.amount),
            0
        );
        const totalUnallocated = unallocatedPayments.reduce(
            (sum, p) => sum + p.unallocated,
            0
        );
        const reconciledInvoicesCount = await prisma.invoice.count({
            where: {
                organizationId: ctx.organizationId,
                status: "PAID",
                updatedAt: { gte: from, lte: to },
            },
        });

        return NextResponse.json({
            summary: {
                totalOutstanding,
                totalPaymentsInPeriod,
                totalUnallocated,
                reconciledInvoicesCount,
                outstandingInvoicesCount: outstandingInvoices.length,
                unallocatedPaymentsCount: unallocatedPayments.length,
            },
            outstandingInvoices,
            unallocatedPayments,
            allPayments: payments,
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
