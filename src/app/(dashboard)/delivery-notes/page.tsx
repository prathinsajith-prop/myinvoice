"use client";

import { useDeferredValue, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Truck, Eye, Send, CheckCircle2, Ban, MoreHorizontal } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

import { DeliveryNoteSheet } from "@/components/modals/delivery-note-sheet";
import { DeliveryNoteDetailDrawer } from "@/components/modals/delivery-note-detail-drawer";

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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    const createParamHandled = useRef(false);
    const [notes, setNotes] = useState<DeliveryNote[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [detailId, setDetailId] = useState<string | null>(null);
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

    const updateStatusInline = useCallback(async (id: string, status: string) => {
        const res = await fetch(`/api/delivery-notes/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        if (res.ok) {
            toast.success(
                status === "DISPATCHED" ? t("dispatched")
                    : status === "DELIVERED" ? t("delivered")
                        : t("voided")
            );
            fetchNotes();
        } else {
            const err = await res.json().catch(() => ({}));
            toast.error(err.error ?? "Update failed");
        }
    }, [fetchNotes, t]);

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
            cell: ({ row }) => {
                const status = row.original.status;
                const canDispatch = status === "DRAFT";
                const canDeliver = status === "DISPATCHED";
                const canVoid = status !== "VOID" && status !== "DELIVERED";
                return (
                    <div role="presentation" className="flex items-center justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => setDetailId(row.original.id)}>
                                    <Eye className="mr-2 h-4 w-4" />{tc("view")}
                                </DropdownMenuItem>
                                {canDispatch && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => updateStatusInline(row.original.id, "DISPATCHED")}>
                                            <Send className="mr-2 h-4 w-4 text-blue-500" />{t("markDispatched")}
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {canDeliver && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => updateStatusInline(row.original.id, "DELIVERED")}>
                                            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />{t("markDelivered")}
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {canVoid && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() => updateStatusInline(row.original.id, "VOID")}
                                        >
                                            <Ban className="mr-2 h-4 w-4" />{t("markVoid")}
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ], [dateFormat, t, tc, updateStatusInline]);

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
                                <SelectItem value="DRAFT">{t("statuses.DRAFT")}</SelectItem>
                                <SelectItem value="DISPATCHED">{t("statuses.DISPATCHED")}</SelectItem>
                                <SelectItem value="DELIVERED">{t("statuses.DELIVERED")}</SelectItem>
                                <SelectItem value="VOID">{t("statuses.VOID")}</SelectItem>
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
                            onRowClick={(row) => setDetailId(row.id)}
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

            <DeliveryNoteDetailDrawer
                open={detailId !== null}
                onClose={() => setDetailId(null)}
                noteId={detailId}
                onUpdate={fetchNotes}
            />
        </div>
    );
}
