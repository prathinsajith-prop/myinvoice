"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Bell, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";

import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PaginationControls } from "@/components/pagination-controls";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/format";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

interface Invoice {
    id: string;
    invoiceNumber: string;
    total: number;
    outstanding: number;
    dueDate: string | null;
    customer: { id: string; name: string };
}

interface Reminder {
    id: string;
    type: string;
    channel: string;
    status: string;
    scheduledAt: string;
    sentAt: string | null;
    recipient: string | null;
    invoice: Invoice;
}

interface Pagination { total: number; page: number; limit: number; pages: number }

type TabValue = "upcoming" | "sent" | "all";

export default function PaymentRemindersPage() {
    const t = useTranslations("paymentReminders");
    const tc = useTranslations("common");
    const orgSettings = useOrgSettings();
    const dateFormat = orgSettings.dateFormat;

    const [tab, setTab] = useState<TabValue>("upcoming");
    const [records, setRecords] = useState<Reminder[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const statusParam = tab === "upcoming" ? "PENDING" : tab === "sent" ? "SENT" : undefined;

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (statusParam) params.set("status", statusParam);
            const res = await fetch(`/api/payment-reminders?${params}`);
            if (res.ok) {
                const data = await res.json();
                setRecords(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, statusParam]);

    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    async function cancelReminder(id: string) {
        const res = await fetch(`/api/payment-reminders/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "CANCELED" }),
        });
        if (res.ok) {
            toast.success(t("canceled"));
            fetchRecords();
        }
    }

    async function deleteReminder(id: string) {
        const res = await fetch(`/api/payment-reminders/${id}`, { method: "DELETE" });
        if (res.ok || res.status === 204) {
            toast.success(t("deleted"));
            fetchRecords();
        }
    }

    const TYPE_LABELS: Record<string, string> = {
        BEFORE_DUE: t("types.BEFORE_DUE"),
        ON_DUE: t("types.ON_DUE"),
        AFTER_DUE: t("types.AFTER_DUE"),
    };

    const CHANNEL_COLORS: Record<string, string> = {
        EMAIL: "bg-blue-100 text-blue-700",
        WHATSAPP: "bg-green-100 text-green-700",
        SMS: "bg-orange-100 text-orange-700",
    };

    const columns = useMemo<ColumnDef<Reminder>[]>(() => [
        {
            id: "invoice",
            header: t("invoice"),
            cell: ({ row }) => (
                <div>
                    <p className="font-medium">{row.original.invoice.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{row.original.invoice.customer.name}</p>
                </div>
            ),
        },
        {
            accessorKey: "type",
            header: t("type"),
            cell: ({ row }) => (
                <span className="text-sm">{TYPE_LABELS[row.original.type] ?? row.original.type}</span>
            ),
        },
        {
            accessorKey: "channel",
            header: t("channel"),
            cell: ({ row }) => (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CHANNEL_COLORS[row.original.channel] ?? "bg-muted text-muted-foreground"}`}>
                    {t(`channels.${row.original.channel}`)}
                </span>
            ),
        },
        {
            accessorKey: "scheduledAt",
            header: t("scheduledAt"),
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground">
                    {formatDate(row.original.scheduledAt, dateFormat)}
                </span>
            ),
        },
        {
            accessorKey: "status",
            header: tc("status"),
            cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => {
                const rem = row.original;
                if (rem.status === "SENT") return null;
                return (
                    <div
                        role="presentation"
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                    >
                        {rem.status === "PENDING" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title={t("cancel")} onClick={() => cancelReminder(rem.id)}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" title={tc("delete")} onClick={() => deleteReminder(rem.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                );
            },
        },
         
    ], [dateFormat, t, tc]);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <PageHeader
                title={t("title")}
                description={t("description")}
                onRefresh={fetchRecords}
                isRefreshing={loading}
            />

            {/* Tab bar */}
            <div className="flex gap-1 rounded-lg border bg-muted p-1 w-fit">
                {(["upcoming", "sent", "all"] as TabValue[]).map((v) => (
                    <button
                        key={v}
                        type="button"
                        onClick={() => { setTab(v); setPage(1); }}
                        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === v
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {v === "upcoming" ? t("upcoming") : v === "sent" ? t("sent") : tc("all")}
                    </button>
                ))}
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <LoadingState />
                    ) : records.length === 0 ? (
                        <EmptyState icon={Bell} title={t("empty")} description={t("emptyDescription")} />
                    ) : (
                        <DataTable columns={columns} data={records} />
                    )}
                </CardContent>
            </Card>

            {pagination && pagination.pages > 1 && (
                <PaginationControls pagination={pagination} page={page} onPageChange={setPage} />
            )}
        </div>
    );
}
