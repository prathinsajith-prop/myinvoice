"use client";

import { useDeferredValue, useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, FileText, AlertCircle } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { InvoiceSheet } from "@/components/modals/invoice-sheet";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

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
import { formatAmount } from "@/lib/format";

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
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
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
            header: "Invoice #",
            cell: ({ row }) => <span className="font-medium">{row.getValue("invoiceNumber")}</span>,
        },
        {
            id: "customer",
            header: "Customer",
            cell: ({ row }) => row.original.customer?.name,
        },
        {
            accessorKey: "issueDate",
            header: "Issue Date",
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
                const isOverdue = row.original.status !== "PAID" && row.original.status !== "VOID" && new Date(row.getValue("dueDate")) < new Date();
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link href={`/invoices/${row.original.id}`}>View</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href={`/invoices/${row.original.id}/edit`}>Edit</Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ], [currency]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
                    <p className="text-muted-foreground">
                        {pagination ? `${pagination.total} total invoices` : "Manage your sales invoices"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportDropdown
                        data={invoices}
                        columns={[
                            { header: "Invoice #", accessor: "invoiceNumber" },
                            { header: "Customer", accessor: "customer.name" },
                            { header: "Issue Date", accessor: "issueDate", format: (v) => v ? new Date(v as string).toLocaleDateString("en-AE") : "" },
                            { header: "Due Date", accessor: "dueDate", format: (v) => v ? new Date(v as string).toLocaleDateString("en-AE") : "" },
                            { header: "Total", accessor: "total", format: (v) => Number(v).toLocaleString("en-AE", { minimumFractionDigits: 2 }) },
                            { header: "Outstanding", accessor: "outstanding", format: (v) => Number(v).toLocaleString("en-AE", { minimumFractionDigits: 2 }) },
                            { header: "Status", accessor: "status" },
                        ]}
                        filename="invoices"
                        title="Invoices Report"
                    />
                    <Button onClick={() => setSheetOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Invoice
                    </Button>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <StatCard label="Total Invoices">{pagination?.total ?? "—"}</StatCard>
                <StatCard label="Outstanding (shown)">
                    <span className="text-amber-600">{currency} {formatAmount(totalOutstanding)}</span>
                </StatCard>
                <StatCard label="Overdue">
                    <span className="text-destructive">{invoices.filter((i) => i.status === "OVERDUE").length}</span>
                </StatCard>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <SearchInput
                            placeholder="Search invoices..."
                            value={search}
                            onChange={handleSearchChange}
                        />
                        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Statuses</SelectItem>
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
                            title="No invoices found"
                            description={normalizedSearch || statusFilter !== "ALL" ? "Try adjusting your filters" : "Create your first invoice"}
                            action={!normalizedSearch && statusFilter === "ALL" ? { label: "New Invoice", onClick: () => setSheetOpen(true) } : undefined}
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
