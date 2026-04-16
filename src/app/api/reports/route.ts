import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
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
        const ctx = await resolveRouteContext(req);
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
            monthlyInvoices,
            monthlyExpenses,
            recentInvoices,
            receivableAgingInvoices,
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

            // monthly trend — last 12 months
            prisma.invoice.findMany({
                where: { organizationId: orgId, deletedAt: null, status: { not: "VOID" }, issueDate: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } },
                select: { issueDate: true, total: true },
            }),

            prisma.expense.findMany({
                where: { organizationId: orgId, deletedAt: null, expenseDate: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } },
                select: { expenseDate: true, total: true },
            }),

            // recent invoices for dashboard
            prisma.invoice.findMany({
                where: { organizationId: orgId, deletedAt: null },
                orderBy: { issueDate: "desc" },
                take: 5,
                select: {
                    id: true,
                    invoiceNumber: true,
                    status: true,
                    total: true,
                    outstanding: true,
                    issueDate: true,
                    customer: { select: { id: true, name: true } },
                },
            }),

            prisma.invoice.findMany({
                where: {
                    organizationId: orgId,
                    deletedAt: null,
                    status: { notIn: ["VOID", "PAID", "CREDITED"] },
                    outstanding: { gt: 0 },
                },
                select: { dueDate: true, outstanding: true },
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

        // Build monthly trend (last 12 months)
        const monthlyMap: Record<string, { revenue: number; expenses: number }> = {};
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const label = d.toLocaleString("en", { month: "short", year: "numeric" });
            monthlyMap[key] = { revenue: 0, expenses: 0 };
            void label;
        }
        for (const inv of monthlyInvoices) {
            const d = new Date(inv.issueDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (monthlyMap[key]) monthlyMap[key].revenue += Number(inv.total ?? 0);
        }
        for (const exp of monthlyExpenses) {
            const d = new Date(exp.expenseDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (monthlyMap[key]) monthlyMap[key].expenses += Number(exp.total ?? 0);
        }
        const monthlyTrend = Object.entries(monthlyMap).map(([key, vals]) => {
            const [y, m] = key.split("-");
            const d = new Date(Number(y), Number(m) - 1, 1);
            return { month: d.toLocaleString("en", { month: "short", year: "numeric" }), ...vals };
        });

        const aging = {
            current: 0,
            days1to30: 0,
            days31to60: 0,
            days61to90: 0,
            days90plus: 0,
        };

        for (const inv of receivableAgingInvoices) {
            const outstanding = Number(inv.outstanding || 0);
            const diffMs = now.getTime() - new Date(inv.dueDate).getTime();
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (days <= 0) aging.current += outstanding;
            else if (days <= 30) aging.days1to30 += outstanding;
            else if (days <= 60) aging.days31to60 += outstanding;
            else if (days <= 90) aging.days61to90 += outstanding;
            else aging.days90plus += outstanding;
        }

        // === Advanced Analytics ===

        // Top 5 customers by revenue
        const topCustomersRaw = await prisma.invoice.groupBy({
            by: ["customerId"],
            where: { organizationId: orgId, deletedAt: null, status: { not: "VOID" }, issueDate: { gte: from, lte: to } },
            _sum: { total: true },
            _count: { _all: true },
            orderBy: { _sum: { total: "desc" } },
            take: 5,
        });

        const topCustomerIds = topCustomersRaw.map((c) => c.customerId);
        const topCustomerNames = topCustomerIds.length > 0
            ? await prisma.customer.findMany({
                where: { id: { in: topCustomerIds } },
                select: { id: true, name: true },
            })
            : [];
        const customerNameMap = new Map(topCustomerNames.map((c) => [c.id, c.name]));

        const topCustomers = topCustomersRaw.map((c) => ({
            customerId: c.customerId,
            name: customerNameMap.get(c.customerId) ?? "Unknown",
            total: Number(c._sum.total ?? 0),
            count: c._count._all,
        }));

        // Payment patterns: on-time vs late vs very late
        const paidInvoices = await prisma.invoice.findMany({
            where: {
                organizationId: orgId,
                deletedAt: null,
                status: "PAID",
                issueDate: { gte: from, lte: to },
            },
            select: { dueDate: true, updatedAt: true },
        });

        let onTimeCount = 0;
        let lateCount = 0;
        let veryLateCount = 0;
        let totalDaysToCollect = 0;

        for (const inv of paidInvoices) {
            const daysDiff = Math.floor(
                (new Date(inv.updatedAt).getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            totalDaysToCollect += Math.max(0, daysDiff);
            if (daysDiff <= 0) onTimeCount++;
            else if (daysDiff <= 30) lateCount++;
            else veryLateCount++;
        }

        const avgDaysToCollect = paidInvoices.length > 0 ? Math.round(totalDaysToCollect / paidInvoices.length) : 0;
        const collectionRate = invoiceCount > 0 ? (paidInvoiceCount / invoiceCount) * 100 : 0;

        // Revenue forecast (simple linear projection from monthly trend)
        const trendValues = Object.values(monthlyMap);
        const recentRevenue = trendValues.slice(-3);
        const recentExpenses = trendValues.slice(-3);
        const avgRecentRevenue = recentRevenue.length > 0
            ? recentRevenue.reduce((s, v) => s + v.revenue, 0) / recentRevenue.length
            : 0;
        const avgRecentExpenses = recentExpenses.length > 0
            ? recentExpenses.reduce((s, v) => s + v.expenses, 0) / recentExpenses.length
            : 0;

        // Growth rate
        const prevMonthRevenue = trendValues.length >= 2 ? trendValues[trendValues.length - 2].revenue : 0;
        const currMonthRevenue = trendValues.length >= 1 ? trendValues[trendValues.length - 1].revenue : 0;
        const revenueGrowth = prevMonthRevenue > 0 ? ((currMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;
        const expenseRatio = totalRevenue > 0 ? (combinedExpenses / totalRevenue) * 100 : 0;

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
            receivableAging: aging,
            monthlyTrend,
            recentInvoices: recentInvoices.map((inv) => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                status: inv.status,
                total: Number(inv.total),
                outstanding: Number(inv.outstanding),
                issueDate: inv.issueDate.toISOString(),
                customer: inv.customer,
            })),
            // Advanced analytics
            topCustomers,
            paymentPatterns: {
                onTime: onTimeCount,
                late: lateCount,
                veryLate: veryLateCount,
            },
            financialHealth: {
                collectionRate,
                profitMargin: netProfitMargin,
                avgDaysToCollect,
                revenueGrowth,
                expenseRatio,
            },
            forecast: {
                nextMonthRevenue: avgRecentRevenue,
                nextMonthExpenses: avgRecentExpenses,
                next3MonthsRevenue: avgRecentRevenue * 3,
                next3MonthsExpenses: avgRecentExpenses * 3,
            },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
