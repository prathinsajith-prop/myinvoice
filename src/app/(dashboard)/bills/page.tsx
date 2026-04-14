"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Receipt, Loader2, AlertCircle, Eye } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { BillSheet } from "@/components/modals/bill-sheet";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, StatusOption } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Bill {
    id: string;
    billNumber: string;
    status: string;
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
    const currency = orgSettings.defaultCurrency;
    const createParamHandled = useRef(false);
    const [bills, setBills] = useState<Bill[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [viewId, setViewId] = useState<string | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

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
            if (debouncedSearch) params.set("search", debouncedSearch);
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
    }, [page, debouncedSearch, statusFilter]);

    useEffect(() => { fetchBills(); }, [fetchBills]);
    useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

    const totalOutstanding = bills.reduce((s, b) => s + Number(b.outstanding), 0);

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
                    {currency} {Number(row.getValue("total")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                </div>
            ),
        },
        {
            accessorKey: "outstanding",
            header: () => <div className="text-right">Outstanding</div>,
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
            header: "Status",
            cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="View"
                        onClick={() => router.push(`/bills/${row.original.id}`)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ], [currency, router]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Bills</h1>
                    <p className="text-muted-foreground">
                        {pagination ? `${pagination.total} total bills` : "Manage supplier bills (payables)"}
                    </p>
                </div>
                <Button onClick={() => setSheetOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Bill
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Bills</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{pagination?.total ?? "—"}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Outstanding (shown)</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">
                            {currency} {totalOutstanding.toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">
                            {bills.filter((b) => b.status === "OVERDUE").length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search bills..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : bills.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Receipt className="h-10 w-10 text-muted-foreground/40 mb-3" />
                            <p className="text-sm font-medium">No bills found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {debouncedSearch || statusFilter !== "ALL" ? "Try adjusting your filters" : "Record your first supplier bill"}
                            </p>
                            {!debouncedSearch && statusFilter === "ALL" && (
                                <Button className="mt-4" size="sm" onClick={() => setSheetOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />New Bill
                                </Button>
                            )}
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={bills}
                            onRowClick={(bill) => router.push(`/bills/${bill.id}`)}
                        />
                    )}
                    {pagination && pagination.pages > 1 && (
                        <div className="flex items-center justify-between border-t px-4 py-3">
                            <p className="text-sm text-muted-foreground">
                                Showing {(pagination.page - 1) * pagination.limit + 1}–
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                                <Button variant="outline" size="sm" disabled={page === pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
            <BillSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSuccess={() => { fetchBills(); setSheetOpen(false); }}
            />
        </div>
    );
}
