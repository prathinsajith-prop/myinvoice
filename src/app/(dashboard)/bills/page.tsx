"use client";

import { useDeferredValue, useState, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import { jsonFetcher } from "@/lib/fetcher";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Receipt, AlertCircle, Eye, Pencil } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { BillSheet } from "@/components/modals/bill-sheet";
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

interface Bill {
    id: string;
    billNumber: string;
    status: string;
    currency: string;
    total: number;
    outstanding: number;
    dueDate: string;
    issueDate: string;
    supplier: { id: string; name: string };
}

interface Pagination { total: number; page: number; limit: number; pages: number }


export default function BillsPage() {
    const t = useTranslations("bills");
    const tc = useTranslations("common");
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const dateFormat = orgSettings.dateFormat;
    const createParamHandled = useRef(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editBillId, setEditBillId] = useState<string | null>(null);
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
        `/api/bills?${swrParams}`,
        jsonFetcher<{ data: Bill[]; pagination: Pagination }>,
        { onError: (err) => toast.error(err.message ?? "Failed to load bills") },
    );
    const bills = swrData?.data ?? [];
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

    const totalOutstanding = bills.reduce((s, b) => s + Number(b.outstanding), 0);
    const currenciesShown = Array.from(new Set(bills.map((bill) => bill.currency).filter(Boolean)));
    const hasMixedCurrencies = currenciesShown.length > 1;
    const summaryCurrency = currenciesShown[0] ?? orgSettings.defaultCurrency;

    const outstandingByCurrency = bills.reduce<Record<string, number>>((acc, b) => {
        const cur = b.currency || summaryCurrency;
        acc[cur] = (acc[cur] ?? 0) + Number(b.outstanding);
        return acc;
    }, {});

    const columns = useMemo<ColumnDef<Bill>[]>(() => [
        {
            accessorKey: "billNumber",
            header: t("billNum"),
            cell: ({ row }) => <span className="font-medium">{row.getValue("billNumber")}</span>,
        },
        {
            id: "supplier",
            header: t("supplierHeader"),
            cell: ({ row }) => row.original.supplier?.name,
        },
        {
            accessorKey: "issueDate",
            header: t("billDate"),
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {formatDate(String(row.getValue("issueDate")), dateFormat)}
                </span>
            ),
        },
        {
            accessorKey: "dueDate",
            header: tc("date"),
            cell: ({ row }) => {
                const isOverdue = !["PAID", "VOID"].includes(row.original.status) && new Date(row.getValue("dueDate")) < new Date();
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
                    {row.original.currency} {Number(row.getValue("total")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                </div>
            ),
        },
        {
            accessorKey: "outstanding",
            header: () => <div className="text-right">{tc("outstanding")}</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    <span className={Number(row.getValue("outstanding")) > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                        {row.original.currency} {Number(row.getValue("outstanding")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                    </span>
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
                <div role="presentation" className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title={tc("view")}
                        onClick={() => router.push(`/bills/${row.original.id}`)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit('bill', row.original.status) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title={tc("edit")}
                            onClick={() => setEditBillId(row.original.id)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            ),
        },
    ], [dateFormat, router, t, tc]);

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("title")}
                description={pagination ? t("totalBills", { count: pagination.total }) : t("manageDescription")}
                onRefresh={() => mutate()}
                isRefreshing={loading}
                actions={
                    <>
                        <ExportDropdown
                            data={bills}
                            columns={[
                                { header: t("exportBillNum"), accessor: "billNumber" },
                                { header: t("exportSupplier"), accessor: "supplier.name" },
                                { header: t("exportIssueDate"), accessor: "issueDate", format: (v) => v ? formatDate(v as string, dateFormat) : "" },
                                { header: t("exportDueDate"), accessor: "dueDate", format: (v) => v ? formatDate(v as string, dateFormat) : "" },
                                { header: t("exportTotal"), accessor: "total", format: (v) => Number(v).toLocaleString("en-AE", { minimumFractionDigits: 2 }) },
                                { header: t("exportOutstanding"), accessor: "outstanding", format: (v) => Number(v).toLocaleString("en-AE", { minimumFractionDigits: 2 }) },
                                { header: t("exportStatus"), accessor: "status" },
                            ]}
                            filename="bills"
                            title={t("exportTitle")}
                        />
                        <Button onClick={() => setSheetOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t("newBill")}
                        </Button>
                    </>
                }
            />

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <StatCard label={t("totalLabel")}>{pagination?.total ?? "—"}</StatCard>
                <StatCard label={t("outstandingShown")}>
                    {hasMixedCurrencies ? (
                        <div className="space-y-0.5">
                            {Object.entries(outstandingByCurrency).map(([cur, amount]) => (
                                <div key={cur} className="text-amber-600">
                                    {cur} {formatAmount(amount)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <span className="text-amber-600">
                            {summaryCurrency} {formatAmount(totalOutstanding)}
                        </span>
                    )}
                </StatCard>
                <StatCard label={t("overdueLabel")}>
                    <span className="text-destructive">
                        {bills.filter((b) => b.status === "OVERDUE").length}
                    </span>
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
                            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{tc("allStatuses")}</SelectItem>
                                <SelectItem value="DRAFT"><StatusOption status="DRAFT" /></SelectItem>
                                <SelectItem value="RECEIVED"><StatusOption status="RECEIVED" /></SelectItem>
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
                    ) : bills.length === 0 ? (
                        <EmptyState
                            icon={Receipt}
                            title={t("noFound")}
                            description={normalizedSearch || statusFilter !== "ALL" ? tc("adjustFilters") : t("createFirst")}
                            action={!normalizedSearch && statusFilter === "ALL" ? { label: t("newBill"), onClick: () => setSheetOpen(true) } : undefined}
                        />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={bills}
                            onRowClick={(bill) => router.push(`/bills/${bill.id}`)}
                        />
                    )}
                    {pagination && (
                        <PaginationControls pagination={pagination} page={page} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>
            <BillSheet
                open={sheetOpen || !!editBillId}
                onClose={() => { setSheetOpen(false); setEditBillId(null); }}
                onSuccess={() => { mutate(); setSheetOpen(false); setEditBillId(null); }}
                editBillId={editBillId}
            />
        </div>
    );
}
