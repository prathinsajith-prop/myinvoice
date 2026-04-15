"use client";

import { useDeferredValue, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, FileText } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { CreditNoteSheet } from "@/components/modals/credit-note-sheet";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PaginationControls } from "@/components/pagination-controls";
import { formatCurrency } from "@/lib/format";

interface CreditNote {
    id: string;
    creditNoteNumber: string;
    status: string;
    total: number;
    issueDate: string;
    reason: string;
    currency: string;
    customer: { id: string; name: string };
    invoice: { id: string; invoiceNumber: string };
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export default function CreditNotesPage() {
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const [notes, setNotes] = useState<CreditNote[]>([]);
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
            const res = await fetch(`/api/credit-notes?${params}`);
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

    const handleSearchChange = (value: string) => { setPage(1); setSearch(value); };
    const handleStatusChange = (value: string) => { setPage(1); setStatusFilter(value); };

    const columns = useMemo<ColumnDef<CreditNote>[]>(() => [
        {
            accessorKey: "creditNoteNumber",
            header: "CN #",
            cell: ({ row }) => <span className="font-medium">{row.getValue("creditNoteNumber")}</span>,
        },
        {
            id: "customer",
            header: "Customer",
            cell: ({ row }) => row.original.customer?.name,
        },
        {
            id: "invoice",
            header: "Invoice",
            cell: ({ row }) => (
                <Link
                    href={`/invoices/${row.original.invoice?.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                >
                    {row.original.invoice?.invoiceNumber}
                </Link>
            ),
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
            accessorKey: "total",
            header: () => <div className="text-right">Amount</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {formatCurrency(Number(row.getValue("total")), row.original.currency || currency)}
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
                                <Link href={`/credit-notes/${row.original.id}`}>View</Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ], [currency]);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Credit Notes</h1>
                    <p className="text-muted-foreground text-sm">Manage credit notes issued to customers</p>
                </div>
                <Button onClick={() => setSheetOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Credit Note
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <SearchInput
                            value={search}
                            onChange={handleSearchChange}
                            placeholder="Search by CN# or customer..."
                            onRefresh={fetchNotes}
                            isRefreshing={loading}
                            className="sm:w-72"
                        />
                        <Select value={statusFilter} onValueChange={handleStatusChange}>
                            <SelectTrigger className="sm:w-40">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Statuses</SelectItem>
                                <SelectItem value="DRAFT">Draft</SelectItem>
                                <SelectItem value="ISSUED">Issued</SelectItem>
                                <SelectItem value="APPLIED">Applied</SelectItem>
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
                            icon={FileText}
                            title="No credit notes yet"
                            description="Create your first credit note to get started."
                            action={<Button onClick={() => setSheetOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Credit Note</Button>}
                        />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={notes}
                            onRowClick={(row) => router.push(`/credit-notes/${row.id}`)}
                        />
                    )}
                </CardContent>
            </Card>

            {pagination && pagination.pages > 1 && (
                <PaginationControls
                    page={page}
                    pages={pagination.pages}
                    total={pagination.total}
                    onPageChange={setPage}
                />
            )}

            <CreditNoteSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSuccess={(note) => { router.push(`/credit-notes/${note.id}`); }}
            />
        </div>
    );
}
