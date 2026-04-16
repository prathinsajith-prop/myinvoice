"use client";

import { useDeferredValue, useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, FileText, AlertCircle } from "lucide-react";
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
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
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

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (normalizedSearch) params.set("search", normalizedSearch);
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            const res = await fetch(`/api/invoices?${params}`);
            if (res.ok) {
                const data = await res.json();
                setInvoices(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, normalizedSearch, statusFilter]);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    const handleSearchChange = (value: string) => {
        setPage(1);
        setSearch(value);
    };

    const handleStatusFilterChange = (value: string) => {
        setPage(1);
        setStatusFilter(value);
    };

    const totalOutstanding = invoices.reduce((s, i) => s + Number(i.outstanding), 0);

    const columns = useMemo<ColumnDef<Invoice>[]>(() => [
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
    ], [currency, dateFormat, t, tc]);

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("title")}
                description={pagination ? t("totalCount", { total: pagination.total }) : t("manageDescription")}
                onRefresh={fetchInvoices}
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
                onSuccess={() => { fetchInvoices(); setSheetOpen(false); }}
            />
        </div>
    );
}
