"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/format";
import { Loader2, TrendingUp, TrendingDown, DollarSign, FileText, Receipt, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
    type ChartConfig,
} from "@/components/ui/chart";

interface KPIs {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    netProfitMargin: number;
    outstandingReceivables: number;
    outstandingPayables: number;
    overdueInvoices: number;
    overdueBills: number;
    totalVatCollected: number;
    totalVatPaid: number;
    netVatPayable: number;
    invoiceCount: number;
    paidInvoiceCount: number;
    billCount: number;
    paidBillCount: number;
    expenseCount: number;
    quotationCount: number;
    conversionRate: number;
}

interface StatusBreakdown {
    status: string;
    count: number;
    total: number;
}

interface ReportData {
    period: { start: string; end: string };
    kpis: KPIs;
    invoicesByStatus: StatusBreakdown[];
    billsByStatus: StatusBreakdown[];
    expensesByCategory: Array<{ category: string; count: number; total: number }>;
    vatSummary: {
        outputVat: number;
        inputVat: number;
        netVatPayable: number;
    };
    receivableAging?: {
        current: number;
        days1to30: number;
        days31to60: number;
        days61to90: number;
        days90plus: number;
    };
    billAging?: {
        current: number;
        days1to30: number;
        days31to60: number;
        days61to90: number;
        days90plus: number;
    };
    monthlyTrend?: Array<{ month: string; revenue: number; expenses: number }>;
}

const PERIOD_VALUES = ["this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year"] as const;

// Uses CSS chart variables so colours respect light/dark mode
const CATEGORY_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
];

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "hsl(var(--chart-4))",
    SENT: "hsl(var(--chart-5))",
    PAID: "hsl(var(--chart-1))",
    OVERDUE: "hsl(var(--chart-2))",
    PARTIAL: "hsl(var(--chart-3))",
    VOID: "hsl(240 5% 78%)",
};

const trendChartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
    expenses: { label: "Expenses", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const billsChartConfig = {
    total: { label: "Amount", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

function fmt(n: number, currency: string) {
    return `${currency} ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "PARTIAL_PAYMENT" → "Partial Payment", "DRAFT" → "Draft" */
function statusLabel(s: string) {
    return s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

function KpiCard({ title, value, sub, icon: Icon, trend }: {
    title: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    trend?: "up" | "down" | "neutral";
}) {
    return (
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {sub && (
                    <p className={`text-xs mt-1 flex items-center gap-1 ${trend === "up" ? "text-green-600" : trend === "down" ? "text-destructive" : "text-muted-foreground"}`}>
                        {trend === "up" && <TrendingUp className="h-3 w-3" />}
                        {trend === "down" && <TrendingDown className="h-3 w-3" />}
                        {sub}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export default function ReportsPage() {
    const [period, setPeriod] = useState("this_month");
    const t = useTranslations("reports");
    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const dateFormat = orgSettings.dateFormat;

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports?period=${period}`);
            if (res.ok) setReport(await res.json());
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    const kpis = report?.kpis;
    const isProfit = (kpis?.netProfit ?? 0) >= 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                    <p className="text-muted-foreground">
                        {report
                            ? `${formatDate(report.period.start, dateFormat)} – ${formatDate(report.period.end, dateFormat)}`
                            : t("financialOverview")}
                    </p>
                </div>
                <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {PERIOD_VALUES.map((v) => <SelectItem key={v} value={v}>{t(`periods.${v}`)}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : !report ? (
                <p className="text-muted-foreground text-sm">{t("failedToLoad")}</p>
            ) : (
                <>
                    {/* P&L Overview */}
                    <div>
                        <h2 className="text-base font-semibold mb-3">{t("profitAndLoss")}</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <KpiCard
                                title={t("totalRevenue")}
                                value={fmt(kpis!.totalRevenue, currency)}
                                sub={t("invoicesSub", { count: kpis!.invoiceCount })}
                                icon={DollarSign}
                                trend="up"
                            />
                            <KpiCard
                                title={t("totalExpenses")}
                                value={fmt(kpis!.totalExpenses, currency)}
                                sub={t("billsAndExpenses")}
                                icon={CreditCard}
                            />
                            <KpiCard
                                title={t("netProfit")}
                                value={fmt(kpis!.netProfit, currency)}
                                sub={t("marginSub", { value: (kpis!.netProfitMargin ?? 0).toFixed(1) })}
                                icon={isProfit ? TrendingUp : TrendingDown}
                                trend={isProfit ? "up" : "down"}
                            />
                            <KpiCard
                                title={t("quotationConversion")}
                                value={`${(kpis!.conversionRate ?? 0).toFixed(1)}%`}
                                sub={t("quotesSub", { count: kpis!.quotationCount })}
                                icon={FileText}
                                trend="neutral"
                            />
                        </div>
                    </div>

                    {/* Receivables & Payables */}
                    <div>
                        <h2 className="text-base font-semibold mb-3">{t("cashFlowSection")}</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <KpiCard
                                title={t("outstandingReceivables")}
                                value={fmt(kpis!.outstandingReceivables, currency)}
                                sub={t("awaitingCollection")}
                                icon={TrendingUp}
                            />
                            <KpiCard
                                title={t("overdueInvoices")}
                                value={String(kpis!.overdueInvoices)}
                                sub={kpis!.overdueInvoices > 0 ? t("requiresAttention") : t("allCurrent")}
                                icon={Receipt}
                                trend={kpis!.overdueInvoices > 0 ? "down" : "neutral"}
                            />
                            <KpiCard
                                title={t("outstandingPayables")}
                                value={fmt(kpis!.outstandingPayables, currency)}
                                sub={t("toBePaid")}
                                icon={TrendingDown}
                            />
                            <KpiCard
                                title={t("overdueBills")}
                                value={String(kpis!.overdueBills)}
                                sub={kpis!.overdueBills > 0 ? t("requiresAttention") : t("allCurrent")}
                                icon={Receipt}
                                trend={kpis!.overdueBills > 0 ? "down" : "neutral"}
                            />
                        </div>
                    </div>

                    {/* Monthly Trend Chart */}
                    {(report.monthlyTrend ?? []).length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("revExpTrend")}</CardTitle>
                                <CardDescription>{t("last12Months")}</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-0">
                                <ChartContainer config={trendChartConfig} className="h-[240px] w-full">
                                    <AreaChart data={report.monthlyTrend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--color-expenses)" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="var(--color-expenses)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                        <ChartTooltip
                                            content={
                                                <ChartTooltipContent
                                                    indicator="dot"
                                                    formatter={(value, name) => [
                                                        fmt(Number(value ?? 0), currency),
                                                        trendChartConfig[name as keyof typeof trendChartConfig]?.label ?? name,
                                                    ]}
                                                />
                                            }
                                        />
                                        <ChartLegend content={<ChartLegendContent />} />
                                        <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" fill="url(#fillRevenue)" strokeWidth={2} dot={false} />
                                        <Area type="monotone" dataKey="expenses" stroke="var(--color-expenses)" fill="url(#fillExpenses)" strokeWidth={2} dot={false} />
                                    </AreaChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* VAT Summary + Receivable Aging + Payable Aging */}
                    <div className="grid gap-6 lg:grid-cols-3">
                        <Card>
                            <CardHeader><CardTitle className="text-base">{t("vatSummaryTitle")}</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t("outputVatLabel")}</span>
                                    <span className="font-medium">{fmt(report.vatSummary?.outputVat ?? kpis!.totalVatCollected, currency)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t("inputVatLabel")}</span>
                                    <span className="font-medium">{fmt(report.vatSummary?.inputVat ?? kpis!.totalVatPaid, currency)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-3 font-semibold">
                                    <span>{t("netVatPayableLabel")}</span>
                                    <span className={(report.vatSummary?.netVatPayable ?? kpis!.netVatPayable) >= 0 ? "text-destructive" : "text-green-600"}>
                                        {fmt(report.vatSummary?.netVatPayable ?? kpis!.netVatPayable, currency)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">{t("invoiceAgingTitle")}</CardTitle>
                                <CardDescription>{t("invoiceAgingDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("agingCurrent")}</span><span className="font-medium">{fmt(report.receivableAging?.current ?? 0, currency)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("aging1to30")}</span><span className="font-medium">{fmt(report.receivableAging?.days1to30 ?? 0, currency)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("aging31to60")}</span><span className="font-medium">{fmt(report.receivableAging?.days31to60 ?? 0, currency)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("aging61to90")}</span><span className="font-medium">{fmt(report.receivableAging?.days61to90 ?? 0, currency)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("aging90plus")}</span><span className="font-medium text-destructive">{fmt(report.receivableAging?.days90plus ?? 0, currency)}</span></div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">{t("billAgingTitle")}</CardTitle>
                                <CardDescription>{t("billAgingDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("agingCurrent")}</span><span className="font-medium">{fmt(report.billAging?.current ?? 0, currency)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("aging1to30")}</span><span className="font-medium">{fmt(report.billAging?.days1to30 ?? 0, currency)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("aging31to60")}</span><span className="font-medium">{fmt(report.billAging?.days31to60 ?? 0, currency)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("aging61to90")}</span><span className="font-medium">{fmt(report.billAging?.days61to90 ?? 0, currency)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("aging90plus")}</span><span className="font-medium text-destructive">{fmt(report.billAging?.days90plus ?? 0, currency)}</span></div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Expenses by Category */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("expensesByCategoryTitle")}</CardTitle>
                            <CardDescription>{t("expensesByCategoryDesc")}</CardDescription>
                        </CardHeader>
                        <CardContent className="pb-0">
                            {report.expensesByCategory && report.expensesByCategory.length > 0 ? (
                                <ChartContainer
                                    config={Object.fromEntries(
                                        report.expensesByCategory.slice(0, 8).map((c, i) => [
                                            c.category,
                                            { label: t(`categories.${c.category}`), color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] },
                                        ])
                                    )}
                                    className="h-[220px] w-full"
                                >
                                    <BarChart
                                        data={report.expensesByCategory.slice(0, 8).map((c) => ({
                                            name: t(`categories.${c.category}`),
                                            total: c.total,
                                        }))}
                                        layout="vertical"
                                        margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={120} />
                                        <ChartTooltip
                                            content={
                                                <ChartTooltipContent
                                                    hideIndicator
                                                    formatter={(value, _name, item) => [
                                                        fmt(Number(value ?? 0), currency),
                                                        String(item?.payload?.name ?? _name),
                                                    ]}
                                                />
                                            }
                                        />
                                        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                                            {report.expensesByCategory.slice(0, 8).map((entry, i) => (
                                                <Cell key={entry.category ?? i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            ) : (
                                <p className="text-sm text-muted-foreground">{t("noExpenses")}</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Invoice status chart + Bills by Status */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("invoicesByStatus")}</CardTitle>
                                <CardDescription>{t("invoicesByStatusDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-0">
                                {report.invoicesByStatus && report.invoicesByStatus.length > 0 ? (
                                    <ChartContainer
                                        config={Object.fromEntries(
                                            report.invoicesByStatus.map((s) => [
                                                s.status,
                                                { label: statusLabel(s.status), color: STATUS_COLORS[s.status] ?? "hsl(var(--chart-5))" },
                                            ])
                                        )}
                                        className="mx-auto h-[240px]"
                                    >
                                        <PieChart>
                                            <Pie
                                                data={report.invoicesByStatus}
                                                dataKey="total"
                                                nameKey="status"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={64}
                                                outerRadius={96}
                                                paddingAngle={3}
                                            >
                                                {report.invoicesByStatus.map((entry) => (
                                                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "hsl(var(--chart-5))"} />
                                                ))}
                                            </Pie>
                                            <ChartTooltip
                                                cursor={false}
                                                content={
                                                    <ChartTooltipContent
                                                        hideLabel
                                                        nameKey="status"
                                                        formatter={(value) => fmt(Number(value ?? 0), currency)}
                                                    />
                                                }
                                            />
                                            <ChartLegend
                                                content={<ChartLegendContent nameKey="status" />}
                                            />
                                        </PieChart>
                                    </ChartContainer>
                                ) : (
                                    <p className="text-sm text-muted-foreground">{t("noInvoices")}</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t("billsByStatus")}</CardTitle>
                                <CardDescription>{t("billsByStatusDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-0">
                                {report.billsByStatus && report.billsByStatus.length > 0 ? (
                                    <ChartContainer config={billsChartConfig} className="h-[240px] w-full">
                                        <BarChart
                                            data={report.billsByStatus.map((s) => ({
                                                name: statusLabel(s.status),
                                                total: s.total,
                                                count: s.count,
                                            }))}
                                            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        formatter={(value, _name, item) => [
                                                            fmt(Number(value ?? 0), currency),
                                                            String(item?.payload?.name ?? _name),
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ChartContainer>
                                ) : (
                                    <p className="text-sm text-muted-foreground">{t("noBills")}</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
