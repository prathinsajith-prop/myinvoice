"use client";

import { useDeferredValue, useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCcw, Play, Pause, X, Eye } from "lucide-react";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PaginationControls } from "@/components/pagination-controls";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/format";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { RecurringInvoiceSheet } from "@/components/modals/recurring-invoice-sheet";

interface RecurringInvoice {
    id: string;
    templateName: string | null;
    frequency: string;
    status: string;
    startDate: string;
    nextRunDate: string;
    lastRunDate: string | null;
    total: number;
    invoicesGenerated: number;
    autoSend: boolean;
    customer: { id: string; name: string };
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export default function RecurringInvoicesPage() {
    const t = useTranslations("recurringInvoices");
    const tc = useTranslations("common");
    const orgSettings = useOrgSettings();
    const dateFormat = orgSettings.dateFormat;

    const [records, setRecords] = useState<RecurringInvoice[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const deferredSearch = useDeferredValue(search);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            const res = await fetch(`/api/recurring-invoices?${params}`);
            if (res.ok) {
                const data = await res.json();
                setRecords(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, deferredSearch, statusFilter]);

    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    async function updateStatus(id: string, status: string) {
        const res = await fetch(`/api/recurring-invoices/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        if (res.ok) {
            const key = status === "ACTIVE" ? "resumed" : status === "PAUSED" ? "paused" : "canceled";
            toast.success(t(key));
            fetchRecords();
        } else {
            toast.error("Update failed");
        }
    }

    const FREQ_COLORS: Record<string, string> = {
        WEEKLY: "bg-blue-100 text-blue-700",
        BIWEEKLY: "bg-indigo-100 text-indigo-700",
        MONTHLY: "bg-purple-100 text-purple-700",
        QUARTERLY: "bg-pink-100 text-pink-700",
        SEMI_ANNUALLY: "bg-orange-100 text-orange-700",
        ANNUALLY: "bg-red-100 text-red-700",
    };

    const columns = useMemo<ColumnDef<RecurringInvoice>[]>(() => [
        {
            accessorKey: "templateName",
            header: t("templateName"),
            cell: ({ row }) => (
                <div>
                    <p className="font-medium">{row.original.templateName ?? row.original.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{row.original.customer.name}</p>
                </div>
            ),
        },
        {
            accessorKey: "frequency",
            header: t("frequency"),
            cell: ({ row }) => (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${FREQ_COLORS[row.original.frequency] ?? "bg-muted text-muted-foreground"}`}>
                    {t(`frequencies.${row.original.frequency}`)}
                </span>
            ),
        },
        {
            accessorKey: "nextRunDate",
            header: t("nextRun"),
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">
                    {formatDate(row.original.nextRunDate, dateFormat)}
                </span>
            ),
        },
        {
            accessorKey: "invoicesGenerated",
            header: t("generated"),
            cell: ({ row }) => (
                <span className="font-medium">{row.original.invoicesGenerated}</span>
            ),
        },
        {
            accessorKey: "status",
            header: t("status"),
            cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => {
                const rec = row.original;
                return (
                    <div
                        role="presentation"
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                    >
                        {rec.status === "ACTIVE" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title={t("pause")} onClick={() => updateStatus(rec.id, "PAUSED")}>
                                <Pause className="h-4 w-4" />
                            </Button>
                        )}
                        {rec.status === "PAUSED" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title={t("resume")} onClick={() => updateStatus(rec.id, "ACTIVE")}>
                                <Play className="h-4 w-4" />
                            </Button>
                        )}
                        {rec.status !== "CANCELED" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title={t("cancel")} onClick={() => updateStatus(rec.id, "CANCELED")}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [dateFormat, t]);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <PageHeader
                title={t("title")}
                description={t("description")}
                onRefresh={fetchRecords}
                isRefreshing={loading}
                actions={
                    <Button onClick={() => setSheetOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> {t("new")}
                    </Button>
                }
            />

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <SearchInput
                            value={search}
                            onChange={(v) => { setPage(1); setSearch(v); }}
                            placeholder={t("searchPlaceholder")}
                            className="sm:w-72"
                        />
                        <Select value={statusFilter} onValueChange={(v) => { setPage(1); setStatusFilter(v); }}>
                            <SelectTrigger className="sm:w-40">
                                <SelectValue placeholder={tc("allStatuses")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{tc("allStatuses")}</SelectItem>
                                <SelectItem value="ACTIVE">{t("statuses.ACTIVE")}</SelectItem>
                                <SelectItem value="PAUSED">{t("statuses.PAUSED")}</SelectItem>
                                <SelectItem value="COMPLETED">{t("statuses.COMPLETED")}</SelectItem>
                                <SelectItem value="CANCELED">{t("statuses.CANCELED")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <LoadingState />
                    ) : records.length === 0 ? (
                        <EmptyState
                            icon={RefreshCcw}
                            title={t("empty")}
                            description={t("emptyDescription")}
                            action={{ label: t("new"), onClick: () => setSheetOpen(true) }}
                        />
                    ) : (
                        <DataTable columns={columns} data={records} />
                    )}
                </CardContent>
            </Card>

            {pagination && pagination.pages > 1 && (
                <PaginationControls pagination={pagination} page={page} onPageChange={setPage} />
            )}

            <RecurringInvoiceSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSuccess={fetchRecords}
            />
        </div>
    );
}
