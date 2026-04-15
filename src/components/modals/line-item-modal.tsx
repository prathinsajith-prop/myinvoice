"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const VAT_RATES: Record<string, number> = {
    STANDARD_RATED: 0.05,
    ZERO_RATED: 0,
    EXEMPT: 0,
    REVERSE_CHARGE: 0.05,
    OUT_OF_SCOPE: 0,
};

const schema = z.object({
    description: z.string().min(1, "Description required"),
    quantity: z.coerce.number().positive("Must be > 0"),
    unitPrice: z.coerce.number().min(0, "Must be ≥ 0"),
    discount: z.coerce.number().min(0).max(100).default(0),
    vatTreatment: z.string().default("STANDARD_RATED"),
    productId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Product {
    id: string;
    name: string;
    description: string;
    unitPrice: number;
    vatTreatment: string;
}

export interface LineItemData {
    id?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    vatTreatment: string;
    vatAmount: number;
    total: number;
    productId?: string | null;
}

interface LineItemModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: FormValues & { id?: string }) => Promise<void>;
    lineItem?: LineItemData | null;
    currency: string;
}

export function LineItemModal({ open, onClose, onSave, lineItem, currency }: LineItemModalProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: {
            description: "",
            quantity: 1,
            unitPrice: 0,
            discount: 0,
            vatTreatment: "STANDARD_RATED",
            productId: "",
        },
    });

    const watched = form.watch();

    const fetchProducts = useCallback(async () => {
        try {
            const res = await fetch("/api/products?limit=200");
            if (res.ok) setProducts((await res.json()).data ?? []);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        if (open) {
            fetchProducts();
            if (lineItem) {
                form.reset({
                    description: lineItem.description,
                    quantity: Number(lineItem.quantity),
                    unitPrice: Number(lineItem.unitPrice),
                    discount: Number(lineItem.discount),
                    vatTreatment: lineItem.vatTreatment,
                    productId: lineItem.productId ?? "",
                });
            } else {
                form.reset({
                    description: "",
                    quantity: 1,
                    unitPrice: 0,
                    discount: 0,
                    vatTreatment: "STANDARD_RATED",
                    productId: "",
                });
            }
        }
    }, [open, lineItem, form, fetchProducts]);

    function calcPreview() {
        const qty = watched.quantity || 0;
        const price = watched.unitPrice || 0;
        const disc = watched.discount || 0;
        const vatKey = watched.vatTreatment || "STANDARD_RATED";
        const sub = qty * price;
        const discAmt = sub * (disc / 100);
        const taxable = sub - discAmt;
        const vatAmt = taxable * (VAT_RATES[vatKey] ?? 0.05);
        return { subtotal: sub, discountAmt: discAmt, taxable, vatAmt, total: taxable + vatAmt };
    }

    const preview = calcPreview();

    function handleProductSelect(productId: string) {
        form.setValue("productId", productId);
        const product = products.find((p) => p.id === productId);
        if (product) {
            form.setValue("description", product.description || product.name);
            form.setValue("unitPrice", Number(product.unitPrice));
            if (product.vatTreatment) form.setValue("vatTreatment", product.vatTreatment);
        }
    }

    async function handleSubmit(data: FormValues) {
        setSubmitting(true);
        try {
            await onSave({ ...data, id: lineItem?.id });
            onClose();
        } catch {
            // errors handled by parent
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{lineItem ? "Edit Line Item" : "Add Line Item"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    {/* Product selector */}
                    {products.length > 0 && (
                        <div className="space-y-1.5">
                            <Label>Product (optional)</Label>
                            <Select value={watched.productId || ""} onValueChange={handleProductSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a product..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label>Description *</Label>
                        <Textarea
                            {...form.register("description")}
                            rows={2}
                            placeholder="Item description"
                        />
                        {form.formState.errors.description && (
                            <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                        )}
                    </div>

                    {/* Qty / Price / Discount row */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label>Quantity *</Label>
                            <Input type="text" {...form.register("quantity")} />
                            {form.formState.errors.quantity && (
                                <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Unit Price *</Label>
                            <Input type="text" {...form.register("unitPrice")} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Discount %</Label>
                            <Input type="text" {...form.register("discount")} />
                        </div>
                    </div>

                    {/* VAT Treatment */}
                    <div className="space-y-1.5">
                        <Label>VAT Treatment</Label>
                        <Select value={watched.vatTreatment} onValueChange={(v) => form.setValue("vatTreatment", v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="STANDARD_RATED">Standard Rated (5%)</SelectItem>
                                <SelectItem value="ZERO_RATED">Zero Rated (0%)</SelectItem>
                                <SelectItem value="EXEMPT">Exempt</SelectItem>
                                <SelectItem value="REVERSE_CHARGE">Reverse Charge</SelectItem>
                                <SelectItem value="OUT_OF_SCOPE">Out of Scope</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Preview */}
                    <div className="rounded-md border bg-muted/50 p-3 space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="tabular-nums">{currency} {preview.subtotal.toFixed(2)}</span>
                        </div>
                        {preview.discountAmt > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Discount</span>
                                <span className="tabular-nums text-green-600">− {currency} {preview.discountAmt.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">VAT</span>
                            <span className="tabular-nums">{currency} {preview.vatAmt.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                            <span>Line Total</span>
                            <span className="tabular-nums">{currency} {preview.total.toFixed(2)}</span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {lineItem ? "Update" : "Add"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
