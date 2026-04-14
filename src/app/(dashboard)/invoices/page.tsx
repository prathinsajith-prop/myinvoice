"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, MoreHorizontal, FileText, Loader2, AlertCircle } from "lucide-react";

import { InvoiceSheet } from "@/components/modals/invoice-sheet";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, StatusOption } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    const createParamHandled = useRef(false);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
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

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (debouncedSearch) params.set("search", debouncedSearch);
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
    }, [page, debouncedSearch, statusFilter]);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
    useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

    const totalOutstanding = invoices.reduce((s, i) => s + Number(i.outstanding), 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
                    <p className="text-muted-foreground">
                        {pagination ? `${pagination.total} total invoices` : "Manage your sales invoices"}
                    </p>
                </div>
                <Button onClick={() => setSheetOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Invoice
                </Button>
            </div>

            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Invoices</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{pagination?.total ?? "—"}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Outstanding (shown)</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">
                            AED {totalOutstanding.toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">
                            {invoices.filter((i) => i.status === "OVERDUE").length}
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
                                placeholder="Search invoices..."
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
                    ) : invoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                            <p className="text-sm font-medium">No invoices found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {debouncedSearch || statusFilter !== "ALL" ? "Try adjusting your filters" : "Create your first invoice"}
                            </p>
                            {!debouncedSearch && statusFilter === "ALL" && (
                                <Button className="mt-4" size="sm" onClick={() => setSheetOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />New Invoice
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Invoice #</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Issue Date</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Due Date</th>
                                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Outstanding</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                                        <th className="px-4 py-3 w-10" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((invoice) => {
                                        const isOverdue =
                                            invoice.status !== "PAID" &&
                                            invoice.status !== "VOID" &&
                                            new Date(invoice.dueDate) < new Date();
                                        return (
                                            <tr
                                                key={invoice.id}
                                                className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                                                onClick={() => router.push(`/invoices/${invoice.id}`)}
                                            >
                                                <td className="px-4 py-3 font-medium">{invoice.invoiceNumber}</td>
                                                <td className="px-4 py-3">{invoice.customer?.name}</td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {new Date(invoice.issueDate).toLocaleDateString("en-AE")}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                                                        {isOverdue && <AlertCircle className="inline h-3 w-3 mr-1" />}
                                                        {new Date(invoice.dueDate).toLocaleDateString("en-AE")}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    AED {Number(invoice.total).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    <span className={Number(invoice.outstanding) > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                                                        AED {Number(invoice.outstanding).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge status={invoice.status} />
                                                </td>
                                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/invoices/${invoice.id}`}>View</Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/invoices/${invoice.id}/edit`}>Edit</Link>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
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
            <InvoiceSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSuccess={() => { fetchInvoices(); setSheetOpen(false); }}
            />
        </div>
    );
}
