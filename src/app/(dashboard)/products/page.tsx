"use client";

import { useDeferredValue, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Package } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { ProductModal } from "@/components/modals/product-modal";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

import { Button } from "@/components/ui/button";
import { ExportDropdown } from "@/components/export-dropdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
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

import { PageHeader } from "@/components/page-header";
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

const TYPE_LABELS: Record<string, string> = {
    PRODUCT: "Product",
    SERVICE: "Service",
    EXPENSE: "Expense",
};

export default function ProductsPage() {
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
            header: "Name",
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
            header: "SKU",
            cell: ({ row }) => (
                <span className="text-muted-foreground font-mono text-xs">
                    {(row.getValue("sku") as string | null) ?? "—"}
                </span>
            ),
        },
        {
            accessorKey: "type",
            header: "Type",
            cell: ({ row }) => (
                <Badge variant="outline" className="text-xs">
                    {TYPE_LABELS[row.getValue("type") as string] ?? row.getValue("type")}
                </Badge>
            ),
        },
        {
            accessorKey: "unitPrice",
            header: () => <div className="text-right">Unit Price</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {currency} {Number(row.getValue("unitPrice")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                    <span className="text-xs text-muted-foreground ml-1">/{row.original.unitOfMeasure}</span>
                </div>
            ),
        },
        {
            accessorKey: "vatTreatment",
            header: "VAT",
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
            header: "Status",
            cell: ({ row }) => (
                <Badge variant={row.getValue("isActive") ? "default" : "secondary"} className="text-xs">
                    {row.getValue("isActive") ? "Active" : "Inactive"}
                </Badge>
            ),
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
                            <DropdownMenuItem onClick={() => router.push(`/products/${row.original.id}`)}>View</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(row.original.id)}>Edit</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ], [currency, router]);

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
                title="Products & Services"
                description={pagination ? `${pagination.total} items` : "Manage your product catalog"}
                actions={
                    <>
                        <ExportDropdown
                            data={products}
                            columns={[
                                { header: "Name", accessor: "name" },
                                { header: "SKU", accessor: "sku" },
                                { header: "Type", accessor: "type" },
                                { header: "Unit Price", accessor: "unitPrice", format: (v) => formatAmount(v) },
                                { header: "VAT Treatment", accessor: "vatTreatment", format: (v) => String(v).replace(/_/g, " ") },
                                { header: "Active", accessor: "isActive", format: (v) => v ? "Yes" : "No" },
                            ]}
                            filename="products"
                            title="Products & Services Report"
                        />
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Product
                        </Button>
                    </>
                }
            />

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <SearchInput
                            placeholder="Search products..."
                            value={search}
                            onChange={handleSearchChange}
                            onRefresh={fetchProducts}
                            isRefreshing={loading}
                        />
                        <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
                            <SelectTrigger className="w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Types</SelectItem>
                                <SelectItem value="PRODUCT">Product</SelectItem>
                                <SelectItem value="SERVICE">Service</SelectItem>
                                <SelectItem value="EXPENSE">Expense</SelectItem>
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
                            title="No products found"
                            description={normalizedSearch || typeFilter !== "ALL" ? "Try adjusting your filters" : "Add your first product or service"}
                            action={!normalizedSearch && typeFilter === "ALL" ? { label: "Add Product", onClick: () => setCreateOpen(true) } : undefined}
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
