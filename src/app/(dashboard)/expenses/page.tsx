"use client";

import { useDeferredValue, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Plus, CreditCard, Eye, Pencil } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { ExpenseModal } from "@/components/modals/expense-modal";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

import { Button } from "@/components/ui/button";
import { ExportDropdown } from "@/components/export-dropdown";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useTranslations } from "next-intl";
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PaginationControls } from "@/components/pagination-controls";
import { StatCard } from "@/components/stat-card";
import { formatAmount, formatDate } from "@/lib/format";
import { VAT_TREATMENT_LABELS } from "@/lib/constants/labels";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
    isPaid: boolean;
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
}

export default function ExpensesPage() {
    const t = useTranslations("expenses");
    const tc = useTranslations("common");
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const dateFormat = orgSettings.dateFormat;
    const createParamHandled = useRef(false);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
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
            if (categoryFilter !== "ALL") params.set("category", categoryFilter);
            const res = await fetch(`/api/expenses?${params}`);
            if (res.ok) {
                const data = await res.json();
                setExpenses(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, normalizedSearch, categoryFilter]);

    useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

    const handleSearchChange = (value: string) => {
        setPage(1);
        setSearch(value);
    };

    const handleCategoryFilterChange = (value: string) => {
        setPage(1);
        setCategoryFilter(value);
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
            header: t("expenseNum"),
            cell: ({ row }) => <span className="font-medium">{row.getValue("expenseNumber")}</span>,
        },
        {
            accessorKey: "description",
            header: tc("description"),
            cell: ({ row }) => <span className="max-w-[200px] truncate block">{row.getValue("description")}</span>,
        },
        {
            accessorKey: "category",
            header: tc("category"),
            cell: ({ row }) => (
                <Badge variant="outline" className="text-xs">
                    {t(`categories.${row.getValue("category") as string}`)}
                </Badge>
            ),
        },
        {
            accessorKey: "expenseDate",
            header: tc("date"),
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {formatDate(String(row.getValue("expenseDate")), dateFormat)}
                </span>
            ),
        },
        {
            accessorKey: "paymentMethod",
            header: tc("method"),
            cell: ({ row }) => (
                <Badge variant="secondary" className="text-xs capitalize">
                    {(row.getValue("paymentMethod") as string)?.toLowerCase().replace(/_/g, " ")}
                </Badge>
            ),
        },
        {
            accessorKey: "total",
            header: () => <div className="text-right">{tc("amount")}</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums font-medium">
                    {currency} {Number(row.getValue("total")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                </div>
            ),
        },
        {
            accessorKey: "isPaid",
            header: tc("payment"),
            cell: ({ row }) => (
                <StatusBadge status={row.getValue("isPaid") ? "PAID" : "UNPAID"} />
            ),
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div role="presentation" className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title={tc("view")}
                        onClick={() => openView(row.original.id)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title={tc("edit")}
                        onClick={() => openEdit(row.original.id)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ], [currency, dateFormat, openView, openEdit, t, tc]);

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("title")}
                description={pagination ? t("totalExpenses", { count: pagination.total }) : t("manageDescription")}
                onRefresh={fetchExpenses}
                isRefreshing={loading}
                actions={
                    <>
                        <ExportDropdown
                            data={expenses}
                            columns={[
                                { header: t("exportExpenseNum"), accessor: "expenseNumber" },
                                { header: t("exportDescription"), accessor: "description" },
                                { header: t("exportCategory"), accessor: "category", format: (v) => t(`categories.${v as string}`) },
                                { header: t("exportDate"), accessor: "expenseDate", format: (v) => v ? formatDate(v as string, dateFormat) : "" },
                                { header: t("exportMethod"), accessor: "paymentMethod", format: (v) => String(v).toLowerCase().replace(/_/g, " ") },
                                { header: t("exportTotal"), accessor: "total", format: (v) => Number(v).toLocaleString("en-AE", { minimumFractionDigits: 2 }) },
                                { header: t("exportPaid"), accessor: "isPaid", format: (v) => v ? tc("yes") : tc("no") },
                            ]}
                            filename="expenses"
                            title={t("exportTitle")}
                        />
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t("newExpense")}
                        </Button>
                    </>
                }
            />

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <StatCard label={t("totalLabel")}>{pagination?.total ?? "—"}</StatCard>
                <StatCard label={t("amountShown")}>{currency} {formatAmount(totalAmount)}</StatCard>
                <StatCard label={t("unpaid")}><span className="text-amber-600">{expenses.filter((e) => !e.isPaid).length}</span></StatCard>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <SearchInput
                            placeholder={t("searchPlaceholder")}
                            value={search}
                            onChange={handleSearchChange}
                        />
                        <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
                            <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{t("allCategories")}</SelectItem>
                                <SelectItem value="TRAVEL">{t("categories.TRAVEL")}</SelectItem>
                                <SelectItem value="MEALS_ENTERTAINMENT">{t("categories.MEALS_ENTERTAINMENT")}</SelectItem>
                                <SelectItem value="OFFICE_SUPPLIES">{t("categories.OFFICE_SUPPLIES")}</SelectItem>
                                <SelectItem value="UTILITIES">{t("categories.UTILITIES")}</SelectItem>
                                <SelectItem value="RENT">{t("categories.RENT")}</SelectItem>
                                <SelectItem value="MARKETING">{t("categories.MARKETING")}</SelectItem>
                                <SelectItem value="PROFESSIONAL_FEES">{t("categories.PROFESSIONAL_FEES")}</SelectItem>
                                <SelectItem value="INSURANCE">{t("categories.INSURANCE")}</SelectItem>
                                <SelectItem value="MAINTENANCE_REPAIRS">{t("categories.MAINTENANCE_REPAIRS")}</SelectItem>
                                <SelectItem value="SOFTWARE_SUBSCRIPTIONS">{t("categories.SOFTWARE_SUBSCRIPTIONS")}</SelectItem>
                                <SelectItem value="SALARIES_WAGES">{t("categories.SALARIES_WAGES")}</SelectItem>
                                <SelectItem value="TAX_PAYMENTS">{t("categories.TAX_PAYMENTS")}</SelectItem>
                                <SelectItem value="BANK_CHARGES">{t("categories.BANK_CHARGES")}</SelectItem>
                                <SelectItem value="OTHER">{t("categories.OTHER")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <LoadingState />
                    ) : expenses.length === 0 ? (
                        <EmptyState
                            icon={CreditCard}
                            title={t("noFound")}
                            description={normalizedSearch || categoryFilter !== "ALL" ? tc("adjustFilters") : t("createFirst")}
                            action={!normalizedSearch && categoryFilter === "ALL" ? { label: t("newExpense"), onClick: () => setCreateOpen(true) } : undefined}
                        />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={expenses}
                            onRowClick={(expense) => openView(expense.id)}
                        />
                    )}
                    {pagination && <PaginationControls pagination={pagination} page={page} onPageChange={setPage} />}
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
                            {viewDetail && (
                                <StatusBadge status={viewDetail.isPaid ? "PAID" : "UNPAID"} />
                            )}
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Review expense details including category, payment method, VAT, and totals.
                        </DialogDescription>
                    </DialogHeader>
                    {viewDetail && (
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">{tc("description")}</p>
                                    <p className="font-medium mt-0.5">{viewDetail.description}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{tc("category")}</p>
                                    <Badge variant="outline" className="mt-1 text-xs">{t(`categories.${viewDetail.category}`)}</Badge>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{tc("date")}</p>
                                    <p className="font-medium mt-0.5">{formatDate(viewDetail.expenseDate, dateFormat)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{t("paymentMethod")}</p>
                                    <Badge variant="secondary" className="mt-1 text-xs capitalize">{viewDetail.paymentMethod?.toLowerCase().replace(/_/g, " ")}</Badge>
                                </div>
                                {viewDetail.merchantName && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t("vendor")}</p>
                                        <p className="font-medium mt-0.5">{viewDetail.merchantName}</p>
                                    </div>
                                )}
                                {viewDetail.reference && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t("reference")}</p>
                                        <p className="font-medium mt-0.5">{viewDetail.reference}</p>
                                    </div>
                                )}
                            </div>
                            <Separator />
                            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>{t("amount")}</span>
                                    <span>{viewDetail.currency} {Number(viewDetail.amount).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
                                </div>
                                {Number(viewDetail.vatAmount) > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>VAT ({VAT_TREATMENT_LABELS[viewDetail.vatTreatment] ?? viewDetail.vatTreatment.replace(/_/g, " ")})</span>
                                        <span>{viewDetail.currency} {Number(viewDetail.vatAmount).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-semibold pt-1 border-t">
                                    <span>{t("total")}</span>
                                    <span>{viewDetail.currency} {Number(viewDetail.total).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                            {viewDetail.notes && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">{t("notes")}</p>
                                    <p className="text-sm text-muted-foreground">{viewDetail.notes}</p>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-1">
                                <StatusBadge status={viewDetail.isPaid ? "PAID" : "UNPAID"} />
                                <Button size="sm" variant="outline" onClick={() => { setViewDetail(null); openEdit(viewDetail.id); }}>
                                    <Pencil className="mr-2 h-3.5 w-3.5" />{tc("edit")}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
