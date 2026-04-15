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
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PaginationControls } from "@/components/pagination-controls";
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
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
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
            header: "Quote #",
            cell: ({ row }) => <span className="font-medium">{row.getValue("quoteNumber")}</span>,
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
            accessorKey: "validUntil",
            header: "Valid Until",
            cell: ({ row }) => {
                const isExpired = !["CONVERTED", "REJECTED"].includes(row.original.status) && new Date(row.getValue("validUntil")) < new Date();
                return (
                    <span className={isExpired ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {new Date(row.getValue("validUntil")).toLocaleDateString("en-AE")}
                    </span>
                );
            },
        },
        {
            accessorKey: "total",
            header: () => <div className="text-right">Total</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {currency} {Number(row.getValue("total")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
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
                    <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View"
                            onClick={() => router.push(`/quotations/${row.original.id}`)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                        {canEdit('quotation', row.original.status) && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit"
                                onClick={() => setEditQuotationId(row.original.id)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            ),
        },
    ], [currency, router]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Quotations"
                description={pagination ? `${pagination.total} total quotations` : "Manage your sales quotations"}
                actions={
                    <>
                        <ExportDropdown
                            data={quotations}
                            columns={[
                                { header: "Quote #", accessor: "quoteNumber" },
                                { header: "Customer", accessor: "customer.name" },
                                { header: "Issue Date", accessor: "issueDate", format: (v) => v ? new Date(v as string).toLocaleDateString("en-AE") : "" },
                                { header: "Valid Until", accessor: "validUntil", format: (v) => v ? new Date(v as string).toLocaleDateString("en-AE") : "" },
                                { header: "Total", accessor: "total", format: (v) => Number(v).toLocaleString("en-AE", { minimumFractionDigits: 2 }) },
                                { header: "Status", accessor: "status" },
                            ]}
                            filename="quotations"
                            title="Quotations Report"
                        />
                        <Button onClick={() => setSheetOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Quotation
                        </Button>
                    </>
                }
            />

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <SearchInput
                            placeholder="Search quotations..."
                            value={search}
                            onChange={handleSearchChange}
                            onRefresh={fetchQuotations}
                            isRefreshing={loading}
                        />
                        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Statuses</SelectItem>
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
                            title="No quotations found"
                            description={normalizedSearch || statusFilter !== "ALL" ? "Try adjusting your filters" : "Create your first quotation"}
                            action={!normalizedSearch && statusFilter === "ALL" ? { label: "New Quotation", onClick: () => setSheetOpen(true) } : undefined}
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
