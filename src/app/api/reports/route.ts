import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

/**
 * GET /api/reports
 * Query params: from, to (ISO datetime strings)
 * Returns summary KPIs and VAT breakdown for the organization's date range.
 */
export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveApiContext(req);
        const { searchParams } = new URL(req.url);

        const now = new Date();
        const fromParam = searchParams.get("from");
        const toParam = searchParams.get("to");

        const from = fromParam
            ? new Date(fromParam)
            : new Date(now.getFullYear(), now.getMonth(), 1); // start of current month
        const to = toParam ? new Date(toParam) : now;

        const orgId = ctx.organizationId;

        const [
            invoiceSummary,
            quotationSummary,
            billSummary,
            expenseSummary,
            overdueInvoices,
            overdueBills,
            recentInvoices,
            invoiceStatusCounts,
        ] = await Promise.all([
            // Revenue: total invoiced, total collected, outstanding
            prisma.invoice.aggregate({
                where: { organizationId: orgId, deletedAt: null, status: { not: "VOID" }, issueDate: { gte: from, lte: to } },
                _sum: { total: true, paidAmount: true, outstandingAmount: true, totalVat: true },
                _count: { _all: true },
            }),

            // Quotations issued
            prisma.quotation.aggregate({
                where: { organizationId: orgId, deletedAt: null, issueDate: { gte: from, lte: to } },
                _sum: { total: true },
                _count: { _all: true },
            }),

            // Bills payable
            prisma.bill.aggregate({
                where: { organizationId: orgId, deletedAt: null, status: { not: "VOID" }, issueDate: { gte: from, lte: to } },
                _sum: { total: true, amountPaid: true, outstanding: true, inputVatAmount: true },
                _count: { _all: true },
            }),

            // Expenses
            prisma.expense.aggregate({
                where: { organizationId: orgId, deletedAt: null, expenseDate: { gte: from, lte: to } },
                _sum: { total: true, vatAmount: true },
                _count: { _all: true },
            }),

            // Overdue invoices (not VOID, outstanding > 0, dueDate < now)
            prisma.invoice.count({
                where: { organizationId: orgId, deletedAt: null, status: { notIn: ["VOID", "PAID"] }, dueDate: { lt: now }, outstandingAmount: { gt: 0 } },
            }),

            // Overdue bills
            prisma.bill.count({
                where: { organizationId: orgId, deletedAt: null, status: { notIn: ["VOID", "PAID"] }, dueDate: { lt: now }, outstanding: { gt: 0 } },
            }),

            // Recent 5 invoices
            prisma.invoice.findMany({
                where: { organizationId: orgId, deletedAt: null },
                include: { customer: { select: { id: true, name: true } } },
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                    id: true,
                    invoiceNumber: true,
                    status: true,
                    total: true,
                    outstandingAmount: true,
                    dueDate: true,
                    issueDate: true,
                    customer: { select: { id: true, name: true } },
                },
            }),

            // Invoice status breakdown
            prisma.invoice.groupBy({
                by: ["status"],
                where: { organizationId: orgId, deletedAt: null, issueDate: { gte: from, lte: to } },
                _count: { _all: true },
                _sum: { total: true },
            }),
        ]);

        const outputVat = Number(invoiceSummary._sum.totalVat ?? 0);
        const inputVat = Number(billSummary._sum.inputVatAmount ?? 0) + Number(expenseSummary._sum.vatAmount ?? 0);
        const netVatPayable = outputVat - inputVat;

        return NextResponse.json({
            period: { from: from.toISOString(), to: to.toISOString() },
            revenue: {
                totalInvoiced: Number(invoiceSummary._sum.total ?? 0),
                totalCollected: Number(invoiceSummary._sum.paidAmount ?? 0),
                outstanding: Number(invoiceSummary._sum.outstandingAmount ?? 0),
                invoiceCount: invoiceSummary._count._all,
                overdueCount: overdueInvoices,
            },
            quotations: {
                total: Number(quotationSummary._sum.total ?? 0),
                count: quotationSummary._count._all,
            },
            payables: {
                totalBilled: Number(billSummary._sum.total ?? 0),
                totalPaid: Number(billSummary._sum.amountPaid ?? 0),
                outstanding: Number(billSummary._sum.outstanding ?? 0),
                billCount: billSummary._count._all,
                overdueCount: overdueBills,
            },
            expenses: {
                total: Number(expenseSummary._sum.total ?? 0),
                vatAmount: Number(expenseSummary._sum.vatAmount ?? 0),
                count: expenseSummary._count._all,
            },
            vat: {
                outputVat,
                inputVat,
                netVatPayable,
            },
            invoiceStatusBreakdown: invoiceStatusCounts.map((s) => ({
                status: s.status,
                count: s._count._all,
                total: Number(s._sum.total ?? 0),
            })),
            recentInvoices,
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
