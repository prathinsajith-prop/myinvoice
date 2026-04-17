"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useOrgSettings, loadOrgSettings } from "@/lib/hooks/use-org-settings";
import { jsonFetcher } from "@/lib/fetcher";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DatePicker } from "@/components/ui/date-picker";

const lineItemSchema = z.object({
    description: z.string().min(1, "Description required"),
    quantity: z.coerce.number().positive("Must be > 0"),
    unitPrice: z.coerce.number().min(0),
    discountPercent: z.coerce.number().min(0).max(100).default(0),
    vatTreatment: z.string().default("STANDARD_RATED"),
});

const schema = z.object({
    supplierId: z.string().min(1, "Supplier required"),
    issueDate: z.string().min(1, "Issue date required"),
    expectedDate: z.string().optional().or(z.literal("")),
    reference: z.string().optional().or(z.literal("")),
    currency: z.string().min(1),
    notes: z.string().optional(),
    terms: z.string().optional(),
    shippingAddress: z.string().optional(),
    lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

type FormValues = z.infer<typeof schema>;
interface Supplier { id: string; name: string }

const VAT_RATES: Record<string, number> = {
    STANDARD_RATED: 0.05, EXEMPT: 0, ZERO_RATED: 0, OUT_OF_SCOPE: 0, REVERSE_CHARGE: 0,
};

function calcLine(qty: number, price: number, disc: number, vat: string) {
    const sub = qty * price;
    const discAmt = sub * (disc / 100);
    const taxable = sub - discAmt;
    const vatAmt = taxable * (VAT_RATES[vat] ?? 0.05);
    return { subtotal: sub, discountAmt: discAmt, vatAmt, lineTotal: taxable + vatAmt };
}

interface PurchaseOrderSheetProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (po: { id: string }) => void;
    purchaseOrderId?: string;
    defaultSupplierId?: string;
}

export function PurchaseOrderSheet({
    open,
    onClose,
    onSuccess,
    purchaseOrderId,
    defaultSupplierId,
}: PurchaseOrderSheetProps) {
    const { data: suppliersData } = useSWR(
        open ? "/api/suppliers?limit=200" : null,
        jsonFetcher<{ data: Supplier[] }>
    );
    const suppliers = suppliersData?.data ?? [];
    const [submitting, setSubmitting] = useState(false);
    const orgSettings = useOrgSettings();

    const today = new Date().toISOString().split("T")[0];

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        mode: "onChange",
        defaultValues: {
            supplierId: defaultSupplierId ?? "",
            issueDate: today,
            expectedDate: "",
            reference: "",
            currency: orgSettings.defaultCurrency,
            notes: "",
            terms: "",
            shippingAddress: "",
            lineItems: [{ description: "", quantity: 1, unitPrice: 0, discountPercent: 0, vatTreatment: "STANDARD_RATED" }],
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });
    const watchedItems = form.watch("lineItems");
    const currency = form.watch("currency");

    useEffect(() => {
        if (!open) return;
        if (purchaseOrderId) {
            fetch(`/api/purchase-orders/${purchaseOrderId}`)
                .then((r) => r.ok ? r.json() : null)
                .then((po) => {
                    if (po) {
                        form.reset({
                            supplierId: po.supplier.id,
                            issueDate: po.issueDate.split("T")[0],
                            expectedDate: po.expectedDate ? po.expectedDate.split("T")[0] : "",
                            reference: po.reference ?? "",
                            currency: po.currency,
                            notes: po.notes ?? "",
                            terms: po.terms ?? "",
                            shippingAddress: po.shippingAddress ?? "",
                            lineItems: po.lineItems.map((item: Record<string, unknown>) => ({
                                description: item.description,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                discountPercent: item.discount,
                                vatTreatment: item.vatTreatment,
                            })),
                        });
                    }
                });
        } else {
            loadOrgSettings().then((s) => {
                form.reset({
                    supplierId: defaultSupplierId ?? "",
                    issueDate: today,
                    expectedDate: "",
                    reference: "",
                    currency: s.defaultCurrency,
                    notes: "",
                    terms: "",
                    shippingAddress: "",
                    lineItems: [{ description: "", quantity: 1, unitPrice: 0, discountPercent: 0, vatTreatment: "STANDARD_RATED" }],
                });
            });
        }
    }, [open, purchaseOrderId]);

    const totals = watchedItems.reduce(
        (acc, item) => {
            const r = calcLine(Number(item.quantity) || 0, Number(item.unitPrice) || 0, Number(item.discountPercent) || 0, item.vatTreatment ?? "STANDARD_RATED");
            return {
                subtotal: acc.subtotal + r.subtotal,
                discount: acc.discount + r.discountAmt,
                vat: acc.vat + r.vatAmt,
                total: acc.total + r.lineTotal,
            };
        },
        { subtotal: 0, discount: 0, vat: 0, total: 0 }
    );

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const url = purchaseOrderId ? `/api/purchase-orders/${purchaseOrderId}` : "/api/purchase-orders";
            const method = purchaseOrderId ? "PATCH" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    supplierId: values.supplierId,
                    issueDate: values.issueDate,
                    expectedDate: values.expectedDate || null,
                    reference: values.reference || null,
                    currency: values.currency,
                    notes: values.notes || null,
                    terms: values.terms || null,
                    shippingAddress: values.shippingAddress || null,
                    lineItems: values.lineItems.map((item) => ({
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discountPercent,
                        vatTreatment: item.vatTreatment,
                        vatRate: VAT_RATES[item.vatTreatment] ? VAT_RATES[item.vatTreatment]! * 100 : 5,
                    })),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? `Failed to ${purchaseOrderId ? "update" : "create"} purchase order`);
            toast.success(`Purchase Order ${purchaseOrderId ? "updated" : "created"}`);
            onSuccess(data);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-3xl flex flex-col p-0"
                showCloseButton={false}
            >
                <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-lg">
                            {purchaseOrderId ? "Edit Purchase Order" : "New Purchase Order"}
                        </SheetTitle>
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </Button>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1">
                    <form id="po-sheet-form" onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-4 space-y-6">
                        {/* Details */}
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">PO Details</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="sm:col-span-2 space-y-1.5">
                                    <Label>Supplier <span className="text-destructive">*</span></Label>
                                    <Select
                                        value={form.watch("supplierId")}
                                        onValueChange={(v) => form.setValue("supplierId", v, { shouldValidate: true })}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger>
                                        <SelectContent>
                                            {suppliers.map((s) => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {form.formState.errors.supplierId && (
                                        <p className="text-xs text-destructive">{form.formState.errors.supplierId.message}</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Issue Date <span className="text-destructive">*</span></Label>
                                    <DatePicker
                                        value={form.watch("issueDate")}
                                        onChange={(v) => form.setValue("issueDate", v, { shouldValidate: true })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Expected Delivery Date</Label>
                                    <DatePicker
                                        value={form.watch("expectedDate") ?? ""}
                                        onChange={(v) => form.setValue("expectedDate", v)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Reference</Label>
                                    <Input placeholder="Your internal reference" {...form.register("reference")} />
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
                                <div className="sm:col-span-2 space-y-1.5">
                                    <Label>Shipping Address</Label>
                                    <Input placeholder="Delivery address" {...form.register("shippingAddress")} />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Line Items */}
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Items</p>
                            <div className="rounded-lg border divide-y">
                                {fields.map((field, index) => {
                                    const item = watchedItems[index] ?? {};
                                    const { vatAmt, lineTotal } = calcLine(
                                        Number(item.quantity) || 0,
                                        Number(item.unitPrice) || 0,
                                        Number(item.discountPercent) || 0,
                                        item.vatTreatment ?? "STANDARD_RATED"
                                    );
                                    return (
                                        <div key={field.id} className="p-3 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
                                                {fields.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                        onClick={() => remove(index)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                            <div>
                                                <Input
                                                    className="h-8 text-sm"
                                                    placeholder="Description *"
                                                    {...form.register(`lineItems.${index}.description`)}
                                                />
                                                {form.formState.errors.lineItems?.[index]?.description && (
                                                    <p className="text-xs text-destructive mt-1">
                                                        {form.formState.errors.lineItems[index]?.description?.message}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-muted-foreground">Qty</Label>
                                                    <Input
                                                        className="h-8 text-sm"
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="0"
                                                        {...form.register(`lineItems.${index}.quantity`, {
                                                            setValueAs: (v) => v === "" ? 0 : parseFloat(v) || 0,
                                                        })}
                                                        onKeyDown={(e) => {
                                                            if (!/[\d.]/.test(e.key) && !["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-muted-foreground">Unit Price</Label>
                                                    <Input
                                                        className="h-8 text-sm"
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="0.00"
                                                        {...form.register(`lineItems.${index}.unitPrice`, {
                                                            setValueAs: (v) => v === "" ? 0 : parseFloat(v) || 0,
                                                        })}
                                                        onKeyDown={(e) => {
                                                            if (!/[\d.]/.test(e.key) && !["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-muted-foreground">Disc %</Label>
                                                    <Input
                                                        className="h-8 text-sm"
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="0"
                                                        {...form.register(`lineItems.${index}.discountPercent`, {
                                                            setValueAs: (v) => v === "" ? 0 : parseFloat(v) || 0,
                                                        })}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-muted-foreground">VAT</Label>
                                                    <Select
                                                        value={form.watch(`lineItems.${index}.vatTreatment`)}
                                                        onValueChange={(v) => form.setValue(`lineItems.${index}.vatTreatment`, v)}
                                                    >
                                                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="STANDARD_RATED">5%</SelectItem>
                                                            <SelectItem value="ZERO_RATED">0% Zero</SelectItem>
                                                            <SelectItem value="EXEMPT">Exempt</SelectItem>
                                                            <SelectItem value="OUT_OF_SCOPE">Out of Scope</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-4 text-xs text-muted-foreground">
                                                <span>VAT: {currency} {vatAmt.toFixed(2)}</span>
                                                <span className="font-medium text-foreground">Total: {currency} {lineTotal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-3 w-full"
                                onClick={() => append({ description: "", quantity: 1, unitPrice: 0, discountPercent: 0, vatTreatment: "STANDARD_RATED" })}
                            >
                                <Plus className="h-3.5 w-3.5 mr-1.5" />
                                Add Item
                            </Button>
                        </div>

                        {/* Totals */}
                        <div className="rounded-lg bg-muted/50 border p-4 space-y-2 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                                <span>Subtotal</span>
                                <span>{currency} {totals.subtotal.toFixed(2)}</span>
                            </div>
                            {totals.discount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Discount</span>
                                    <span>- {currency} {totals.discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-muted-foreground">
                                <span>VAT</span>
                                <span>{currency} {totals.vat.toFixed(2)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-semibold text-base">
                                <span>Total</span>
                                <span>{currency} {totals.total.toFixed(2)}</span>
                            </div>
                        </div>

                        <Separator />

                        {/* Additional Info */}
                        <div className="space-y-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Additional Information</p>
                            <div className="space-y-1.5">
                                <Label>Notes</Label>
                                <Textarea className="h-20 resize-none" placeholder="Notes visible to supplier..." {...form.register("notes")} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Terms &amp; Conditions</Label>
                                <Textarea className="h-20 resize-none" placeholder="Payment and delivery terms..." {...form.register("terms")} />
                            </div>
                        </div>
                    </form>
                </ScrollArea>

                <SheetFooter className="px-6 py-4 border-t bg-background shrink-0 flex gap-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button type="submit" form="po-sheet-form" disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {purchaseOrderId ? "Update" : "Create Purchase Order"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
