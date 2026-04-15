"use client";

import { useDeferredValue, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Plus, Search, CreditCard, Loader2, Eye, Pencil } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { ExpenseModal } from "@/components/modals/expense-modal";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, StatusOption } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Expense {
    id: string;
    expenseNumber: string;
    status: string;
    total: number;
    expenseDate: string;
    category: string;
    description: string;
    paymentMethod: string;
    user: { name: string } | null;
}

interface Pagination { total: number; page: number; limit: number; pages: number }

interface ExpenseDetail {
    id: string;
    expenseNumber: string;
    description: string;
    category: string;
    expenseDate: string;
    amount: number;
    vatAmount: number;
    total: number;
    currency: string;
    vatTreatment: string;
    vatRate: number;
    isVatReclaimable: boolean;
    paymentMethod: string;
    isPaid: boolean;
    paidAt: string | null;
    merchantName: string | null;
    reference: string | null;
    notes: string | null;
    status: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    TRAVEL: "Travel",
    MEALS_AND_ENTERTAINMENT: "Meals & Entertainment",
    OFFICE_SUPPLIES: "Office Supplies",
    UTILITIES: "Utilities",
    RENT: "Rent",
    MARKETING: "Marketing",
    PROFESSIONAL_SERVICES: "Professional Services",
    INSURANCE: "Insurance",
    MAINTENANCE: "Maintenance",
    OTHER: "Other",
};

export default function ExpensesPage() {
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const createParamHandled = useRef(false);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Record<string, unknown> | undefined>(undefined);
    const [viewDetail, setViewDetail] = useState<ExpenseDetail | null>(null);
    const deferredSearch = useDeferredValue(search);
    const normalizedSearch = deferredSearch.trim();

    useEffect(() => {
        if (createParamHandled.current) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("create") === "1") {
            setCreateOpen(true);
        }
        createParamHandled.current = true;
    }, []);

    const fetchExpenses = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (normalizedSearch) params.set("search", normalizedSearch);
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            const res = await fetch(`/api/expenses?${params}`);
            if (res.ok) {
                const data = await res.json();
                setExpenses(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, normalizedSearch, statusFilter]);

    useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

    const handleSearchChange = (value: string) => {
        setPage(1);
        setSearch(value);
    };

    const handleStatusFilterChange = (value: string) => {
        setPage(1);
        setStatusFilter(value);
    };

    const totalAmount = expenses.reduce((s, e) => s + Number(e.total), 0);

    const openView = useCallback(async (id: string) => {
        const res = await fetch(`/api/expenses/${id}`);
        if (!res.ok) return;
        setViewDetail(await res.json());
    }, []);

    const openEdit = useCallback(async (id: string) => {
        const res = await fetch(`/api/expenses/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setEditData({
            description: data.description ?? "",
            category: data.category ?? "",
            expenseDate: data.expenseDate?.split("T")[0] ?? new Date().toISOString().split("T")[0],
            amount: data.amount ?? 0,
            vatAmount: data.vatAmount ?? 0,
            paymentMethod: data.paymentMethod ?? "CASH",
            currency: data.currency ?? currency,
            vendorName: data.vendorName ?? "",
            receiptNumber: data.receiptNumber ?? "",
            notes: data.notes ?? "",
        });
        setEditId(id);
    }, [currency]);

    const columns = useMemo<ColumnDef<Expense>[]>(() => [
        {
            accessorKey: "expenseNumber",
            header: "Expense #",
            cell: ({ row }) => <span className="font-medium">{row.getValue("expenseNumber")}</span>,
        },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => <span className="max-w-[200px] truncate block">{row.getValue("description")}</span>,
        },
        {
            accessorKey: "category",
            header: "Category",
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {CATEGORY_LABELS[row.getValue("category") as string] ?? row.getValue("category")}
                </span>
            ),
        },
        {
            accessorKey: "expenseDate",
            header: "Date",
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {new Date(row.getValue("expenseDate")).toLocaleDateString("en-AE")}
                </span>
            ),
        },
        {
            accessorKey: "paymentMethod",
            header: "Method",
            cell: ({ row }) => (
                <span className="text-muted-foreground capitalize">
                    {(row.getValue("paymentMethod") as string)?.toLowerCase().replace(/_/g, " ")}
                </span>
            ),
        },
        {
            accessorKey: "total",
            header: () => <div className="text-right">Amount</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-medium">
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
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="View"
                        onClick={() => openView(row.original.id)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit"
                        onClick={() => openEdit(row.original.id)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ], [currency, openView, openEdit]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
                    <p className="text-muted-foreground">
                        {pagination ? `${pagination.total} total expenses` : "Track business expenses"}
                    </p>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Expense
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{pagination?.total ?? "—"}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Amount (shown)</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {currency} {totalAmount.toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">
                            {expenses.filter((e) => e.status === "PENDING_APPROVAL").length}
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
                                placeholder="Search expenses..."
                                value={search}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Statuses</SelectItem>
                                <SelectItem value="DRAFT"><StatusOption status="DRAFT" /></SelectItem>
                                <SelectItem value="PENDING_APPROVAL"><StatusOption status="PENDING_APPROVAL" /></SelectItem>
                                <SelectItem value="APPROVED"><StatusOption status="APPROVED" /></SelectItem>
                                <SelectItem value="REJECTED"><StatusOption status="REJECTED" /></SelectItem>
                                <SelectItem value="REIMBURSED"><StatusOption status="REIMBURSED" /></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : expenses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <CreditCard className="h-10 w-10 text-muted-foreground/40 mb-3" />
                            <p className="text-sm font-medium">No expenses found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {normalizedSearch || statusFilter !== "ALL" ? "Try adjusting your filters" : "Track your first business expense"}
                            </p>
                            {!normalizedSearch && statusFilter === "ALL" && (
                                <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />New Expense
                                </Button>
                            )}
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={expenses}
                            onRowClick={(expense) => openView(expense.id)}
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
            <ExpenseModal
                open={createOpen || editId !== null}
                onClose={() => { setCreateOpen(false); setEditId(null); setEditData(undefined); }}
                onSuccess={() => { fetchExpenses(); setCreateOpen(false); setEditId(null); setEditData(undefined); }}
                initialData={editData}
                id={editId ?? undefined}
            />

            {/* View Dialog */}
            <Dialog open={viewDetail !== null} onOpenChange={(o) => { if (!o) setViewDetail(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span>{viewDetail?.expenseNumber}</span>
                            {viewDetail && <StatusBadge status={viewDetail.status} />}
                        </DialogTitle>
                    </DialogHeader>
                    {viewDetail && (
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">Description</p>
                                    <p className="font-medium mt-0.5">{viewDetail.description}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Category</p>
                                    <p className="font-medium mt-0.5">{CATEGORY_LABELS[viewDetail.category] ?? viewDetail.category}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Date</p>
                                    <p className="font-medium mt-0.5">{new Date(viewDetail.expenseDate).toLocaleDateString("en-AE")}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Payment Method</p>
                                    <p className="font-medium mt-0.5 capitalize">{viewDetail.paymentMethod?.toLowerCase().replace(/_/g, " ")}</p>
                                </div>
                                {viewDetail.merchantName && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">Vendor</p>
                                        <p className="font-medium mt-0.5">{viewDetail.merchantName}</p>
                                    </div>
                                )}
                                {viewDetail.reference && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">Reference</p>
                                        <p className="font-medium mt-0.5">{viewDetail.reference}</p>
                                    </div>
                                )}
                            </div>
                            <Separator />
                            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Amount</span>
                                    <span>{viewDetail.currency} {Number(viewDetail.amount).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
                                </div>
                                {Number(viewDetail.vatAmount) > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>VAT ({viewDetail.vatTreatment.replace(/_/g, " ")})</span>
                                        <span>{viewDetail.currency} {Number(viewDetail.vatAmount).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-semibold pt-1 border-t">
                                    <span>Total</span>
                                    <span>{viewDetail.currency} {Number(viewDetail.total).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                            {viewDetail.notes && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                                    <p className="text-sm text-muted-foreground">{viewDetail.notes}</p>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-1">
                                <Badge variant={viewDetail.isPaid ? "default" : "secondary"}>
                                    {viewDetail.isPaid ? "Paid" : "Unpaid"}
                                </Badge>
                                <Button size="sm" variant="outline" onClick={() => { setViewDetail(null); openEdit(viewDetail.id); }}>
                                    <Pencil className="mr-2 h-3.5 w-3.5" />Edit
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
