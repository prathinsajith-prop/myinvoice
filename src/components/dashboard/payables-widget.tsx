"use client";

import { useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarClock, CircleAlert, Receipt } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { jsonFetcher } from "@/lib/fetcher";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/format";

type PayablesData = {
    overdue: Array<{
        id: string;
        billNumber: string;
        dueDate: string;
        total: string;
        outstanding: string;
        status: string;
        supplier: {
            id: string;
            name: string;
        };
    }>;
    dueSoon: Array<{
        id: string;
        billNumber: string;
        dueDate: string;
        total: string;
        outstanding: string;
        status: string;
        supplier: {
            id: string;
            name: string;
        };
    }>;
    future: Array<{
        id: string;
        billNumber: string;
        dueDate: string;
        total: string;
        outstanding: string;
        status: string;
        supplier: {
            id: string;
            name: string;
        };
    }>;
    totals: {
        overdue: number;
        dueSoon: number;
        future: number;
        total: number;
    };
    count: {
        overdue: number;
        dueSoon: number;
        future: number;
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

export function PayablesWidget() {
    const t = useTranslations("dashboard");
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const dateFormat = orgSettings.dateFormat;

    const { data, isLoading } = useSWR<PayablesData>(
        ["dashboard-payables"],
        async () => jsonFetcher<PayablesData>("/api/dashboard/payables"),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    const hasUnpaidBills = useMemo(() => {
        if (!data) return false;
        return data.count.total > 0;
    }, [data]);

    const prioritizedBills = useMemo(() => {
        if (!data) return [];
        return [...data.overdue, ...data.dueSoon, ...data.future].slice(0, 8);
    }, [data]);

    const urgencySummary = useMemo(() => {
        if (!data) return [];
        return [
            {
                key: "overdue",
                label: "Overdue",
                amount: data.totals.overdue,
                count: data.count.overdue,
                tone: "text-red-700 border-red-200 bg-red-50",
            },
            {
                key: "dueSoon",
                label: "Due Soon",
                amount: data.totals.dueSoon,
                count: data.count.dueSoon,
                tone: "text-amber-700 border-amber-200 bg-amber-50",
            },
            {
                key: "future",
                label: "Upcoming",
                amount: data.totals.future,
                count: data.count.future,
                tone: "text-slate-700 border-slate-200 bg-slate-50",
            },
        ];
    }, [data]);

    function getUrgencyLabel(dueDate: string): "Overdue" | "Due Soon" | "Upcoming" {
        const due = new Date(dueDate);
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (due < now) return "Overdue";
        const in7Days = new Date(now);
        in7Days.setDate(in7Days.getDate() + 7);
        if (due < in7Days) return "Due Soon";
        return "Upcoming";
    }

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t("payables.title")}</CardTitle>
                    <CardDescription>{t("payablesWidgetDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-20 w-full rounded-lg" />
                        ))}
                    </div>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-lg border p-3">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="mt-2 h-3 w-56" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (!hasUnpaidBills) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t("payables.title")}</CardTitle>
                    <CardDescription>{t("payablesWidgetDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-center">
                    <AlertCircle className="h-8 w-8 text-emerald-600" />
                    <div>
                        <p className="font-medium">{t("allBillsPaid")}</p>
                        <p className="text-sm text-muted-foreground">{t("noPendingPayables")}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>{t("payables.title")}</CardTitle>
                        <CardDescription>{t("payablesWidgetDesc")}</CardDescription>
                    </div>
                    <Badge variant="outline">{data?.count.total ?? 0} unpaid</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                    {urgencySummary.map((item) => (
                        <div key={item.key} className={`rounded-lg border p-3 ${item.tone}`}>
                            <p className="text-xs font-semibold uppercase tracking-wide">{item.label}</p>
                            <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(item.amount, currency)}</p>
                            <p className="text-xs opacity-80">{item.count} bills</p>
                        </div>
                    ))}
                </div>

                <div className="rounded-xl border">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                        <div className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">Priority Payables</p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums">
                            {formatCurrency(data?.totals.total ?? 0, currency)}
                        </p>
                    </div>
                    <div className="divide-y">
                        {prioritizedBills.map((bill) => {
                            const urgency = getUrgencyLabel(bill.dueDate);
                            const urgencyVariant = urgency === "Overdue" ? "destructive" : "outline";

                            return (
                                <div key={bill.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Receipt className="h-4 w-4 text-muted-foreground" />
                                            <p className="truncate text-sm font-medium">{bill.supplier.name}</p>
                                        </div>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {bill.billNumber} • Due {formatDate(bill.dueDate, dateFormat)}
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-sm font-semibold tabular-nums">
                                            {formatCurrency(Number(bill.outstanding), currency)}
                                        </p>
                                        <Badge variant={urgencyVariant} className="mt-1">
                                            {urgency === "Overdue" && <CircleAlert className="mr-1 h-3 w-3" />}
                                            {urgency}
                                        </Badge>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <Button variant="outline" className="w-full" asChild>
                    <Link href="/bills">
                        View All Bills <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}
