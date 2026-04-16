"use client";

import { useDeferredValue, useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText, Eye } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { DebitNoteSheet } from "@/components/modals/debit-note-sheet";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

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
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PaginationControls } from "@/components/pagination-controls";
import { PageHeader } from "@/components/page-header";
import { formatCurrency } from "@/lib/format";

interface DebitNote {
    id: string;
    debitNoteNumber: string;
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

export default function DebitNotesPage() {
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const createParamHandled = useRef(false);
    const [notes, setNotes] = useState<DebitNote[]>([]);
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
            const res = await fetch(`/api/debit-notes?${params}`);
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

    const columns = useMemo<ColumnDef<DebitNote>[]>(() => [
        {
            accessorKey: "debitNoteNumber",
            header: "DN #",
            cell: ({ row }) => <span className="font-medium">{row.getValue("debitNoteNumber")}</span>,
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
                <div role="presentation" className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="View"
                        onClick={() => router.push(`/debit-notes/${row.original.id}`)}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ], [currency, router]);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <PageHeader
                title="Debit Notes"
                description="Manage debit notes issued to customers"
                onRefresh={fetchNotes}
                isRefreshing={loading}
                actions={
                    <Button onClick={() => setSheetOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> New Debit Note
                    </Button>
                }
            />

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <SearchInput
                            value={search}
                            onChange={handleSearchChange}
                            placeholder="Search by DN# or customer..."
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
                            title="No debit notes yet"
                            description="Create your first debit note to get started."
                            action={{ label: "New Debit Note", onClick: () => setSheetOpen(true) }}
                        />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={notes}
                            onRowClick={(row) => router.push(`/debit-notes/${row.id}`)}
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

            <DebitNoteSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSuccess={(note) => { router.push(`/debit-notes/${note.id}`); }}
            />
        </div>
    );
}
