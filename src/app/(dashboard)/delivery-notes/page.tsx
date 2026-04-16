"use client";

import { useDeferredValue, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Truck, Eye } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { DeliveryNoteSheet } from "@/components/modals/delivery-note-sheet";

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
import { useTranslations } from "next-intl";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { formatDate } from "@/lib/format";

interface DeliveryNote {
    id: string;
    deliveryNoteNumber: string;
    status: string;
    issueDate: string;
    deliveryDate: string | null;
    currency: string;
    trackingNumber: string | null;
    carrier: string | null;
    customer: { id: string; name: string };
    invoice: { id: string; invoiceNumber: string } | null;
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export default function DeliveryNotesPage() {
    const t = useTranslations("deliveryNotes");
    const tc = useTranslations("common");
    const orgSettings = useOrgSettings();
    const dateFormat = orgSettings.dateFormat;
    const router = useRouter();
    const createParamHandled = useRef(false);
    const [notes, setNotes] = useState<DeliveryNote[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const deferredSearch = useDeferredValue(search);
    const normalizedSearch = deferredSearch.trim();

    const fetchNotes = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (normalizedSearch) params.set("search", normalizedSearch);
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            const res = await fetch(`/api/delivery-notes?${params}`);
            if (res.ok) {
                const data = await res.json();
                setNotes(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, normalizedSearch, statusFilter]);

    useEffect(() => { fetchNotes(); }, [fetchNotes]);

    useEffect(() => {
        if (createParamHandled.current) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("create") === "1") {
            setSheetOpen(true);
        }
        createParamHandled.current = true;
    }, []);

    const handleSearchChange = (value: string) => { setPage(1); setSearch(value); };
    const handleStatusChange = (value: string) => { setPage(1); setStatusFilter(value); };

    const columns = useMemo<ColumnDef<DeliveryNote>[]>(() => [
        {
            accessorKey: "deliveryNoteNumber",
            header: t("number"),
            cell: ({ row }) => <span className="font-medium">{row.getValue("deliveryNoteNumber")}</span>,
        },
        {
            id: "customer",
            header: t("customer"),
            cell: ({ row }) => row.original.customer?.name,
        },
        {
            id: "invoice",
            header: t("invoice"),
            cell: ({ row }) => row.original.invoice ? (
                <span className="text-muted-foreground">{row.original.invoice.invoiceNumber}</span>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
        },
        {
            accessorKey: "issueDate",
            header: t("issueDate"),
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {formatDate(String(row.getValue("issueDate")), dateFormat)}
                </span>
            ),
        },
        {
            accessorKey: "deliveryDate",
            header: t("deliveryDate"),
            cell: ({ row }) => {
                const d = row.getValue("deliveryDate");
                return d ? (
                    <span className="text-muted-foreground">{formatDate(d as string, dateFormat)}</span>
                ) : (
                    <span className="text-muted-foreground">—</span>
                );
            },
        },
        {
            id: "tracking",
            header: t("tracking"),
            cell: ({ row }) => {
                const tn = row.original.trackingNumber;
                const carrier = row.original.carrier;
                if (!tn && !carrier) return <span className="text-muted-foreground">—</span>;
                return (
                    <div className="text-sm">
                        {carrier && <span className="text-muted-foreground">{carrier}</span>}
                        {tn && <span className="ml-1 font-mono text-xs">{tn}</span>}
                    </div>
                );
            },
        },
        {
            accessorKey: "status",
            header: t("status"),
            cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div role="presentation" className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="View"
                        onClick={() => router.push(`/delivery-notes/${row.original.id}`)}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ], [dateFormat, router, t]);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <PageHeader
                title={t("title")}
                description={t("description")}
                onRefresh={fetchNotes}
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
                            onChange={handleSearchChange}
                            placeholder={t("searchPlaceholder")}
                            className="sm:w-72"
                        />
                        <Select value={statusFilter} onValueChange={handleStatusChange}>
                            <SelectTrigger className="sm:w-40">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{tc("allStatuses")}</SelectItem>
                                <SelectItem value="DRAFT">Draft</SelectItem>
                                <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                                <SelectItem value="DELIVERED">Delivered</SelectItem>
                                <SelectItem value="VOID">Void</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <LoadingState />
                    ) : notes.length === 0 ? (
                        <EmptyState
                            icon={Truck}
                            title={t("empty")}
                            description={t("emptyDescription")}
                            action={{ label: t("new"), onClick: () => setSheetOpen(true) }}
                        />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={notes}
                            onRowClick={(row) => router.push(`/delivery-notes/${row.id}`)}
                        />
                    )}
                </CardContent>
            </Card>

            {pagination && pagination.pages > 1 && (
                <PaginationControls
                    pagination={pagination}
                    page={page}
                    onPageChange={setPage}
                />
            )}

            <DeliveryNoteSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSuccess={() => { fetchNotes(); }}
            />
        </div>
    );
}
