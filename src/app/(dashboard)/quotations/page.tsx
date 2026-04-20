"use client";

import { useDeferredValue, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, FileCheck, Pencil } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { QuotationSheet } from "@/components/modals/quotation-sheet";
import { canEdit } from "@/lib/utils/can-edit";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

import { Button } from "@/components/ui/button";
import { ExportDropdown } from "@/components/export-dropdown";
import { StatusBadge, StatusOption } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useTranslations } from "next-intl";
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PaginationControls } from "@/components/pagination-controls";
import { formatAmount, formatDate } from "@/lib/format";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Quotation {
    id: string;
    quoteNumber: string;
    status: string;
    total: number;
    validUntil: string;
    issueDate: string;
    customer: { id: string; name: string };
}

interface Pagination { total: number; page: number; limit: number; pages: number }



export default function QuotationsPage() {
    const t = useTranslations("quotes");
    const tc = useTranslations("common");
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const dateFormat = orgSettings.dateFormat;
    const createParamHandled = useRef(false);
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editQuotationId, setEditQuotationId] = useState<string | null>(null);
    const deferredSearch = useDeferredValue(search);
    const normalizedSearch = deferredSearch.trim();

    useEffect(() => {
        if (createParamHandled.current) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("create") === "1") {
            setSheetOpen(true);
        }
        createParamHandled.current = true;
    }, []);

    const fetchQuotations = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (normalizedSearch) params.set("search", normalizedSearch);
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            const res = await fetch(`/api/quotations?${params}`);
            if (res.ok) {
                const data = await res.json();
                setQuotations(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, normalizedSearch, statusFilter]);

    useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

    const handleSearchChange = (value: string) => {
        setPage(1);
        setSearch(value);
    };

    const handleStatusFilterChange = (value: string) => {
        setPage(1);
        setStatusFilter(value);
    };

    const columns = useMemo<ColumnDef<Quotation>[]>(() => [
        {
            accessorKey: "quoteNumber",
            header: t("quoteNumber"),
            cell: ({ row }) => <span className="font-medium">{row.getValue("quoteNumber")}</span>,
        },
        {
            id: "customer",
            header: t("customerHeader"),
            cell: ({ row }) => row.original.customer?.name,
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
            accessorKey: "validUntil",
            header: t("validUntil"),
            cell: ({ row }) => {
                const isExpired = !["CONVERTED", "REJECTED"].includes(row.original.status) && new Date(row.getValue("validUntil")) < new Date();
                return (
                    <span className={isExpired ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {formatDate(String(row.getValue("validUntil")), dateFormat)}
                    </span>
                );
            },
        },
        {
            accessorKey: "total",
            header: () => <div className="text-right">{tc("total")}</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {currency} {formatAmount(row.getValue("total"))}
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: t("statusHeader"),
            cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div role="presentation" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title={tc("view")}
                            onClick={() => router.push(`/quotations/${row.original.id}`)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                        {canEdit('quotation', row.original.status) && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title={tc("edit")}
                                onClick={() => setEditQuotationId(row.original.id)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            ),
        },
    ], [currency, dateFormat, router, t, tc]);

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("pageTitle")}
                description={pagination ? t("totalQuotations", { count: pagination.total }) : t("manageDescription")}
                onRefresh={fetchQuotations}
                isRefreshing={loading}
                actions={
                    <>
                        <ExportDropdown
                            data={quotations}
                            columns={[
                                { header: t("exportQuoteNum"), accessor: "quoteNumber" },
                                { header: t("exportCustomer"), accessor: "customer.name" },
                                { header: t("exportIssueDate"), accessor: "issueDate", format: (v) => v ? formatDate(v as string, dateFormat) : "" },
                                { header: t("exportValidUntil"), accessor: "validUntil", format: (v) => v ? formatDate(v as string, dateFormat) : "" },
                                { header: t("exportTotal"), accessor: "total", format: (v) => formatAmount(v) },
                                { header: t("exportStatus"), accessor: "status" },
                            ]}
                            filename="quotations"
                            title={t("exportTitle")}
                        />
                        <Button onClick={() => setSheetOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t("newQuote")}
                        </Button>
                    </>
                }
            />

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <SearchInput
                            placeholder={t("searchPlaceholder")}
                            value={search}
                            onChange={handleSearchChange}
                        />
                        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{tc("allStatuses")}</SelectItem>
                                <SelectItem value="DRAFT"><StatusOption status="DRAFT" /></SelectItem>
                                <SelectItem value="SENT"><StatusOption status="SENT" /></SelectItem>
                                <SelectItem value="ACCEPTED"><StatusOption status="ACCEPTED" /></SelectItem>
                                <SelectItem value="REJECTED"><StatusOption status="REJECTED" /></SelectItem>
                                <SelectItem value="CONVERTED"><StatusOption status="CONVERTED" /></SelectItem>
                                <SelectItem value="EXPIRED"><StatusOption status="EXPIRED" /></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <LoadingState />
                    ) : quotations.length === 0 ? (
                        <EmptyState
                            icon={FileCheck}
                            title={t("noFound")}
                            description={normalizedSearch || statusFilter !== "ALL" ? tc("adjustFilters") : t("createFirst")}
                            action={!normalizedSearch && statusFilter === "ALL" ? { label: t("newQuote"), onClick: () => setSheetOpen(true) } : undefined}
                        />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={quotations}
                            onRowClick={(q) => router.push(`/quotations/${q.id}`)}
                        />
                    )}
                    {pagination && <PaginationControls pagination={pagination} page={page} onPageChange={setPage} />}
                </CardContent>
            </Card>
            <QuotationSheet
                open={sheetOpen || !!editQuotationId}
                onClose={() => { setSheetOpen(false); setEditQuotationId(null); }}
                onSuccess={() => { fetchQuotations(); setSheetOpen(false); setEditQuotationId(null); }}
                editQuotationId={editQuotationId}
            />
        </div>
    );
}
