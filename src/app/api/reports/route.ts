import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

function getPeriodRange(period: string): { from: Date; to: Date } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    switch (period) {
        case "last_month": {
            const from = new Date(y, m - 1, 1);
            const to = new Date(y, m, 0, 23, 59, 59, 999);
            return { from, to };
        }
        case "this_quarter": {
            const qStart = Math.floor(m / 3) * 3;
            return { from: new Date(y, qStart, 1), to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999) };
        }
        case "last_quarter": {
            const qStart = Math.floor(m / 3) * 3 - 3;
            return { from: new Date(y, qStart, 1), to: new Date(y, qStart + 3, 0, 23, 59, 59, 999) };
        }
        case "this_year":
            return { from: new Date(y, 0, 1), to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999) };
        case "last_year":
            return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31, 23, 59, 59, 999) };
        case "this_month":
        default:
            return { from: new Date(y, m, 1), to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999) };
    }
}

/**
 * GET /api/reports
 * Query params: period (this_month | last_month | this_quarter | last_quarter | this_year | last_year)
 * Returns KPIs and breakdowns matching the ReportData interface.
 */
export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveApiContext(req);
        const { searchParams } = new URL(req.url);
        const period = searchParams.get("period") ?? "this_month";
        const { from, to } = getPeriodRange(period);

        const now = new Date();
        const orgId = ctx.organizationId;

        const [
            invoiceSummary,
            paidInvoiceCount,
            quotationSummary,
            convertedQuotationCount,
            billSummary,
            paidBillCount,
            expenseSummary,
            overdueInvoices,
            overdueBills,
            invoiceStatusCounts,
            billStatusCounts,
            expenseCategoryCounts,
        ] = await Promise.all([
            prisma.invoice.aggregate({
                where: { organizationId: orgId, deletedAt: null, status: { not: "VOID" }, issueDate: { gte: from, lte: to } },
                _sum: { total: true, amountPaid: true, outstanding: true, totalVat: true },
                _count: { _all: true },
            }),

            prisma.invoice.count({
                where: { organizationId: orgId, deletedAt: null, status: "PAID", issueDate: { gte: from, lte: to } },
            }),

            prisma.quotation.aggregate({
                where: { organizationId: orgId, deletedAt: null, issueDate: { gte: from, lte: to } },
                _count: { _all: true },
            }),

            prisma.quotation.count({
                where: { organizationId: orgId, deletedAt: null, status: "CONVERTED", issueDate: { gte: from, lte: to } },
            }),

            prisma.bill.aggregate({
                where: { organizationId: orgId, deletedAt: null, status: { not: "VOID" }, issueDate: { gte: from, lte: to } },
                _sum: { total: true, amountPaid: true, outstanding: true, inputVatAmount: true },
                _count: { _all: true },
            }),

            prisma.bill.count({
                where: { organizationId: orgId, deletedAt: null, status: "PAID", issueDate: { gte: from, lte: to } },
            }),

            prisma.expense.aggregate({
                where: { organizationId: orgId, deletedAt: null, expenseDate: { gte: from, lte: to } },
                _sum: { total: true, vatAmount: true },
                _count: { _all: true },
            }),

            prisma.invoice.count({
                where: { organizationId: orgId, deletedAt: null, status: { notIn: ["VOID", "PAID"] }, dueDate: { lt: now }, outstanding: { gt: 0 } },
            }),

            prisma.bill.count({
                where: { organizationId: orgId, deletedAt: null, status: { notIn: ["VOID", "PAID"] }, dueDate: { lt: now }, outstanding: { gt: 0 } },
            }),

            prisma.invoice.groupBy({
                by: ["status"],
                where: { organizationId: orgId, deletedAt: null, issueDate: { gte: from, lte: to } },
                _count: { _all: true },
                _sum: { total: true },
            }),

            prisma.bill.groupBy({
                by: ["status"],
                where: { organizationId: orgId, deletedAt: null, issueDate: { gte: from, lte: to } },
                _count: { _all: true },
                _sum: { total: true },
            }),

            prisma.expense.groupBy({
                by: ["category"],
                where: { organizationId: orgId, deletedAt: null, expenseDate: { gte: from, lte: to } },
                _count: { _all: true },
                _sum: { total: true },
                orderBy: { _sum: { total: "desc" } },
            }),
        ]);

        const totalRevenue = Number(invoiceSummary._sum.total ?? 0);
        const totalBills = Number(billSummary._sum.total ?? 0);
        const totalExpenses = Number(expenseSummary._sum.total ?? 0);
        const combinedExpenses = totalBills + totalExpenses;
        const netProfit = totalRevenue - combinedExpenses;
        const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        const invoiceCount = invoiceSummary._count._all;
        const quotationCount = quotationSummary._count._all;
        const conversionRate = quotationCount > 0 ? (convertedQuotationCount / quotationCount) * 100 : 0;

        const outputVat = Number(invoiceSummary._sum.totalVat ?? 0);
        const inputVat = Number(billSummary._sum.inputVatAmount ?? 0) + Number(expenseSummary._sum.vatAmount ?? 0);
        const netVatPayable = outputVat - inputVat;

        return NextResponse.json({
            period: { start: from.toISOString(), end: to.toISOString() },
            kpis: {
                totalRevenue,
                totalExpenses: combinedExpenses,
                netProfit,
                netProfitMargin,
                outstandingReceivables: Number(invoiceSummary._sum.outstanding ?? 0),
                outstandingPayables: Number(billSummary._sum.outstanding ?? 0),
                overdueInvoices,
                overdueBills,
                totalVatCollected: outputVat,
                totalVatPaid: inputVat,
                netVatPayable,
                invoiceCount,
                paidInvoiceCount,
                billCount: billSummary._count._all,
                paidBillCount,
                expenseCount: expenseSummary._count._all,
                quotationCount,
                conversionRate,
            },
            invoicesByStatus: invoiceStatusCounts.map((s) => ({
                status: s.status,
                count: s._count._all,
                total: Number(s._sum.total ?? 0),
            })),
            billsByStatus: billStatusCounts.map((s) => ({
                status: s.status,
                count: s._count._all,
                total: Number(s._sum.total ?? 0),
            })),
            expensesByCategory: expenseCategoryCounts.map((c) => ({
                category: c.category,
                count: c._count._all,
                total: Number(c._sum.total ?? 0),
            })),
            vatSummary: { outputVat, inputVat, netVatPayable },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
