"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    FileText,
    Loader2,
    TrendingUp,
    Users,
} from "lucide-react";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

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
    kpis?: {
        totalRevenue: number;
        outstandingReceivables: number;
        invoiceCount: number;
        overdueInvoices: number;
        quotationCount: number;
        totalExpenses: number;
        expenseCount: number;
    };
};

type CustomerListResponse = {
    pagination?: {
        total: number;
    };
};

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-AE", {
        style: "currency",
        currency: "AED",
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


export default function DashboardPage() {
    const [report, setReport] = useState<ReportResponse | null>(null);
    const [customerTotal, setCustomerTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function fetchDashboardData() {
            setLoading(true);
            try {
                const [reportRes, customerRes] = await Promise.all([
                    fetch("/api/reports", { cache: "no-store" }),
                    fetch("/api/customers?page=1&limit=1", { cache: "no-store" }),
                ]);

                if (!reportRes.ok) {
                    throw new Error("Failed to load dashboard data");
                }

                const reportData = (await reportRes.json()) as ReportResponse;
                const customerData = customerRes.ok
                    ? ((await customerRes.json()) as CustomerListResponse)
                    : null;

                if (!mounted) return;

                setReport(reportData);
                setCustomerTotal(customerData?.pagination?.total ?? 0);
            } catch {
                if (!mounted) return;
                setReport(null);
                setCustomerTotal(0);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        fetchDashboardData();

        return () => {
            mounted = false;
        };
    }, []);

    const stats = useMemo(() => {
        if (!report) return [];

        const normalized = getDashboardStatsData(report);

        return [
            {
                name: "Total Revenue",
                value: formatCurrency(normalized.revenue.totalInvoiced),
                description: `${formatCurrency(normalized.revenue.totalCollected)} collected`,
                trend: normalized.revenue.totalInvoiced >= normalized.revenue.totalCollected ? "up" : "down",
                delta: `${normalized.revenue.invoiceCount} invoices`,
                icon: TrendingUp,
            },
            {
                name: "Outstanding",
                value: formatCurrency(normalized.revenue.outstanding),
                description: `${normalized.revenue.overdueCount} overdue`,
                trend: normalized.revenue.overdueCount > 0 ? "down" : "up",
                delta: normalized.revenue.overdueCount > 0 ? "Needs follow-up" : "Under control",
                icon: AlertCircle,
            },
            {
                name: "Total Invoices",
                value: String(normalized.revenue.invoiceCount),
                description: `${normalized.quotations.count} quotations created`,
                trend: normalized.revenue.invoiceCount > 0 ? "up" : "down",
                delta: `${normalized.quotations.count} quotes`,
                icon: FileText,
            },
            {
                name: "Active Customers",
                value: String(customerTotal),
                description: `${normalized.expenses.count} expenses recorded`,
                trend: customerTotal > 0 ? "up" : "down",
                delta: formatCurrency(normalized.expenses.total),
                icon: Users,
            },
        ];
    }, [customerTotal, report]);

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

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Business Overview</h2>
                    <p className="text-muted-foreground">
                        Live numbers from your invoices, quotations, customers, and expenses.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild>
                        <Link href="/invoices?create=1">
                            <FileText className="mr-2 h-4 w-4" />
                            New Invoice
                        </Link>
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex min-h-[24rem] items-center justify-center rounded-lg border bg-card">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : !report ? (
                <Card>
                    <CardContent className="flex min-h-[18rem] flex-col items-center justify-center gap-3 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Dashboard data could not be loaded</p>
                            <p className="text-sm text-muted-foreground">
                                Check your reports and invoice endpoints, then reload the page.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                        <Card className="lg:col-span-4">
                            <CardHeader>
                                <CardTitle>Recent Invoices</CardTitle>
                                <CardDescription>Your latest invoices from the live system</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {recentInvoices.length === 0 ? (
                                        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                            No invoices created yet.
                                        </div>
                                    ) : (
                                        recentInvoices.map((invoice) => (
                                            <div
                                                key={invoice.id}
                                                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                                        <FileText className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{invoice.customer.name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {invoice.invoiceNumber} • {new Date(invoice.issueDate).toLocaleDateString("en-AE")}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 sm:justify-end">
                                                    <span className="font-medium">{formatCurrency(invoice.total)}</span>
                                                    <StatusBadge status={invoice.status} />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <Button variant="outline" className="mt-4 w-full" asChild>
                                    <Link href="/invoices">View All Invoices</Link>
                                </Button>
                            </CardContent>
                        </Card>

                        <div className="space-y-6 lg:col-span-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Quick Actions</CardTitle>
                                    <CardDescription>Go directly to the most-used flows</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button variant="outline" className="h-auto py-3" asChild>
                                            <Link href="/invoices?create=1">Create Invoice</Link>
                                        </Button>
                                        <Button variant="outline" className="h-auto py-3" asChild>
                                            <Link href="/customers?create=1">Add Customer</Link>
                                        </Button>
                                        <Button variant="outline" className="h-auto py-3" asChild>
                                            <Link href="/quotations?create=1">New Quotation</Link>
                                        </Button>
                                        <Button variant="outline" className="h-auto py-3" asChild>
                                            <Link href="/expenses?create=1">Record Expense</Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-orange-600" />
                                        <CardTitle className="text-orange-600">VAT Summary</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between text-orange-700 dark:text-orange-300">
                                        <span>Output VAT</span>
                                        <span>{formatCurrency(vatSummary.outputVat)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-orange-700 dark:text-orange-300">
                                        <span>Input VAT</span>
                                        <span>{formatCurrency(vatSummary.inputVat)}</span>
                                    </div>
                                    <div className="flex items-center justify-between font-medium text-orange-800 dark:text-orange-200">
                                        <span>Net VAT Payable</span>
                                        <span>{formatCurrency(vatSummary.netVatPayable)}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Invoice Status</CardTitle>
                                    <CardDescription>Current invoice breakdown by status</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {invoiceStatusBreakdown.length === 0 ? (
                                            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                                No invoice activity in this period.
                                            </div>
                                        ) : (
                                            invoiceStatusBreakdown.map((status) => (
                                                <div key={status.status} className="flex items-center justify-between rounded-lg border p-3">
                                                    <div>
                                                        <p className="font-medium">{status.status.replaceAll("_", " ")}</p>
                                                        <p className="text-sm text-muted-foreground">{status.count} invoices</p>
                                                    </div>
                                                    <div className="text-right font-medium">{formatCurrency(status.total)}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
