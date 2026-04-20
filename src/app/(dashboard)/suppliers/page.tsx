"use client";

import { useDeferredValue, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Truck, Mail, Phone, Eye, Pencil, FileText } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { SupplierModal } from "@/components/modals/supplier-modal";
import { BillSheet } from "@/components/modals/bill-sheet";
import { useTenant } from "@/lib/tenant/context";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

import { Button } from "@/components/ui/button";
import { ExportDropdown } from "@/components/export-dropdown";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { useTranslations } from "next-intl";
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PaginationControls } from "@/components/pagination-controls";
import { formatAmount } from "@/lib/format";

interface Supplier {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    type: string;
    totalBilled: number;
    totalOutstanding: number;
    billCount: number;
    isActive: boolean;
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export default function SuppliersPage() {
    const t = useTranslations("suppliers");
    const tc = useTranslations("common");
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const { hasPermission } = useTenant();
    const createParamHandled = useRef(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Record<string, unknown> | undefined>(undefined);
    const [billOpen, setBillOpen] = useState(false);
    const [billSupplierId, setBillSupplierId] = useState<string | undefined>(undefined);
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

    const fetchSuppliers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (normalizedSearch) params.set("search", normalizedSearch);
            if (typeFilter !== "ALL") params.set("type", typeFilter);
            const res = await fetch(`/api/suppliers?${params}`);
            if (res.ok) {
                const data = await res.json();
                setSuppliers(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, normalizedSearch, typeFilter]);

    useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

    const handleSearchChange = (value: string) => {
        setPage(1);
        setSearch(value);
    };

    const handleTypeFilterChange = (value: string) => {
        setPage(1);
        setTypeFilter(value);
    };

    const columns = useMemo<ColumnDef<Supplier>[]>(() => [
        {
            id: "name",
            header: t("supplier"),
            accessorFn: (row) => row.name,
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.name}</div>
                    <div className="text-xs text-muted-foreground">
                        {t("billCount", { count: row.original.billCount })}
                    </div>
                </div>
            ),
        },
        {
            id: "contact",
            header: t("contactHeader"),
            cell: ({ row }) => (
                <div className="flex flex-col gap-0.5">
                    {row.original.email && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />{row.original.email}
                        </span>
                    )}
                    {row.original.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />{row.original.phone}
                        </span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "type",
            header: t("typeHeader"),
            cell: ({ row }) => (
                <Badge variant="outline" className="text-xs capitalize">
                    {(row.getValue("type") as string)?.toLowerCase() ?? "business"}
                </Badge>
            ),
        },
        {
            accessorKey: "totalBilled",
            header: () => <div className="text-right">{t("billedHeader")}</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {currency} {Number(row.getValue("totalBilled")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                </div>
            ),
        },
        {
            accessorKey: "totalOutstanding",
            header: () => <div className="text-right">{tc("outstanding")}</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    <span className={Number(row.getValue("totalOutstanding")) > 0 ? "text-amber-600 font-medium" : ""}>
                        {currency} {Number(row.getValue("totalOutstanding")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "isActive",
            header: tc("status"),
            cell: ({ row }) => (
                <StatusBadge status={row.getValue("isActive") ? "ACTIVE" : "INACTIVE"} />
            ),
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div role="presentation" className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title={tc("view")}
                        onClick={() => router.push(`/suppliers/${row.original.id}`)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title={tc("edit")}
                        onClick={() => openEdit(row.original.id)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setBillSupplierId(row.original.id); setBillOpen(true); }}>
                                <FileText className="mr-2 h-4 w-4" />
                                {t("newBill")}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ], [currency, router, t, tc]);

    async function openEdit(id: string) {
        const res = await fetch(`/api/suppliers/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setEditData({
            name: data.name ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
            type: data.type ?? "BUSINESS",
            taxRegistrationNumber: data.trn ?? "",
            address: data.addressLine1 ?? "",
            city: data.city ?? "",
            country: data.country ?? "AE",
            website: data.website ?? "",
            bankAccountNumber: data.bankAccountNumber ?? "",
            bankAccountName: data.bankAccountName ?? "",
            iban: data.bankIban ?? "",
            notes: data.notes ?? "",
        });
        setEditId(id);
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("title")}
                description={pagination ? t("totalSuppliers", { count: pagination.total }) : t("manageDescription")}
                onRefresh={fetchSuppliers}
                isRefreshing={loading}
                actions={
                    <>
                        <ExportDropdown
                            data={suppliers}
                            columns={[
                                { header: t("exportName"), accessor: "name" },
                                { header: t("exportEmail"), accessor: "email" },
                                { header: t("exportPhone"), accessor: "phone" },
                                { header: t("exportType"), accessor: "type" },
                                { header: t("exportTotalBilled"), accessor: "totalBilled", format: (v) => formatAmount(v) },
                                { header: t("exportOutstanding"), accessor: "totalOutstanding", format: (v) => formatAmount(v) },
                                { header: t("exportActive"), accessor: "isActive", format: (v) => v ? tc("yes") : tc("no") },
                            ]}
                            filename="suppliers"
                            title={t("exportTitle")}
                        />
                        {hasPermission('create') && (
                            <Button onClick={() => setCreateOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                {t("newSupplier")}
                            </Button>
                        )}
                    </>
                }
            />

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <SearchInput
                            placeholder={t("searchPlaceholder")}
                            value={search}
                            onChange={handleSearchChange}
                        />
                        <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{t("allTypes")}</SelectItem>
                                <SelectItem value="BUSINESS">{t("business")}</SelectItem>
                                <SelectItem value="INDIVIDUAL">{t("individual")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <LoadingState />
                    ) : suppliers.length === 0 ? (
                        <EmptyState
                            icon={Truck}
                            title={t("noFound")}
                            description={normalizedSearch || typeFilter !== "ALL" ? tc("adjustFilters") : t("createFirst")}
                            action={!normalizedSearch && typeFilter === "ALL" ? { label: t("newSupplier"), onClick: () => setCreateOpen(true) } : undefined}
                        />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={suppliers}
                            onRowClick={(supplier) => router.push(`/suppliers/${supplier.id}`)}
                        />
                    )}
                    {pagination && (
                        <PaginationControls pagination={pagination} page={page} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>

            <SupplierModal
                open={createOpen || editId !== null}
                onClose={() => { setCreateOpen(false); setEditId(null); setEditData(undefined); }}
                onSuccess={() => { fetchSuppliers(); setCreateOpen(false); setEditId(null); setEditData(undefined); }}
                initialData={editData as Record<string, string>}
                id={editId ?? undefined}
            />

            <BillSheet
                open={billOpen}
                onClose={() => { setBillOpen(false); setBillSupplierId(undefined); }}
                onSuccess={() => { setBillOpen(false); }}
                defaultSupplierId={billSupplierId}
            />
        </div>
    );
}
