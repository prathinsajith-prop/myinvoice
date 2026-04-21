import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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
            monthlyRevenue,
            monthlyExpenseAmts,
            recentInvoices,
            receivableAging,
            payableAging,
            topCustomers,
            paymentPatterns,
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

            // monthly revenue trend — raw SQL aggregation (replaces fetching all rows)
            prisma.$queryRaw<{ month: string; total: number }[]>`
                SELECT to_char(date_trunc('month', "issueDate"), 'YYYY-MM') AS month,
                       SUM("total")::float AS total
                FROM "Invoice"
                WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL
                    AND "status" != 'VOID'
                    AND "issueDate" >= ${new Date(now.getFullYear(), now.getMonth() - 11, 1)}
                GROUP BY 1 ORDER BY 1
            `,

            // monthly expenses trend — raw SQL aggregation
            prisma.$queryRaw<{ month: string; total: number }[]>`
                SELECT to_char(date_trunc('month', "expenseDate"), 'YYYY-MM') AS month,
                       SUM("total")::float AS total
                FROM "Expense"
                WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL
                    AND "expenseDate" >= ${new Date(now.getFullYear(), now.getMonth() - 11, 1)}
                GROUP BY 1 ORDER BY 1
            `,

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

            // Receivable aging — SQL aggregation (replaces fetching all outstanding invoices)
            prisma.$queryRaw<[{ current_amt: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number }]>`
                SELECT
                    COALESCE(SUM("outstanding") FILTER (WHERE "dueDate" >= NOW()), 0)::float AS current_amt,
                    COALESCE(SUM("outstanding") FILTER (WHERE "dueDate" < NOW() AND "dueDate" >= NOW() - INTERVAL '30 days'), 0)::float AS d1_30,
                    COALESCE(SUM("outstanding") FILTER (WHERE "dueDate" < NOW() - INTERVAL '30 days' AND "dueDate" >= NOW() - INTERVAL '60 days'), 0)::float AS d31_60,
                    COALESCE(SUM("outstanding") FILTER (WHERE "dueDate" < NOW() - INTERVAL '60 days' AND "dueDate" >= NOW() - INTERVAL '90 days'), 0)::float AS d61_90,
                    COALESCE(SUM("outstanding") FILTER (WHERE "dueDate" < NOW() - INTERVAL '90 days'), 0)::float AS d90_plus
                FROM "Invoice"
                WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL
                    AND "status" NOT IN ('VOID', 'PAID', 'CREDITED')
                    AND "outstanding" > 0
            `,

            // Payable aging — SQL aggregation (replaces fetching all outstanding bills)
            prisma.$queryRaw<[{ current_amt: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number }]>`
                SELECT
                    COALESCE(SUM("outstanding") FILTER (WHERE "dueDate" >= NOW()), 0)::float AS current_amt,
                    COALESCE(SUM("outstanding") FILTER (WHERE "dueDate" < NOW() AND "dueDate" >= NOW() - INTERVAL '30 days'), 0)::float AS d1_30,
                    COALESCE(SUM("outstanding") FILTER (WHERE "dueDate" < NOW() - INTERVAL '30 days' AND "dueDate" >= NOW() - INTERVAL '60 days'), 0)::float AS d31_60,
                    COALESCE(SUM("outstanding") FILTER (WHERE "dueDate" < NOW() - INTERVAL '60 days' AND "dueDate" >= NOW() - INTERVAL '90 days'), 0)::float AS d61_90,
                    COALESCE(SUM("outstanding") FILTER (WHERE "dueDate" < NOW() - INTERVAL '90 days'), 0)::float AS d90_plus
                FROM "Bill"
                WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL
                    AND "status" NOT IN ('VOID', 'PAID')
                    AND "outstanding" > 0
            `,

            // Top 5 customers — single JOIN query (replaces 2 sequential queries)
            prisma.$queryRaw<{ customer_id: string; name: string; total: number; count: number }[]>`
                SELECT i."customerId" AS customer_id, c."name",
                       SUM(i."total")::float AS total, COUNT(*)::int AS count
                FROM "Invoice" i
                JOIN "Customer" c ON c."id" = i."customerId"
                WHERE i."organizationId" = ${orgId} AND i."deletedAt" IS NULL
                    AND i."status" != 'VOID'
                    AND i."issueDate" >= ${from} AND i."issueDate" <= ${to}
                GROUP BY i."customerId", c."name"
                ORDER BY total DESC
                LIMIT 5
            `,

            // Payment patterns — SQL aggregation (replaces fetching all paid invoices)
            prisma.$queryRaw<[{ on_time: number; late: number; very_late: number; avg_days: number }]>`
                SELECT
                    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM ("updatedAt" - "dueDate")) / 86400 <= 0)::int AS on_time,
                    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM ("updatedAt" - "dueDate")) / 86400 > 0
                        AND EXTRACT(EPOCH FROM ("updatedAt" - "dueDate")) / 86400 <= 30)::int AS late,
                    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM ("updatedAt" - "dueDate")) / 86400 > 30)::int AS very_late,
                    COALESCE(ROUND(AVG(GREATEST(0, EXTRACT(EPOCH FROM ("updatedAt" - "dueDate")) / 86400)))::int, 0) AS avg_days
                FROM "Invoice"
                WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL
                    AND "status" = 'PAID'
                    AND "issueDate" >= ${from} AND "issueDate" <= ${to}
            `,
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

        // Build monthly trend from pre-aggregated SQL results (at most 12 + 12 rows)
        const monthlyMap: Record<string, { revenue: number; expenses: number }> = {};
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            monthlyMap[key] = { revenue: 0, expenses: 0 };
        }
        for (const r of monthlyRevenue) {
            if (monthlyMap[r.month]) monthlyMap[r.month].revenue = r.total;
        }
        for (const e of monthlyExpenseAmts) {
            if (monthlyMap[e.month]) monthlyMap[e.month].expenses = e.total;
        }
        const monthlyTrend = Object.entries(monthlyMap).map(([key, vals]) => {
            const [y, m] = key.split("-");
            const d = new Date(Number(y), Number(m) - 1, 1);
            return { month: d.toLocaleString("en", { month: "short", year: "numeric" }), ...vals };
        });

        // Aging — read directly from SQL aggregation (no in-memory bucketing)
        const aging = {
            current: receivableAging[0].current_amt,
            days1to30: receivableAging[0].d1_30,
            days31to60: receivableAging[0].d31_60,
            days61to90: receivableAging[0].d61_90,
            days90plus: receivableAging[0].d90_plus,
        };

        const billAgingResult = {
            current: payableAging[0].current_amt,
            days1to30: payableAging[0].d1_30,
            days31to60: payableAging[0].d31_60,
            days61to90: payableAging[0].d61_90,
            days90plus: payableAging[0].d90_plus,
        };

        // Top customers — already aggregated with customer names from SQL JOIN
        const topCustomersResult = topCustomers.map((c) => ({
            customerId: c.customer_id,
            name: c.name,
            total: c.total,
            count: c.count,
        }));

        // Payment patterns — read from SQL aggregation
        const pp = paymentPatterns[0];
        const avgDaysToCollect = pp.avg_days;
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
            billAging: billAgingResult,
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
            topCustomers: topCustomersResult,
            paymentPatterns: {
                onTime: pp.on_time,
                late: pp.late,
                veryLate: pp.very_late,
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
        }, {
            headers: {
                // Per-user private cache: browser treats as fresh for 30s,
                // then serves stale for up to 5 minutes while revalidating.
                // Aggregations don't need to be real-time.
                "Cache-Control": "private, max-age=30, stale-while-revalidate=300",
            },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
