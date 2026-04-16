"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
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
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

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
    monthlyTrend?: Array<{ month: string; revenue: number; expenses: number }>;
}

const PERIODS = [
    { value: "this_month", label: "This Month" },
    { value: "last_month", label: "Last Month" },
    { value: "this_quarter", label: "This Quarter" },
    { value: "last_quarter", label: "Last Quarter" },
    { value: "this_year", label: "This Year" },
    { value: "last_year", label: "Last Year" },
];

const CATEGORY_LABELS: Record<string, string> = {
    RENT: "Rent",
    UTILITIES: "Utilities",
    TRAVEL: "Travel",
    MEALS_ENTERTAINMENT: "Meals & Entertainment",
    OFFICE_SUPPLIES: "Office Supplies",
    MARKETING: "Marketing",
    SOFTWARE_SUBSCRIPTIONS: "Software Subscriptions",
    PROFESSIONAL_FEES: "Professional Fees",
    INSURANCE: "Insurance",
    MAINTENANCE_REPAIRS: "Maintenance & Repairs",
    SALARIES_WAGES: "Salaries & Wages",
    TAX_PAYMENTS: "Tax Payments",
    BANK_CHARGES: "Bank Charges",
    OTHER: "Other",
};

const CATEGORY_COLORS = [
    "#6366f1", "#f59e0b", "#10b981", "#f87171", "#60a5fa", "#a78bfa", "#34d399", "#fb923c",
];

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "#94a3b8",
    SENT: "#60a5fa",
    PAID: "#34d399",
    OVERDUE: "#f87171",
    PARTIAL: "#fbbf24",
    VOID: "#d1d5db",
};

function fmt(n: number, currency: string) {
    return `${currency} ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;

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
                    <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
                    <p className="text-muted-foreground">
                        {report
                            ? `${new Date(report.period.start).toLocaleDateString("en-AE")} – ${new Date(report.period.end).toLocaleDateString("en-AE")}`
                            : "Financial overview"}
                    </p>
                </div>
                <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : !report ? (
                <p className="text-muted-foreground text-sm">Failed to load report data.</p>
            ) : (
                <>
                    {/* P&L Overview */}
                    <div>
                        <h2 className="text-base font-semibold mb-3">Profit & Loss</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <KpiCard
                                title="Total Revenue"
                                value={fmt(kpis!.totalRevenue, currency)}
                                sub={`${kpis!.invoiceCount} invoice${kpis!.invoiceCount !== 1 ? "s" : ""}`}
                                icon={DollarSign}
                                trend="up"
                            />
                            <KpiCard
                                title="Total Expenses"
                                value={fmt(kpis!.totalExpenses, currency)}
                                sub={`Bills + direct expenses`}
                                icon={CreditCard}
                            />
                            <KpiCard
                                title="Net Profit"
                                value={fmt(kpis!.netProfit, currency)}
                                sub={`${(kpis!.netProfitMargin ?? 0).toFixed(1)}% margin`}
                                icon={isProfit ? TrendingUp : TrendingDown}
                                trend={isProfit ? "up" : "down"}
                            />
                            <KpiCard
                                title="Quotation Conversion"
                                value={`${(kpis!.conversionRate ?? 0).toFixed(1)}%`}
                                sub={`${kpis!.quotationCount} quote${kpis!.quotationCount !== 1 ? "s" : ""} sent`}
                                icon={FileText}
                                trend="neutral"
                            />
                        </div>
                    </div>

                    {/* Receivables & Payables */}
                    <div>
                        <h2 className="text-base font-semibold mb-3">Cash Flow</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <KpiCard
                                title="Outstanding Receivables"
                                value={fmt(kpis!.outstandingReceivables, currency)}
                                sub="Awaiting collection"
                                icon={TrendingUp}
                            />
                            <KpiCard
                                title="Overdue Invoices"
                                value={String(kpis!.overdueInvoices)}
                                sub={kpis!.overdueInvoices > 0 ? "Requires attention" : "All current"}
                                icon={Receipt}
                                trend={kpis!.overdueInvoices > 0 ? "down" : "neutral"}
                            />
                            <KpiCard
                                title="Outstanding Payables"
                                value={fmt(kpis!.outstandingPayables, currency)}
                                sub="To be paid to suppliers"
                                icon={TrendingDown}
                            />
                            <KpiCard
                                title="Overdue Bills"
                                value={String(kpis!.overdueBills)}
                                sub={kpis!.overdueBills > 0 ? "Requires attention" : "All current"}
                                icon={Receipt}
                                trend={kpis!.overdueBills > 0 ? "down" : "neutral"}
                            />
                        </div>
                    </div>

                    {/* Monthly Trend Chart */}
                    {(report.monthlyTrend ?? []).length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Revenue vs Expenses Trend</CardTitle>
                                <CardDescription>Last 12 months</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={240}>
                                    <AreaChart data={report.monthlyTrend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f87171" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip formatter={(v) => fmt(Number(v ?? 0), currency)} />
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                                        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                                        <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f87171" fill="url(#expGrad)" strokeWidth={2} dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* VAT Summary */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader><CardTitle className="text-base">VAT Summary</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Output VAT (collected on sales)</span>
                                    <span className="font-medium">{fmt(report.vatSummary?.outputVat ?? kpis!.totalVatCollected, currency)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Input VAT (paid on purchases)</span>
                                    <span className="font-medium">{fmt(report.vatSummary?.inputVat ?? kpis!.totalVatPaid, currency)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-3 font-semibold">
                                    <span>Net VAT Payable</span>
                                    <span className={(report.vatSummary?.netVatPayable ?? kpis!.netVatPayable) >= 0 ? "text-destructive" : "text-green-600"}>
                                        {fmt(report.vatSummary?.netVatPayable ?? kpis!.netVatPayable, currency)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Invoice Aging (Outstanding)</CardTitle>
                                <CardDescription>Receivables by age bucket</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Current</span><span className="font-medium">{fmt(report.receivableAging?.current ?? 0, currency)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">1-30 days</span><span className="font-medium">{fmt(report.receivableAging?.days1to30 ?? 0, currency)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">31-60 days</span><span className="font-medium">{fmt(report.receivableAging?.days31to60 ?? 0, currency)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">61-90 days</span><span className="font-medium">{fmt(report.receivableAging?.days61to90 ?? 0, currency)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">90+ days</span><span className="font-medium text-destructive">{fmt(report.receivableAging?.days90plus ?? 0, currency)}</span></div>
                            </CardContent>
                        </Card>

                        {/* Expenses by Category */}
                        <Card className="lg:col-span-2">
                            <CardHeader><CardTitle className="text-base">Expenses by Category</CardTitle></CardHeader>
                            <CardContent>
                                {report.expensesByCategory && report.expensesByCategory.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart
                                            data={report.expensesByCategory.slice(0, 8).map((c) => ({
                                                name: CATEGORY_LABELS[c.category] ?? c.category,
                                                total: c.total,
                                            }))}
                                            layout="vertical"
                                            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                                            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={120} />
                                            <Tooltip formatter={(v) => fmt(Number(v ?? 0), currency)} />
                                            <Bar dataKey="total" name="Amount" radius={[0, 4, 4, 0]}>
                                                {report.expensesByCategory.slice(0, 8).map((entry, i) => (
                                                    <Cell key={entry.category ?? i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No expenses in this period</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Invoice status chart + Bills by Status */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader><CardTitle className="text-base">Invoices by Status</CardTitle></CardHeader>
                            <CardContent>
                                {report.invoicesByStatus && report.invoicesByStatus.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie
                                                data={report.invoicesByStatus}
                                                dataKey="total"
                                                nameKey="status"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={3}
                                            >
                                                {report.invoicesByStatus.map((entry) => (
                                                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#a5b4fc"} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => fmt(Number(v ?? 0), currency)} />
                                            <Legend formatter={(value) => value.replaceAll("_", " ")} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No invoices in this period</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-base">Bills by Status</CardTitle></CardHeader>
                            <CardContent>
                                {report.billsByStatus && report.billsByStatus.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart
                                            data={report.billsByStatus.map((s) => ({
                                                name: s.status.replace(/_/g, " "),
                                                total: s.total,
                                                count: s.count,
                                            }))}
                                            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip formatter={(v) => fmt(Number(v ?? 0), currency)} />
                                            <Bar dataKey="total" name="Amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No bills in this period</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
