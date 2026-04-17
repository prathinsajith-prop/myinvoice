"use client";

import { useDeferredValue, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Package, Eye, Pencil } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { ProductModal } from "@/components/modals/product-modal";
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

import { PageHeader } from "@/components/page-header";
import { useTranslations } from "next-intl";
import { VAT_TREATMENT_LABELS } from "@/lib/constants/labels";
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PaginationControls } from "@/components/pagination-controls";
import { formatAmount } from "@/lib/format";

interface Product {
    id: string;
    name: string;
    sku: string | null;
    type: string;
    unitPrice: number;
    vatTreatment: string;
    unitOfMeasure: string;
    isActive: boolean;
    category: string | null;
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export default function ProductsPage() {
    const t = useTranslations("products");
    const tc = useTranslations("common");
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const createParamHandled = useRef(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Record<string, unknown> | undefined>(undefined);
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

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (normalizedSearch) params.set("search", normalizedSearch);
            if (typeFilter !== "ALL") params.set("type", typeFilter);
            const res = await fetch(`/api/products?${params}`);
            if (res.ok) {
                const data = await res.json();
                setProducts(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, normalizedSearch, typeFilter]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const handleSearchChange = (value: string) => {
        setPage(1);
        setSearch(value);
    };

    const handleTypeFilterChange = (value: string) => {
        setPage(1);
        setTypeFilter(value);
    };

    const columns = useMemo<ColumnDef<Product>[]>(() => [
        {
            accessorKey: "name",
            header: tc("name"),
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.getValue("name")}</div>
                    {row.original.category && (
                        <div className="text-xs text-muted-foreground">{row.original.category}</div>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "sku",
            header: t("sku"),
            cell: ({ row }) => (
                <span className="text-muted-foreground font-mono text-xs">
                    {(row.getValue("sku") as string | null) ?? "—"}
                </span>
            ),
        },
        {
            accessorKey: "type",
            header: t("type"),
            cell: ({ row }) => (
                <Badge variant="outline" className="text-xs">
                    {t(`typeLabels.${row.getValue("type") as string}`) ?? row.getValue("type")}
                </Badge>
            ),
        },
        {
            accessorKey: "unitPrice",
            header: () => <div className="text-right">{t("unitPriceHeader")}</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {currency} {Number(row.getValue("unitPrice")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                    <span className="text-xs text-muted-foreground ml-1">/{row.original.unitOfMeasure}</span>
                </div>
            ),
        },
        {
            accessorKey: "vatTreatment",
            header: t("vatHeader"),
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground">
                    {(row.getValue("vatTreatment") as string)
                        ? VAT_TREATMENT_LABELS[row.getValue("vatTreatment") as string] ?? (row.getValue("vatTreatment") as string).replace(/_/g, " ")
                        : "—"}
                </span>
            ),
        },
        {
            accessorKey: "isActive",
            header: t("statusHeader"),
            cell: ({ row }) => (
                <StatusBadge status={row.getValue("isActive") ? "ACTIVE" : "INACTIVE"} />
            ),
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div role="presentation" className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={tc("view")}
                        onClick={() => router.push(`/products/${row.original.id}`)}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={tc("edit")}
                        onClick={() => openEdit(row.original.id)}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ], [currency, router, t, tc]);

    async function openEdit(id: string) {
        const res = await fetch(`/api/products/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setEditData({
            name: data.name ?? "",
            sku: data.sku ?? "",
            description: data.description ?? "",
            type: data.type === "PRODUCT" ? "PRODUCT" : "SERVICE",
            unitPrice: data.unitPrice ?? 0,
            unit: data.unitOfMeasure ?? "unit",
            vatTreatment: data.vatTreatment ?? "STANDARD_RATED",
            vatRate: data.vatRate ?? 5,
            category: data.category ?? "",
            trackInventory: data.trackInventory ?? false,
            isActive: data.isActive ?? true,
        });
        setEditId(id);
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("title")}
                description={pagination ? t("totalItems", { count: pagination.total }) : t("manageDescription")}
                onRefresh={fetchProducts}
                isRefreshing={loading}
                actions={
                    <>
                        <ExportDropdown
                            data={products}
                            columns={[
                                { header: t("exportName"), accessor: "name" },
                                { header: t("exportSku"), accessor: "sku" },
                                { header: t("exportType"), accessor: "type" },
                                { header: t("exportUnitPrice"), accessor: "unitPrice", format: (v) => formatAmount(v) },
                                { header: t("exportVatTreatment"), accessor: "vatTreatment", format: (v) => String(v).replace(/_/g, " ") },
                                { header: t("exportActive"), accessor: "isActive", format: (v) => v ? tc("yes") : tc("no") },
                            ]}
                            filename="products"
                            title={t("exportTitle")}
                        />
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t("newProduct")}
                        </Button>
                    </>
                }
            />

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <SearchInput
                            placeholder={t("searchPlaceholder")}
                            value={search}
                            onChange={handleSearchChange}
                        />
                        <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
                            <SelectTrigger className="w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{t("allTypes")}</SelectItem>
                                <SelectItem value="PRODUCT">{t("typeLabels.PRODUCT")}</SelectItem>
                                <SelectItem value="SERVICE">{t("typeLabels.SERVICE")}</SelectItem>
                                <SelectItem value="EXPENSE">{t("typeLabels.EXPENSE")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <LoadingState />
                    ) : products.length === 0 ? (
                        <EmptyState
                            icon={Package}
                            title={t("noFound")}
                            description={normalizedSearch || typeFilter !== "ALL" ? tc("adjustFilters") : t("createFirst")}
                            action={!normalizedSearch && typeFilter === "ALL" ? { label: t("newProduct"), onClick: () => setCreateOpen(true) } : undefined}
                        />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={products}
                            onRowClick={(product) => router.push(`/products/${product.id}`)}
                        />
                    )}
                    {pagination && (
                        <PaginationControls pagination={pagination} page={page} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>

            <ProductModal
                open={createOpen || editId !== null}
                onClose={() => { setCreateOpen(false); setEditId(null); setEditData(undefined); }}
                onSuccess={() => { fetchProducts(); setCreateOpen(false); setEditId(null); setEditData(undefined); }}
                initialData={editData as Record<string, unknown>}
                id={editId ?? undefined}
            />
        </div>
    );
}
