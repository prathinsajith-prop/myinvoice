"use client";

import { useDeferredValue, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Receipt, AlertCircle, Eye, Pencil } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { BillSheet } from "@/components/modals/bill-sheet";
import { canEdit } from "@/lib/utils/can-edit";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

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
import { formatAmount } from "@/lib/format";

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
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const createParamHandled = useRef(false);
    const [bills, setBills] = useState<Bill[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
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

    const fetchBills = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (normalizedSearch) params.set("search", normalizedSearch);
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            const res = await fetch(`/api/bills?${params}`);
            if (res.ok) {
                const data = await res.json();
                setBills(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, normalizedSearch, statusFilter]);

    useEffect(() => { fetchBills(); }, [fetchBills]);

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
            header: "Bill #",
            cell: ({ row }) => <span className="font-medium">{row.getValue("billNumber")}</span>,
        },
        {
            id: "supplier",
            header: "Supplier",
            cell: ({ row }) => row.original.supplier?.name,
        },
        {
            accessorKey: "issueDate",
            header: "Bill Date",
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {new Date(row.getValue("issueDate")).toLocaleDateString("en-AE")}
                </span>
            ),
        },
        {
            accessorKey: "dueDate",
            header: "Due Date",
            cell: ({ row }) => {
                const isOverdue = !["PAID", "VOID"].includes(row.original.status) && new Date(row.getValue("dueDate")) < new Date();
                return (
                    <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {isOverdue && <AlertCircle className="inline h-3 w-3 mr-1" />}
                        {new Date(row.getValue("dueDate")).toLocaleDateString("en-AE")}
                    </span>
                );
            },
        },
        {
            accessorKey: "total",
            header: () => <div className="text-right">Amount</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {row.original.currency} {Number(row.getValue("total")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                </div>
            ),
        },
        {
            accessorKey: "outstanding",
            header: () => <div className="text-right">Outstanding</div>,
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
            header: "Status",
            cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="View"
                        onClick={() => router.push(`/bills/${row.original.id}`)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit('bill', row.original.status) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit"
                            onClick={() => setEditBillId(row.original.id)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            ),
        },
    ], [router]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Bills</h1>
                    <p className="text-muted-foreground">
                        {pagination ? `${pagination.total} total bills` : "Manage supplier bills (payables)"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportDropdown
                        data={bills}
                        columns={[
                            { header: "Bill #", accessor: "billNumber" },
                            { header: "Supplier", accessor: "supplier.name" },
                            { header: "Issue Date", accessor: "issueDate", format: (v) => v ? new Date(v as string).toLocaleDateString("en-AE") : "" },
                            { header: "Due Date", accessor: "dueDate", format: (v) => v ? new Date(v as string).toLocaleDateString("en-AE") : "" },
                            { header: "Total", accessor: "total", format: (v) => Number(v).toLocaleString("en-AE", { minimumFractionDigits: 2 }) },
                            { header: "Outstanding", accessor: "outstanding", format: (v) => Number(v).toLocaleString("en-AE", { minimumFractionDigits: 2 }) },
                            { header: "Status", accessor: "status" },
                        ]}
                        filename="bills"
                        title="Bills Report"
                    />
                    <Button onClick={() => setSheetOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Bill
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <StatCard label="Total Bills">{pagination?.total ?? "—"}</StatCard>
                <StatCard label="Outstanding (shown)">
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
                <StatCard label="Overdue">
                    <span className="text-destructive">
                        {bills.filter((b) => b.status === "OVERDUE").length}
                    </span>
                </StatCard>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <SearchInput
                            placeholder="Search bills..."
                            value={search}
                            onChange={handleSearchChange}
                        />
                        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Statuses</SelectItem>
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
                            title="No bills found"
                            description={normalizedSearch || statusFilter !== "ALL" ? "Try adjusting your filters" : "Record your first supplier bill"}
                            action={!normalizedSearch && statusFilter === "ALL" ? { label: "New Bill", onClick: () => setSheetOpen(true) } : undefined}
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
                onSuccess={() => { fetchBills(); setSheetOpen(false); setEditBillId(null); }}
                editBillId={editBillId}
            />
        </div>
    );
}
