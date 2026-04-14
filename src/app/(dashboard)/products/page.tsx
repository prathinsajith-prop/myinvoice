"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, MoreHorizontal, Package, Loader2 } from "lucide-react";
import { ProductModal } from "@/components/modals/product-modal";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    const createParamHandled = useRef(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Record<string, unknown> | undefined>(undefined);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

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
            if (debouncedSearch) params.set("search", debouncedSearch);
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
    }, [page, debouncedSearch, typeFilter]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);
    useEffect(() => { setPage(1); }, [debouncedSearch, typeFilter]);

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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Products & Services</h1>
                    <p className="text-muted-foreground">
                        {pagination ? `${pagination.total} items` : "Manage your product catalog"}
                    </p>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search products..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
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
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : products.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
                            <p className="text-sm font-medium">No products found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {debouncedSearch || typeFilter !== "ALL" ? "Try adjusting your filters" : "Add your first product or service"}
                            </p>
                            {!debouncedSearch && typeFilter === "ALL" && (
                                <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />Add Product
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Unit Price</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">VAT</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                                        <th className="px-4 py-3 w-10" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((product) => (
                                        <tr
                                            key={product.id}
                                            className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                                            onClick={() => router.push(`/products/${product.id}`)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{product.name}</div>
                                                {product.category && (
                                                    <div className="text-xs text-muted-foreground">{product.category}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                                                {product.sku ?? "—"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className="text-xs">
                                                    {TYPE_LABELS[product.type] ?? product.type}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                AED {Number(product.unitPrice).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                                <span className="text-xs text-muted-foreground ml-1">/{product.unitOfMeasure}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs text-muted-foreground">
                                                    {product.vatTreatment?.replace("_", " ") ?? "—"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={product.isActive ? "default" : "secondary"} className="text-xs">
                                                    {product.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => router.push(`/products/${product.id}`)}>View</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openEdit(product.id)}>Edit</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
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
