"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    FileText,
    Receipt,
    TrendingUp,
    Users,
    Target,
    Clock,
    Percent,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
    type ChartConfig,
} from "@/components/ui/chart";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { PayablesWidget } from "@/components/dashboard/payables-widget";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { jsonFetcher } from "@/lib/fetcher";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/format";

type ReportResponse = {
    revenue?: {
        totalInvoiced: number;
        totalCollected: number;
        outstanding: number;
        invoiceCount: number;
        overdueCount: number;
    };
    quotations?: {
        total: number;
        count: number;
    };
    expenses?: {
        total: number;
        vatAmount: number;
        count: number;
    };
    vat?: {
        outputVat: number;
        inputVat: number;
        netVatPayable: number;
    };
    vatSummary?: {
        outputVat: number;
        inputVat: number;
        netVatPayable: number;
    };
    invoiceStatusBreakdown?: Array<{
        status: string;
        count: number;
        total: number;
    }>;
    invoicesByStatus?: Array<{
        status: string;
        count: number;
        total: number;
    }>;
    recentInvoices?: Array<{
        id: string;
        invoiceNumber: string;
        status: string;
        total: number;
        outstanding: number;
        issueDate: string;
        customer: {
            id: string;
            name: string;
        };
    }>;
    monthlyTrend?: Array<{ month: string; revenue: number; expenses: number }>;
    kpis?: {
        totalRevenue: number;
        outstandingReceivables: number;
        outstandingPayables: number;
        invoiceCount: number;
        overdueInvoices: number;
        overdueBills: number;
        billCount: number;
        quotationCount: number;
        totalExpenses: number;
        expenseCount: number;
    };
    receivableAging?: {
        current: number;
        days1to30: number;
        days31to60: number;
        days61to90: number;
        days90plus: number;
    };
    topCustomers?: Array<{
        customerId: string;
        name: string;
        total: number;
        count: number;
    }>;
    paymentPatterns?: {
        onTime: number;
        late: number;
        veryLate: number;
    };
    financialHealth?: {
        collectionRate: number;
        profitMargin: number;
        avgDaysToCollect: number;
        revenueGrowth: number;
        expenseRatio: number;
    };
    forecast?: {
        nextMonthRevenue: number;
        nextMonthExpenses: number;
        next3MonthsRevenue: number;
        next3MonthsExpenses: number;
    };
};

type CustomerListResponse = {
    pagination?: {
        total: number;
    };
};

function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat("en-AE", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(amount);
}

function getDashboardStatsData(report: ReportResponse) {
    const revenue = report.revenue ?? {
        totalInvoiced: report.kpis?.totalRevenue ?? 0,
        totalCollected: 0,
        outstanding: report.kpis?.outstandingReceivables ?? 0,
        invoiceCount: report.kpis?.invoiceCount ?? 0,
        overdueCount: report.kpis?.overdueInvoices ?? 0,
    };

    const quotations = report.quotations ?? {
        total: 0,
        count: report.kpis?.quotationCount ?? 0,
    };

    const expenses = report.expenses ?? {
        total: report.kpis?.totalExpenses ?? 0,
        vatAmount: 0,
        count: report.kpis?.expenseCount ?? 0,
    };

    const vat = report.vat ?? report.vatSummary ?? {
        outputVat: 0,
        inputVat: 0,
        netVatPayable: 0,
    };

    const invoiceStatusBreakdown = report.invoiceStatusBreakdown ?? report.invoicesByStatus ?? [];

    return {
        revenue,
        quotations,
        expenses,
        vat,
        invoiceStatusBreakdown,
        recentInvoices: report.recentInvoices ?? [],
    };
}


// shadcn ChartConfig — drives labels + CSS vars for both charts
const barChartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
    expenses: { label: "Expenses", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "hsl(var(--chart-4))",
    SENT: "hsl(var(--chart-5))",
    PAID: "hsl(var(--chart-1))",
    OVERDUE: "hsl(var(--chart-2))",
    PARTIAL: "hsl(var(--chart-3))",
    VOID: "hsl(240 5% 78%)",
};

/** "PARTIAL_PAYMENT" → "Partial Payment", "DRAFT" → "Draft" */
function statusLabel(s: string) {
    return s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

export default function DashboardPage() {
    const t = useTranslations("dashboard");
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const dateFormat = orgSettings.dateFormat;
    const [period, setPeriod] = useState("this_month");
    const { data, isLoading: loading } = useSWR(
        ["dashboard-overview", period],
        async () => {
            const [reportData, customerData] = await Promise.all([
                jsonFetcher<ReportResponse>(`/api/reports?period=${period}`),
                jsonFetcher<CustomerListResponse>("/api/customers?page=1&limit=1").catch(() => null),
            ]);

            return {
                report: reportData,
                customerTotal: customerData?.pagination?.total ?? 0,
            };
        },
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    const report = data?.report ?? null;
    const customerTotal = data?.customerTotal ?? 0;

    const stats = useMemo(() => {
        if (!report) return [];

        const normalized = getDashboardStatsData(report);

        return [
            {
                name: t("revenue.title"),
                value: formatCurrency(normalized.revenue.totalInvoiced, currency),
                description: t("collectedSub", { amount: formatCurrency(normalized.revenue.totalCollected, currency) }),
                trend: normalized.revenue.totalInvoiced >= normalized.revenue.totalCollected ? "up" : "down",
                delta: t("invoicesDelta", { count: normalized.revenue.invoiceCount }),
                icon: TrendingUp,
            },
            {
                name: t("receivables.title"),
                value: formatCurrency(normalized.revenue.outstanding, currency),
                description: t("overdueSub", { count: normalized.revenue.overdueCount }),
                trend: normalized.revenue.overdueCount > 0 ? "down" : "up",
                delta: normalized.revenue.overdueCount > 0 ? t("needsFollowUp") : t("underControl"),
                icon: AlertCircle,
            },
            {
                name: t("payables.title"),
                value: formatCurrency(report.kpis?.outstandingPayables ?? 0, currency),
                description: t("overdueBillsSub", { count: report.kpis?.overdueBills ?? 0 }),
                trend: (report.kpis?.overdueBills ?? 0) > 0 ? "down" : "up",
                delta: t("billsDelta", { count: report.kpis?.billCount ?? 0 }),
                icon: Receipt,
            },
            {
                name: t("totalInvoices"),
                value: String(normalized.revenue.invoiceCount),
                description: t("quotationsCreatedSub", { count: normalized.quotations.count }),
                trend: normalized.revenue.invoiceCount > 0 ? "up" : "down",
                delta: t("quotesDelta", { count: normalized.quotations.count }),
                icon: FileText,
            },
            {
                name: t("activeCustomers"),
                value: String(customerTotal),
                description: t("expensesRecordedSub", { count: normalized.expenses.count }),
                trend: customerTotal > 0 ? "up" : "down",
                delta: formatCurrency(normalized.expenses.total, currency),
                icon: Users,
            },
        ];
    }, [customerTotal, report, currency, t]);

    const recentInvoices = useMemo(() => {
        if (!report) return [];
        return getDashboardStatsData(report).recentInvoices;
    }, [report]);

    const vatSummary = useMemo(() => {
        if (!report) return { outputVat: 0, inputVat: 0, netVatPayable: 0 };
        return getDashboardStatsData(report).vat;
    }, [report]);

    const invoiceStatusBreakdown = useMemo(() => {
        if (!report) return [];
        return getDashboardStatsData(report).invoiceStatusBreakdown;
    }, [report]);

    const monthlyTrend = useMemo(() => report?.monthlyTrend ?? [], [report]);

    const receivableAging = useMemo(() => report?.receivableAging ?? null, [report]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("businessOverview")}</h2>
                    <p className="text-muted-foreground">
                        {t("liveNumbers")}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="this_month">{t("thisMonth")}</SelectItem>
                            <SelectItem value="last_month">{t("lastMonth")}</SelectItem>
                            <SelectItem value="this_quarter">{t("thisQuarter")}</SelectItem>
                            <SelectItem value="last_quarter">{t("lastQuarter")}</SelectItem>
                            <SelectItem value="this_year">{t("thisYear")}</SelectItem>
                            <SelectItem value="last_year">{t("lastYear")}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button asChild>
                        <Link href="/invoices?create=1">
                            <FileText className="mr-2 h-4 w-4" />
                            {t("createInvoice")}
                        </Link>
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {/* Stat card skeletons */}
                    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="rounded-lg border bg-card p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-4 w-4 rounded" />
                                </div>
                                <Skeleton className="h-8 w-32" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        ))}
                    </div>
                    {/* Chart skeleton */}
                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                        <div className="lg:col-span-2 rounded-lg border bg-card p-5 space-y-3">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-[220px] w-full rounded-md" />
                        </div>
                        <div className="rounded-lg border bg-card p-5 space-y-3">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-[220px] w-full rounded-md" />
                        </div>
                    </div>
                    {/* Table skeleton */}
                    <div className="rounded-lg border bg-card p-5 space-y-3">
                        <Skeleton className="h-5 w-40" />
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <Skeleton className="h-4 w-[30%] rounded" />
                                <Skeleton className="h-4 w-[25%] rounded" />
                                <Skeleton className="h-4 w-[20%] rounded" />
                                <Skeleton className="h-4 w-[15%] rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            ) : !report ? (
                <Card>
                    <CardContent className="flex min-h-[18rem] flex-col items-center justify-center gap-3 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground" />
                        <div>
                            <p className="font-medium">{t("dataLoadError")}</p>
                            <p className="text-sm text-muted-foreground">
                                {t("dataLoadErrorDesc")}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {stats.map((stat) => (
                            <Card key={stat.name}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        {stat.name}
                                    </CardTitle>
                                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stat.value}</div>
                                    <div className="mt-1 flex items-center text-xs text-muted-foreground">
                                        {stat.trend === "up" ? (
                                            <ArrowUpRight className="mr-1 h-4 w-4 text-green-500" />
                                        ) : (
                                            <ArrowDownRight className="mr-1 h-4 w-4 text-red-500" />
                                        )}
                                        <span className={stat.trend === "up" ? "text-green-500" : "text-red-500"}>
                                            {stat.delta}
                                        </span>
                                        <span className="ml-1">{stat.description}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-7">
                        {/* Monthly Revenue vs Expenses */}
                        <Card className="lg:col-span-4">
                            <CardHeader>
                                <CardTitle>{t("revenueVsExpenses")}</CardTitle>
                                <CardDescription>{t("last12MonthsOverview")}</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-0">
                                {monthlyTrend.length === 0 ? (
                                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                        {t("noDataPeriod")}
                                    </div>
                                ) : (
                                    <ChartContainer config={barChartConfig} className="h-[240px] w-full">
                                        <BarChart data={monthlyTrend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                                            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        indicator="dot"
                                                        formatter={(value, name) => [
                                                            formatCurrency(Number(value ?? 0), currency),
                                                            barChartConfig[name as keyof typeof barChartConfig]?.label ?? name,
                                                        ]}
                                                    />
                                                }
                                            />
                                            <ChartLegend content={<ChartLegendContent />} />
                                            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ChartContainer>
                                )}
                            </CardContent>
                        </Card>

                        {/* Invoice Status Donut */}
                        <Card className="lg:col-span-3">
                            <CardHeader>
                                <CardTitle>{t("invoiceStatusTitle")}</CardTitle>
                                <CardDescription>{t("invoiceStatusDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-0">
                                {invoiceStatusBreakdown.length === 0 ? (
                                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                        {t("noInvoiceActivity")}
                                    </div>
                                ) : (
                                    <ChartContainer
                                        config={Object.fromEntries(
                                            invoiceStatusBreakdown.map((s) => [
                                                s.status,
                                                { label: statusLabel(s.status), color: STATUS_COLORS[s.status] ?? "hsl(var(--chart-5))" },
                                            ])
                                        )}
                                        className="mx-auto h-[240px]"
                                    >
                                        <PieChart>
                                            <Pie
                                                data={invoiceStatusBreakdown}
                                                dataKey="total"
                                                nameKey="status"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={64}
                                                outerRadius={96}
                                                paddingAngle={3}
                                            >
                                                {invoiceStatusBreakdown.map((entry) => (
                                                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "hsl(var(--chart-5))"} />
                                                ))}
                                            </Pie>
                                            <ChartTooltip
                                                cursor={false}
                                                content={
                                                    <ChartTooltipContent
                                                        hideLabel
                                                        nameKey="status"
                                                        formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
                                                    />
                                                }
                                            />
                                            <ChartLegend
                                                content={<ChartLegendContent nameKey="status" />}
                                            />
                                        </PieChart>
                                    </ChartContainer>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <PayablesWidget />

                    <div className="grid gap-6 lg:grid-cols-7">
                        <Card className="lg:col-span-4">
                            <CardHeader>
                                <CardTitle>{t("recentInvoicesTitle")}</CardTitle>
                                <CardDescription>{t("recentInvoicesDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {recentInvoices.length === 0 ? (
                                    <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                                        {t("noInvoicesCreated")}
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {recentInvoices.map((invoice) => (
                                            <Link
                                                key={invoice.id}
                                                href={`/invoices/${invoice.id}`}
                                                className="flex items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-muted/40"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                                        <FileText className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium leading-5">
                                                            {invoice.customer.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {invoice.invoiceNumber} · {formatDate(invoice.issueDate, dateFormat)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-3">
                                                    <span className="text-sm font-semibold tabular-nums">
                                                        {formatCurrency(invoice.total, currency)}
                                                    </span>
                                                    <StatusBadge status={invoice.status} />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                                <div className="border-t px-6 py-3">
                                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground" asChild>
                                        <Link href="/invoices">{t("viewAllInvoices")}</Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6 lg:col-span-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("quickActions")}</CardTitle>
                                    <CardDescription>{t("quickActionsDesc")}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <Button variant="outline" className="h-auto py-3" asChild>
                                            <Link href="/invoices?create=1">{t("createInvoice")}</Link>
                                        </Button>
                                        <Button variant="outline" className="h-auto py-3" asChild>
                                            <Link href="/customers?create=1">{t("addCustomer")}</Link>
                                        </Button>
                                        <Button variant="outline" className="h-auto py-3" asChild>
                                            <Link href="/quotations?create=1">{t("newQuotation")}</Link>
                                        </Button>
                                        <Button variant="outline" className="h-auto py-3" asChild>
                                            <Link href="/expenses?create=1">{t("recordExpense")}</Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                        <Percent className="h-4 w-4 text-muted-foreground" />
                                        <CardTitle className="text-sm font-medium">{t("vatSummary")}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">{t("outputVat")}</span>
                                        <span className="font-medium">{formatCurrency(vatSummary.outputVat, currency)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">{t("inputVat")}</span>
                                        <span className="font-medium">{formatCurrency(vatSummary.inputVat, currency)}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-t pt-2">
                                        <span className="font-medium">{t("netVatPayable")}</span>
                                        <span className="font-semibold text-primary">{formatCurrency(vatSummary.netVatPayable, currency)}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {receivableAging && (
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">{t("receivableAging")}</CardTitle>
                                        <CardDescription>{t("receivableAgingDesc")}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        {([
                                            { key: "current", label: t("current"), value: receivableAging.current, color: "bg-emerald-500" },
                                            { key: "1-30", label: t("days1to30"), value: receivableAging.days1to30, color: "bg-yellow-400" },
                                            { key: "31-60", label: t("days31to60"), value: receivableAging.days31to60, color: "bg-orange-400" },
                                            { key: "61-90", label: t("days61to90"), value: receivableAging.days61to90, color: "bg-red-400" },
                                            { key: "90+", label: t("days90plus"), value: receivableAging.days90plus, color: "bg-red-600" },
                                        ] as const).map(({ key, label, value, color }) => (
                                            <div key={key} className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                                                    <span className="text-muted-foreground">{label}</span>
                                                </div>
                                                <span className="font-medium tabular-nums">{formatCurrency(value, currency)}</span>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>

                    {/* === Advanced Analytics Row === */}
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Financial Health */}
                        {report.financialHealth && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                        <Target className="h-4 w-4 text-muted-foreground" />
                                        <CardTitle className="text-sm font-medium">{t("financialHealth")}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <HealthRow
                                        label={t("collectionRate")}
                                        value={`${report.financialHealth.collectionRate.toFixed(1)}%`}
                                        pct={report.financialHealth.collectionRate}
                                        color="bg-emerald-500"
                                    />
                                    <HealthRow
                                        label={t("profitMargin")}
                                        value={`${report.financialHealth.profitMargin.toFixed(1)}%`}
                                        pct={Math.max(0, report.financialHealth.profitMargin)}
                                        color="bg-blue-500"
                                    />
                                    <HealthRow
                                        label={t("expenseRatio")}
                                        value={`${report.financialHealth.expenseRatio.toFixed(1)}%`}
                                        pct={Math.min(100, report.financialHealth.expenseRatio)}
                                        color="bg-amber-500"
                                    />
                                    <div className="flex items-center justify-between pt-1">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {t("avgDaysToCollect")}
                                        </span>
                                        <span className="font-medium">{report.financialHealth.avgDaysToCollect} {t("days")}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">{t("revenueGrowth")}</span>
                                        <span className={`font-medium flex items-center gap-1 ${report.financialHealth.revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                                            {report.financialHealth.revenueGrowth >= 0 ? (
                                                <ArrowUpRight className="h-3 w-3" />
                                            ) : (
                                                <ArrowDownRight className="h-3 w-3" />
                                            )}
                                            {report.financialHealth.revenueGrowth.toFixed(1)}%
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Top Customers */}
                        {report.topCustomers && report.topCustomers.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        <CardTitle className="text-sm font-medium">{t("topCustomers")}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    {report.topCustomers.map((c, i) => (
                                        <div key={c.customerId} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                                                <span className="truncate max-w-[140px]">{c.name}</span>
                                            </div>
                                            <div className="text-end">
                                                <span className="font-medium">{formatCurrency(c.total, currency)}</span>
                                                <span className="ml-1 text-xs text-muted-foreground">({c.count})</span>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Payment Patterns + Forecast */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2">
                                    <Percent className="h-4 w-4 text-muted-foreground" />
                                    <CardTitle className="text-sm font-medium">{t("paymentPatterns")}</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {report.paymentPatterns && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                                <span className="text-muted-foreground">{t("onTime")}</span>
                                            </div>
                                            <span className="font-medium">{report.paymentPatterns.onTime}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-yellow-400" />
                                                <span className="text-muted-foreground">{t("late")}</span>
                                            </div>
                                            <span className="font-medium">{report.paymentPatterns.late}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                                <span className="text-muted-foreground">{t("veryLate")}</span>
                                            </div>
                                            <span className="font-medium">{report.paymentPatterns.veryLate}</span>
                                        </div>
                                    </>
                                )}
                                {report.forecast && (
                                    <>
                                        <div className="border-t pt-2 mt-2">
                                            <p className="text-xs text-muted-foreground uppercase font-medium mb-2">{t("forecast")}</p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">{t("nextMonth")}</span>
                                                <span className="font-medium">{formatCurrency(report.forecast.nextMonthRevenue, currency)}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-muted-foreground">{t("next3Months")}</span>
                                                <span className="font-medium">{formatCurrency(report.forecast.next3MonthsRevenue, currency)}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}

function HealthRow({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
        </div>
    );
}
