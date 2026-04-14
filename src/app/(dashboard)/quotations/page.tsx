"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Eye, FileCheck, Loader2 } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { QuotationSheet } from "@/components/modals/quotation-sheet";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);

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

    const fetchQuotations = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (debouncedSearch) params.set("search", debouncedSearch);
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
    }, [page, debouncedSearch, statusFilter]);

    useEffect(() => { fetchQuotations(); }, [fetchQuotations]);
    useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

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
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="View"
                        onClick={() => router.push(`/quotations/${row.original.id}`)}>
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
                    <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
                    <p className="text-muted-foreground">
                        {pagination ? `${pagination.total} total quotations` : "Manage your sales quotations"}
                    </p>
                </div>
                <Button onClick={() => setSheetOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Quotation
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search quotations..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-40">
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
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : quotations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <FileCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
                            <p className="text-sm font-medium">No quotations found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {debouncedSearch || statusFilter !== "ALL" ? "Try adjusting your filters" : "Create your first quotation"}
                            </p>
                            {!debouncedSearch && statusFilter === "ALL" && (
                                <Button className="mt-4" size="sm" onClick={() => setSheetOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />New Quotation
                                </Button>
                            )}
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={quotations}
                            onRowClick={(q) => router.push(`/quotations/${q.id}`)}
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
            <QuotationSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSuccess={() => { fetchQuotations(); setSheetOpen(false); }}
            />
        </div>
    );
}
