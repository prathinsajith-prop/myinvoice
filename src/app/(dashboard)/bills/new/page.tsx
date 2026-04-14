"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const lineItemSchema = z.object({
    description: z.string().min(1, "Description required"),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().min(0),
    discountPercent: z.coerce.number().min(0).max(100).default(0),
    vatTreatment: z.string().default("STANDARD"),
});

const schema = z.object({
    supplierId: z.string().min(1, "Supplier required"),
    billDate: z.string().min(1),
    dueDate: z.string().min(1),
    supplierReference: z.string().optional(),
    currency: z.string().default("AED"),
    notes: z.string().optional(),
    lineItems: z.array(lineItemSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

interface Supplier { id: string; name: string }

const VAT_RATES: Record<string, number> = { STANDARD: 0.05, EXEMPT: 0, ZERO_RATED: 0, OUT_OF_SCOPE: 0 };

export default function NewBillPage() {
    const router = useRouter();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const today = new Date().toISOString().split("T")[0];
    const plus30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: {
            supplierId: "",
            billDate: today,
            dueDate: plus30,
            supplierReference: "",
            currency: "AED",
            notes: "",
            lineItems: [{ description: "", quantity: 1, unitPrice: 0, discountPercent: 0, vatTreatment: "STANDARD" }],
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });
    const watchedItems = form.watch("lineItems");

    const fetchSuppliers = useCallback(async () => {
        const res = await fetch("/api/suppliers?limit=200");
        if (res.ok) setSuppliers((await res.json()).data ?? []);
    }, []);

    useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

    const totals = watchedItems.reduce(
        (acc, item) => {
            const sub = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
            const discAmt = sub * ((Number(item.discountPercent) || 0) / 100);
            const taxable = sub - discAmt;
            const vatAmt = taxable * (VAT_RATES[item.vatTreatment ?? "STANDARD"] ?? 0.05);
            return { subtotal: acc.subtotal + sub, discount: acc.discount + discAmt, vat: acc.vat + vatAmt, total: acc.total + taxable + vatAmt };
        },
        { subtotal: 0, discount: 0, vat: 0, total: 0 },
    );

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const res = await fetch("/api/bills", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to create bill");
            toast.success("Bill created");
            router.push(`/bills/${data.id}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/bills"><ChevronLeft className="h-5 w-5" /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">New Bill</h1>
                    <p className="text-muted-foreground">Record a supplier bill (payable)</p>
                </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Bill Details</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2 space-y-1.5">
                            <Label>Supplier <span className="text-destructive">*</span></Label>
                            <Select
                                value={form.watch("supplierId")}
                                onValueChange={(v) => form.setValue("supplierId", v, { shouldValidate: true })}
                            >
                                <SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger>
                                <SelectContent>
                                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {form.formState.errors.supplierId && (
                                <p className="text-xs text-destructive">{form.formState.errors.supplierId.message}</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Bill Date</Label>
                            <Input type="date" {...form.register("billDate")} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Due Date</Label>
                            <Input type="date" {...form.register("dueDate")} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Supplier Reference</Label>
                            <Input placeholder="Supplier's invoice number..." {...form.register("supplierReference")} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Currency</Label>
                            <Select value={form.watch("currency")} onValueChange={(v) => form.setValue("currency", v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                                    <SelectItem value="GBP">GBP — British Pound</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Line Items</CardTitle>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append({ description: "", quantity: 1, unitPrice: 0, discountPercent: 0, vatTreatment: "STANDARD" })}
                        >
                            <Plus className="mr-2 h-4 w-4" />Add Line
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {fields.map((field, index) => {
                            const item = watchedItems[index] ?? {};
                            const sub = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                            const disc = sub * ((Number(item.discountPercent) || 0) / 100);
                            const taxable = sub - disc;
                            const vatAmt = taxable * (VAT_RATES[item.vatTreatment ?? "STANDARD"] ?? 0.05);
                            const lineTotal = taxable + vatAmt;
                            return (
                                <div key={field.id} className="space-y-3 rounded-lg border p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                                        {fields.length > 1 && (
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <Label className="text-xs">Description <span className="text-destructive">*</span></Label>
                                            <Input placeholder="Description" {...form.register(`lineItems.${index}.description`)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Quantity</Label>
                                            <Input type="number" min="0" step="0.001" {...form.register(`lineItems.${index}.quantity`)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Unit Price (AED)</Label>
                                            <Input type="number" min="0" step="0.01" {...form.register(`lineItems.${index}.unitPrice`)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Discount %</Label>
                                            <Input type="number" min="0" max="100" step="0.01" {...form.register(`lineItems.${index}.discountPercent`)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">VAT Treatment</Label>
                                            <Select
                                                value={form.watch(`lineItems.${index}.vatTreatment`)}
                                                onValueChange={(v) => form.setValue(`lineItems.${index}.vatTreatment`, v)}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="STANDARD">Standard (5%)</SelectItem>
                                                    <SelectItem value="ZERO_RATED">Zero Rated (0%)</SelectItem>
                                                    <SelectItem value="EXEMPT">Exempt</SelectItem>
                                                    <SelectItem value="OUT_OF_SCOPE">Out of Scope</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-4 pt-1 text-sm text-muted-foreground">
                                        <span>VAT: AED {vatAmt.toFixed(2)}</span>
                                        <span className="font-medium text-foreground">Total: AED {lineTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                        <CardContent>
                            <Textarea placeholder="Internal notes..." rows={4} {...form.register("notes")} />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Bill Summary</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>AED {totals.subtotal.toFixed(2)}</span>
                            </div>
                            {totals.discount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Discount</span>
                                    <span className="text-green-600">− AED {totals.discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">VAT</span>
                                <span>AED {totals.vat.toFixed(2)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-semibold">
                                <span>Total</span>
                                <span>AED {totals.total.toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex items-center justify-end gap-3">
                    <Button type="button" variant="outline" asChild>
                        <Link href="/bills">Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Bill
                    </Button>
                </div>
            </form>
        </div>
    );
}
