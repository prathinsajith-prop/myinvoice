"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, TrendingUp, TrendingDown, DollarSign, FileText, Receipt, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
    TRAVEL: "Travel",
    MEALS_AND_ENTERTAINMENT: "Meals & Entertainment",
    OFFICE_SUPPLIES: "Office Supplies",
    UTILITIES: "Utilities",
    RENT: "Rent",
    MARKETING: "Marketing",
    PROFESSIONAL_SERVICES: "Professional Services",
    INSURANCE: "Insurance",
    MAINTENANCE: "Maintenance",
    OTHER: "Other",
};

function fmt(n: number) {
    return `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
                                value={fmt(kpis!.totalRevenue)}
                                sub={`${kpis!.invoiceCount} invoice${kpis!.invoiceCount !== 1 ? "s" : ""}`}
                                icon={DollarSign}
                                trend="up"
                            />
                            <KpiCard
                                title="Total Expenses"
                                value={fmt(kpis!.totalExpenses)}
                                sub={`Bills + direct expenses`}
                                icon={CreditCard}
                            />
                            <KpiCard
                                title="Net Profit"
                                value={fmt(kpis!.netProfit)}
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
                                value={fmt(kpis!.outstandingReceivables)}
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
                                value={fmt(kpis!.outstandingPayables)}
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

                    {/* VAT Summary */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader><CardTitle className="text-base">VAT Summary</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Output VAT (collected on sales)</span>
                                    <span className="font-medium">{fmt(report.vatSummary?.outputVat ?? kpis!.totalVatCollected)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Input VAT (paid on purchases)</span>
                                    <span className="font-medium">{fmt(report.vatSummary?.inputVat ?? kpis!.totalVatPaid)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-3 font-semibold">
                                    <span>Net VAT Payable</span>
                                    <span className={(report.vatSummary?.netVatPayable ?? kpis!.netVatPayable) >= 0 ? "text-destructive" : "text-green-600"}>
                                        {fmt(report.vatSummary?.netVatPayable ?? kpis!.netVatPayable)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Expenses by Category */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">Expenses by Category</CardTitle></CardHeader>
                            <CardContent>
                                {report.expensesByCategory && report.expensesByCategory.length > 0 ? (
                                    <div className="space-y-2">
                                        {report.expensesByCategory.slice(0, 6).map((cat) => (
                                            <div key={cat.category} className="flex items-center justify-between text-sm">
                                                <span>{CATEGORY_LABELS[cat.category] ?? cat.category}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground text-xs">{cat.count} records</span>
                                                    <span className="font-medium">{fmt(cat.total)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No expenses in this period</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Invoice & Bill status breakdown */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader><CardTitle className="text-base">Invoices by Status</CardTitle></CardHeader>
                            <CardContent>
                                {report.invoicesByStatus && report.invoicesByStatus.length > 0 ? (
                                    <div className="space-y-2">
                                        {report.invoicesByStatus.map((s) => (
                                            <div key={s.status} className="flex items-center justify-between text-sm">
                                                <Badge variant="outline" className="text-xs capitalize">
                                                    {s.status.toLowerCase().replace("_", " ")}
                                                </Badge>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-muted-foreground">{s.count} invoices</span>
                                                    <span className="font-medium">{fmt(s.total)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No invoices in this period</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-base">Bills by Status</CardTitle></CardHeader>
                            <CardContent>
                                {report.billsByStatus && report.billsByStatus.length > 0 ? (
                                    <div className="space-y-2">
                                        {report.billsByStatus.map((s) => (
                                            <div key={s.status} className="flex items-center justify-between text-sm">
                                                <Badge variant="outline" className="text-xs capitalize">
                                                    {s.status.toLowerCase().replace("_", " ")}
                                                </Badge>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-muted-foreground">{s.count} bills</span>
                                                    <span className="font-medium">{fmt(s.total)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
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
