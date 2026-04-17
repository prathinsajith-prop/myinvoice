"use client";

import { useDeferredValue, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShoppingCart, AlertCircle } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

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
import { PurchaseOrderSheet } from "@/components/modals/purchase-order-sheet";

interface PurchaseOrder {
    id: string;
    poNumber: string;
    status: string;
    currency: string;
    total: number;
    issueDate: string;
    expectedDate: string | null;
    supplier: { id: string; name: string };
}

interface Pagination { total: number; page: number; limit: number; pages: number }

export default function PurchaseOrdersPage() {
    const t = useTranslations("purchaseOrders");
    const tc = useTranslations("common");
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const dateFormat = orgSettings.dateFormat;

    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const deferredSearch = useDeferredValue(search);
    const normalizedSearch = deferredSearch.trim();

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (normalizedSearch) params.set("search", normalizedSearch);
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            const res = await fetch(`/api/purchase-orders?${params}`);
            if (res.ok) {
                const data = await res.json();
                setOrders(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, normalizedSearch, statusFilter]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const handleSearchChange = (value: string) => {
        setPage(1);
        setSearch(value);
    };

    const handleStatusFilterChange = (value: string) => {
        setPage(1);
        setStatusFilter(value);
    };

    const totalValue = orders.reduce((s, o) => s + Number(o.total), 0);

    const columns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
        {
            accessorKey: "poNumber",
            header: t("poNumber"),
            cell: ({ row }) => <span className="font-medium">{row.getValue("poNumber")}</span>,
        },
        {
            id: "supplier",
            header: tc("supplier"),
            cell: ({ row }) => row.original.supplier?.name,
        },
        {
            accessorKey: "issueDate",
            header: tc("date"),
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {formatDate(String(row.getValue("issueDate")), dateFormat)}
                </span>
            ),
        },
        {
            accessorKey: "expectedDate",
            header: t("expectedDate"),
            cell: ({ row }) => {
                const val = row.getValue("expectedDate") as string | null;
                if (!val) return <span className="text-muted-foreground">—</span>;
                const isOverdue =
                    !["RECEIVED", "CANCELLED"].includes(row.original.status) &&
                    new Date(val) < new Date();
                return (
                    <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {isOverdue && <AlertCircle className="inline h-3 w-3 mr-1" />}
                        {formatDate(val, dateFormat)}
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
            accessorKey: "status",
            header: tc("status"),
            cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
        },
    ], [currency, dateFormat, t, tc]);

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("title")}
                description={pagination ? t("totalCount", { total: pagination.total }) : t("manageDescription")}
                onRefresh={fetchOrders}
                isRefreshing={loading}
                actions={
                    <>
                        <ExportDropdown
                            data={orders}
                            columns={[
                                { header: t("poNumber"), accessor: "poNumber" },
                                { header: tc("supplier"), accessor: "supplier.name" },
                                { header: tc("date"), accessor: "issueDate", format: (v) => v ? formatDate(v as string, dateFormat) : "" },
                                { header: t("expectedDate"), accessor: "expectedDate", format: (v) => v ? formatDate(v as string, dateFormat) : "" },
                                { header: tc("amount"), accessor: "total", format: (v) => Number(v).toLocaleString("en-AE", { minimumFractionDigits: 2 }) },
                                { header: tc("status"), accessor: "status" },
                            ]}
                            filename="purchase-orders"
                            title={t("title")}
                        />
                        <Button onClick={() => setSheetOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t("newPO")}
                        </Button>
                    </>
                }
            />

            {/* Stat cards */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <StatCard label={t("totalLabel")}>{pagination?.total ?? "—"}</StatCard>
                <StatCard label={t("totalValueShown")}>
                    <span className="text-primary">{currency} {formatAmount(totalValue)}</span>
                </StatCard>
                <StatCard label={t("pendingLabel")}>
                    <span className="text-amber-600">
                        {orders.filter((o) => ["DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(o.status)).length}
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
                            <SelectTrigger className="w-full sm:w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{tc("allStatuses")}</SelectItem>
                                <SelectItem value="DRAFT"><StatusOption status="DRAFT" /></SelectItem>
                                <SelectItem value="SENT"><StatusOption status="SENT" /></SelectItem>
                                <SelectItem value="CONFIRMED"><StatusOption status="CONFIRMED" /></SelectItem>
                                <SelectItem value="PARTIALLY_RECEIVED"><StatusOption status="PARTIALLY_RECEIVED" /></SelectItem>
                                <SelectItem value="RECEIVED"><StatusOption status="RECEIVED" /></SelectItem>
                                <SelectItem value="CANCELLED"><StatusOption status="CANCELLED" /></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <LoadingState />
                    ) : orders.length === 0 ? (
                        <EmptyState
                            icon={ShoppingCart}
                            title={t("noFound")}
                            description={normalizedSearch || statusFilter !== "ALL" ? tc("adjustFilters") : t("createFirst")}
                            action={!normalizedSearch && statusFilter === "ALL" ? { label: t("newPO"), onClick: () => setSheetOpen(true) } : undefined}
                        />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={orders}
                            onRowClick={(order) => router.push(`/purchase-orders/${order.id}`)}
                        />
                    )}
                    {pagination && (
                        <PaginationControls pagination={pagination} page={page} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>

            <PurchaseOrderSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSuccess={() => { fetchOrders(); setSheetOpen(false); }}
            />
        </div>
    );
}
