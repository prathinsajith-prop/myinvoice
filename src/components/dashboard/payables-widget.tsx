"use client";

import { useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AlertCircle, FileText, ArrowRight } from "lucide-react";
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

function getUrgencyColor(category: "overdue" | "dueSoon" | "future"): string {
    if (category === "overdue") return "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800";
    if (category === "dueSoon") return "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800";
    return "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800";
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

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t("payables.title")}</CardTitle>
                    <CardDescription>{t("payablesWidgetDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-20 w-full rounded-md" />
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
                    <AlertCircle className="h-8 w-8 text-green-500" />
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
            <CardContent className="space-y-6">
                {/* Overdue Bills */}
                {data && data.count.overdue > 0 && (
                    <div className={`rounded-lg border p-4 ${getUrgencyColor("overdue")}`}>
                        <div className="mb-3 flex items-center justify-between">
                            <h4 className="font-semibold text-red-900 dark:text-red-100">
                                🔴 Overdue ({data.count.overdue})
                            </h4>
                            <span className="text-sm font-medium text-red-700 dark:text-red-200">
                                {formatCurrency(data.totals.overdue, currency)}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {data.overdue.slice(0, 3).map((bill) => (
                                <div key={bill.id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                                        <div className="min-w-0">
                                            <p className="font-medium text-red-900 dark:text-red-100 truncate">
                                                {bill.supplier.name}
                                            </p>
                                            <p className="text-xs text-red-700 dark:text-red-300">
                                                {bill.billNumber} • {formatDate(bill.dueDate, dateFormat)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ml-2 text-right flex-shrink-0">
                                        <p className="font-medium text-red-900 dark:text-red-100">
                                            {formatCurrency(Number(bill.outstanding), currency)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {data.count.overdue > 3 && (
                                <p className="text-xs text-red-700 dark:text-red-300 text-center pt-1">
                                    +{data.count.overdue - 3} more overdue bills
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Due Soon Bills */}
                {data && data.count.dueSoon > 0 && (
                    <div className={`rounded-lg border p-4 ${getUrgencyColor("dueSoon")}`}>
                        <div className="mb-3 flex items-center justify-between">
                            <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                                🟡 Due Soon ({data.count.dueSoon})
                            </h4>
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-200">
                                {formatCurrency(data.totals.dueSoon, currency)}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {data.dueSoon.slice(0, 3).map((bill) => (
                                <div key={bill.id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                                        <div className="min-w-0">
                                            <p className="font-medium text-amber-900 dark:text-amber-100 truncate">
                                                {bill.supplier.name}
                                            </p>
                                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                                {bill.billNumber} • {formatDate(bill.dueDate, dateFormat)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ml-2 text-right flex-shrink-0">
                                        <p className="font-medium text-amber-900 dark:text-amber-100">
                                            {formatCurrency(Number(bill.outstanding), currency)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {data.count.dueSoon > 3 && (
                                <p className="text-xs text-amber-700 dark:text-amber-300 text-center pt-1">
                                    +{data.count.dueSoon - 3} more bills due soon
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Future Bills */}
                {data && data.count.future > 0 && (
                    <div className={`rounded-lg border p-4 ${getUrgencyColor("future")}`}>
                        <div className="mb-3 flex items-center justify-between">
                            <h4 className="font-semibold text-green-900 dark:text-green-100">
                                🟢 Future ({data.count.future})
                            </h4>
                            <span className="text-sm font-medium text-green-700 dark:text-green-200">
                                {formatCurrency(data.totals.future, currency)}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {data.future.slice(0, 2).map((bill) => (
                                <div key={bill.id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                                        <div className="min-w-0">
                                            <p className="font-medium text-green-900 dark:text-green-100 truncate">
                                                {bill.supplier.name}
                                            </p>
                                            <p className="text-xs text-green-700 dark:text-green-300">
                                                {bill.billNumber} • {formatDate(bill.dueDate, dateFormat)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ml-2 text-right flex-shrink-0">
                                        <p className="font-medium text-green-900 dark:text-green-100">
                                            {formatCurrency(Number(bill.outstanding), currency)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {data.count.future > 2 && (
                                <p className="text-xs text-green-700 dark:text-green-300 text-center pt-1">
                                    +{data.count.future - 2} more future bills
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <Button variant="outline" className="w-full" asChild>
                    <Link href="/bills">
                        View All Bills <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}
