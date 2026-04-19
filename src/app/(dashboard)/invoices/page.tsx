"use client";

import { useDeferredValue, useState, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import { jsonFetcher } from "@/lib/fetcher";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, FileText, AlertCircle, Trash2, XCircle, CheckSquare } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { InvoiceSheet } from "@/components/modals/invoice-sheet";
import { canEdit } from "@/lib/utils/can-edit";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { PageHeader } from "@/components/page-header";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { ExportDropdown } from "@/components/export-dropdown";
import { StatusBadge, StatusOption } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PaginationControls } from "@/components/pagination-controls";
import { formatAmount, formatDate } from "@/lib/format";

interface Invoice {
    id: string;
    invoiceNumber: string;
    status: string;
    total: number;
    outstanding: number;
    dueDate: string;
    issueDate: string;
    customer: { id: string; name: string };
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
}



export default function InvoicesPage() {
    const t = useTranslations("invoices");
    const tc = useTranslations("common");
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const dateFormat = orgSettings.dateFormat;
    const createParamHandled = useRef(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkVoidOpen, setBulkVoidOpen] = useState(false);
    const [bulkVoidReason, setBulkVoidReason] = useState("");
    const [bulkLoading, setBulkLoading] = useState(false);
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

    const swrParams = new URLSearchParams({ page: String(page), limit: "20" });
    if (normalizedSearch) swrParams.set("search", normalizedSearch);
    if (statusFilter !== "ALL") swrParams.set("status", statusFilter);
    const { data: swrData, isLoading, mutate } = useSWR(
        `/api/invoices?${swrParams}`,
        jsonFetcher<{ data: Invoice[]; pagination: Pagination }>,
        { onError: (err) => toast.error(err.message ?? "Failed to load invoices") },
    );
    const invoices = swrData?.data ?? [];
    const pagination = swrData?.pagination ?? null;
    const loading = isLoading;

    const handleSearchChange = (value: string) => {
        setPage(1);
        setSearch(value);
    };

    const handleStatusFilterChange = (value: string) => {
        setPage(1);
        setStatusFilter(value);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === invoices.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(invoices.map((i) => i.id)));
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    const handleBulkVoid = async () => {
        if (!bulkVoidReason.trim()) return;
        setBulkLoading(true);
        try {
            const res = await fetch("/api/invoices/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "void", ids: Array.from(selectedIds), reason: bulkVoidReason }),
            });
            if (res.ok) {
                setBulkVoidOpen(false);
                setBulkVoidReason("");
                clearSelection();
                await mutate();
            }
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        setBulkLoading(true);
        try {
            const res = await fetch("/api/invoices/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "delete", ids: Array.from(selectedIds) }),
            });
            if (res.ok) {
                clearSelection();
                await mutate();
            }
        } finally {
            setBulkLoading(false);
        }
    };

    const totalOutstanding = invoices.reduce((s, i) => s + Number(i.outstanding), 0);

    const allSelected = invoices.length > 0 && selectedIds.size === invoices.length;
    const someSelected = selectedIds.size > 0 && selectedIds.size < invoices.length;

    const columns = useMemo<ColumnDef<Invoice>[]>(() => [
        {
            id: "select",
            header: () => (
                <div role="presentation" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div role="presentation" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={selectedIds.has(row.original.id)}
                        onCheckedChange={() => toggleSelect(row.original.id)}
                        aria-label={`Select invoice ${row.original.invoiceNumber}`}
                    />
                </div>
            ),
            size: 40,
        },
        {
            accessorKey: "invoiceNumber",
            header: t("invoiceNumber"),
            cell: ({ row }) => <span className="font-medium">{row.getValue("invoiceNumber")}</span>,
        },
        {
            id: "customer",
            header: t("customer"),
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
            accessorKey: "dueDate",
            header: t("dueDate"),
            cell: ({ row }) => {
                const isOverdue = row.original.status !== "PAID" && row.original.status !== "VOID" && new Date(row.getValue("dueDate")) < new Date();
                return (
                    <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {isOverdue && <AlertCircle className="inline h-3 w-3 mr-1" />}
                        {formatDate(String(row.getValue("dueDate")), dateFormat)}
                    </span>
                );
            },
        },
        {
            accessorKey: "total",
            header: () => <div className="text-right">{tc("amount")}</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {currency} {Number(row.getValue("total")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                </div>
            ),
        },
        {
            accessorKey: "outstanding",
            header: () => <div className="text-right">{tc("outstanding")}</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    <span className={Number(row.getValue("outstanding")) > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                        {currency} {Number(row.getValue("outstanding")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                    </span>
                </div>
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
            cell: ({ row }) => (
                <div role="presentation" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link href={`/invoices/${row.original.id}`}>{tc("view")}</Link>
                            </DropdownMenuItem>
                            {canEdit('invoice', row.original.status) && (
                                <DropdownMenuItem asChild>
                                    <Link href={`/invoices/${row.original.id}/edit`}>{tc("edit")}</Link>
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ], [currency, dateFormat, t, tc, allSelected, someSelected, selectedIds, toggleSelect, toggleSelectAll]);

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("title")}
                description={pagination ? t("totalCount", { total: pagination.total }) : t("manageDescription")}
                onRefresh={mutate}
                isRefreshing={loading}
                actions={
                    <>
                        <ExportDropdown
                            data={invoices}
                            columns={[
                                { header: t("exportInvoiceNum"), accessor: "invoiceNumber" },
                                { header: t("exportCustomer"), accessor: "customer.name" },
                                { header: t("exportIssueDate"), accessor: "issueDate", format: (v) => v ? formatDate(v as string, dateFormat) : "" },
                                { header: t("exportDueDate"), accessor: "dueDate", format: (v) => v ? formatDate(v as string, dateFormat) : "" },
                                { header: t("exportTotal"), accessor: "total", format: (v) => Number(v).toLocaleString("en-AE", { minimumFractionDigits: 2 }) },
                                { header: t("exportOutstanding"), accessor: "outstanding", format: (v) => Number(v).toLocaleString("en-AE", { minimumFractionDigits: 2 }) },
                                { header: t("exportStatus"), accessor: "status" },
                            ]}
                            filename="invoices"
                            title={t("exportTitle")}
                        />
                        <Button onClick={() => setSheetOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t("newInvoice")}
                        </Button>
                    </>
                }
            />

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <span className="font-medium text-primary">
                        {t("bulkSelected", { count: selectedIds.size })}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBulkVoidOpen(true)}
                            className="gap-1.5"
                        >
                            <XCircle className="h-3.5 w-3.5" />
                            {t("bulkVoidSelected")}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleBulkDelete}
                            disabled={bulkLoading}
                            className="gap-1.5 text-destructive hover:text-destructive"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("bulkDeleteDrafts")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={clearSelection}>
                            {t("bulkClearSelection")}
                        </Button>
                    </div>
                </div>
            )}

            {/* Stat cards */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <StatCard label={t("totalLabel")}>{pagination?.total ?? "—"}</StatCard>
                <StatCard label={t("outstandingShown")}>
                    <span className="text-amber-600">{currency} {formatAmount(totalOutstanding)}</span>
                </StatCard>
                <StatCard label={t("overdueLabel")}>
                    <span className="text-destructive">{invoices.filter((i) => i.status === "OVERDUE").length}</span>
                </StatCard>
            </div>

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
                                <SelectItem value="PARTIALLY_PAID"><StatusOption status="PARTIALLY_PAID" /></SelectItem>
                                <SelectItem value="PAID"><StatusOption status="PAID" /></SelectItem>
                                <SelectItem value="OVERDUE"><StatusOption status="OVERDUE" /></SelectItem>
                                <SelectItem value="VOID"><StatusOption status="VOID" /></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <LoadingState />
                    ) : invoices.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title={t("noFound")}
                            description={normalizedSearch || statusFilter !== "ALL" ? tc("adjustFilters") : t("createFirst")}
                            action={!normalizedSearch && statusFilter === "ALL" ? { label: t("newInvoice"), onClick: () => setSheetOpen(true) } : undefined}
                        />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={invoices}
                            onRowClick={(invoice) => router.push(`/invoices/${invoice.id}`)}
                        />
                    )}
                    {pagination && (
                        <PaginationControls pagination={pagination} page={page} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>
            <InvoiceSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSuccess={() => { mutate(); setSheetOpen(false); }}
            />

            {/* Bulk void dialog */}
            <AlertDialog open={bulkVoidOpen} onOpenChange={setBulkVoidOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("bulkVoidTitle", { count: selectedIds.size, s: selectedIds.size !== 1 ? "s" : "" })}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("bulkVoidDescription")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                        <Input
                            placeholder={t("bulkVoidReasonPlaceholder")}
                            value={bulkVoidReason}
                            onChange={(e) => setBulkVoidReason(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setBulkVoidReason("")}>{tc("cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBulkVoid}
                            disabled={!bulkVoidReason.trim() || bulkLoading}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {bulkLoading ? tc("loading") : t("bulkVoidConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
