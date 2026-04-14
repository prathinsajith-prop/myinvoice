"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, MoreHorizontal, CreditCard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface Expense {
    id: string;
    expenseNumber: string;
    status: string;
    totalAmount: number;
    expenseDate: string;
    category: string;
    description: string;
    paymentMethod: string;
    user: { name: string } | null;
}

interface Pagination { total: number; page: number; limit: number; pages: number }

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    DRAFT: { variant: "secondary", label: "Draft" },
    PENDING_APPROVAL: { variant: "default", label: "Pending" },
    APPROVED: { variant: "default", label: "Approved" },
    REJECTED: { variant: "destructive", label: "Rejected" },
    REIMBURSED: { variant: "secondary", label: "Reimbursed" },
    VOID: { variant: "secondary", label: "Void" },
};

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
    const router = useRouter();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    const fetchExpenses = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (debouncedSearch) params.set("search", debouncedSearch);
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
    }, [page, debouncedSearch, statusFilter]);

    useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
    useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

    const totalAmount = expenses.reduce((s, e) => s + Number(e.totalAmount), 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
                    <p className="text-muted-foreground">
                        {pagination ? `${pagination.total} total expenses` : "Track business expenses"}
                    </p>
                </div>
                <Button asChild>
                    <Link href="/expenses/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Expense
                    </Link>
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
                            AED {totalAmount.toLocaleString("en-AE", { minimumFractionDigits: 2 })}
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
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Statuses</SelectItem>
                                <SelectItem value="DRAFT">Draft</SelectItem>
                                <SelectItem value="PENDING_APPROVAL">Pending</SelectItem>
                                <SelectItem value="APPROVED">Approved</SelectItem>
                                <SelectItem value="REJECTED">Rejected</SelectItem>
                                <SelectItem value="REIMBURSED">Reimbursed</SelectItem>
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
                                {debouncedSearch || statusFilter !== "ALL" ? "Try adjusting your filters" : "Track your first business expense"}
                            </p>
                            {!debouncedSearch && statusFilter === "ALL" && (
                                <Button asChild className="mt-4" size="sm">
                                    <Link href="/expenses/new"><Plus className="mr-2 h-4 w-4" />New Expense</Link>
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Expense #</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
                                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                                        <th className="px-4 py-3 w-10" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.map((expense) => {
                                        const statusInfo = STATUS_BADGE[expense.status] ?? { variant: "secondary" as const, label: expense.status };
                                        return (
                                            <tr
                                                key={expense.id}
                                                className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                                                onClick={() => router.push(`/expenses/${expense.id}`)}
                                            >
                                                <td className="px-4 py-3 font-medium">{expense.expenseNumber}</td>
                                                <td className="px-4 py-3 max-w-[200px] truncate">{expense.description}</td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {CATEGORY_LABELS[expense.category] ?? expense.category}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {new Date(expense.expenseDate).toLocaleDateString("en-AE")}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground capitalize">
                                                    {expense.paymentMethod?.toLowerCase().replace(/_/g, " ")}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums font-medium">
                                                    AED {Number(expense.totalAmount).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
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
                                                                <Link href={`/expenses/${expense.id}`}>View</Link>
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
        </div>
    );
}
