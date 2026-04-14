"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Edit } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProductModal } from "@/components/modals/product-modal";

interface Product {
    id: string;
    name: string;
    sku: string;
    type: string;
    description: string;
    unitPrice: number;
    unitOfMeasure: string;
    vatTreatment: string;
    category: string;
    isActive: boolean;
    trackInventory: boolean;
    currentStock: number;
    reorderPoint: number;
}

const TYPE_BADGE: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
    PRODUCT: { variant: "default", label: "Product" },
    SERVICE: { variant: "secondary", label: "Service" },
    EXPENSE: { variant: "outline", label: "Expense" },
};

const VAT_LABELS: Record<string, string> = {
    STANDARD: "Standard Rate (5%)",
    ZERO_RATED: "Zero Rated (0%)",
    EXEMPT: "Exempt",
    OUT_OF_SCOPE: "Out of Scope",
};

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [editOpen, setEditOpen] = useState(false);

    const fetchProduct = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/products/${params.id}`);
            if (res.ok) setProduct(await res.json());
            else {
                toast.error("Product not found");
                router.push("/products");
            }
        } finally {
            setLoading(false);
        }
    }, [params.id, router]);

    useEffect(() => { fetchProduct(); }, [fetchProduct]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!product) return null;

    const typeInfo = TYPE_BADGE[product.type] ?? { variant: "outline" as const, label: product.type };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/products"><ChevronLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
                            <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                            {!product.isActive && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                        {product.sku && <p className="text-muted-foreground text-sm">SKU: {product.sku}</p>}
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />Edit
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Pricing & VAT */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div className="text-3xl font-bold">
                                AED {Number(product.unitPrice).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                {product.unitOfMeasure && <span className="text-sm font-normal text-muted-foreground ml-1">/ {product.unitOfMeasure}</span>}
                            </div>
                            <Separator />
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">VAT Treatment</span>
                                    <span>{VAT_LABELS[product.vatTreatment] ?? product.vatTreatment}</span>
                                </div>
                                {product.vatTreatment === "STANDARD" && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Price incl. VAT</span>
                                        <span>AED {(Number(product.unitPrice) * 1.05).toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Type</span>
                                <span>{typeInfo.label}</span>
                            </div>
                            {product.sku && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">SKU</span>
                                    <span className="font-mono">{product.sku}</span>
                                </div>
                            )}
                            {product.unitOfMeasure && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Unit</span>
                                    <span>{product.unitOfMeasure}</span>
                                </div>
                            )}
                            {product.category && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Category</span>
                                    <span>{product.category}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <Badge variant={product.isActive ? "default" : "secondary"} className="text-xs">
                                    {product.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {product.trackInventory && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Inventory</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Current Stock</span>
                                    <span className={`font-medium ${Number(product.currentStock) <= Number(product.reorderPoint) ? "text-destructive" : ""}`}>
                                        {product.currentStock ?? 0}
                                    </span>
                                </div>
                                {product.reorderPoint != null && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Reorder Point</span>
                                        <span>{product.reorderPoint}</span>
                                    </div>
                                )}
                                {Number(product.currentStock) <= Number(product.reorderPoint) && (
                                    <p className="text-xs text-destructive">⚠ Stock at or below reorder point</p>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Description */}
                <div className="lg:col-span-2">
                    {product.description ? (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description}</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <p className="text-sm text-muted-foreground">No description added</p>
                                <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditOpen(true)}>
                                    Add Description
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
            <ProductModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                onSuccess={() => { setEditOpen(false); fetchProduct(); }}
                initialData={{
                    name: product.name,
                    sku: product.sku ?? "",
                    description: product.description ?? "",
                    type: product.type === "PRODUCT" ? "PRODUCT" : "SERVICE",
                    unitPrice: product.unitPrice ?? 0,
                    unit: product.unitOfMeasure ?? "unit",
                    vatTreatment: (product.vatTreatment === "STANDARD" ? "STANDARD_RATED" : product.vatTreatment) as "STANDARD_RATED" | "ZERO_RATED" | "EXEMPT" | "OUT_OF_SCOPE",
                    vatRate: (product.vatTreatment === "STANDARD" || product.vatTreatment === "STANDARD_RATED") ? 5 : 0,
                    category: product.category ?? "",
                    trackInventory: product.trackInventory ?? false,
                    isActive: product.isActive ?? true,
                }}
                id={product.id}
            />
        </div>
    );
}
