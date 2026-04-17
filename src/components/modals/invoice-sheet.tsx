"use client";

import { useEffect, useState, useCallback } from "react";
import { useOrgSettings, loadOrgSettings } from "@/lib/hooks/use-org-settings";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Loader2, X, UserPlus } from "lucide-react";
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
import { CustomerModal } from "@/components/modals/customer-modal";

const lineItemSchema = z.object({
    description: z.string().min(1, "Description required"),
    quantity: z.coerce.number().positive("Must be > 0"),
    unitPrice: z.coerce.number().min(0),
    discountPercent: z.coerce.number().min(0).max(100).default(0),
    vatTreatment: z.string().default("STANDARD_RATED"),
    productId: z.string().optional(),
});

const schema = z.object({
    customerId: z.string().min(1, "Customer required"),
    issueDate: z.string().min(1, "Issue date required"),
    dueDate: z.string().min(1, "Due date required"),
    currency: z.string().min(1),
    notes: z.string().optional(),
    termsAndConditions: z.string().optional(),
    lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

type FormValues = z.infer<typeof schema>;
interface Customer { id: string; name: string }
interface Product { id: string; name: string; description: string; unitPrice: number; vatTreatment: string }

const VAT_RATES: Record<string, number> = { STANDARD_RATED: 0.05, REVERSE_CHARGE: 0.05, EXEMPT: 0, ZERO_RATED: 0, OUT_OF_SCOPE: 0 };

function calcLine(qty: number, price: number, disc: number, vat: string) {
    const sub = qty * price;
    const discAmt = sub * (disc / 100);
    const taxable = sub - discAmt;
    const vatAmt = taxable * (VAT_RATES[vat] ?? 0.05);
    return { subtotal: sub, discountAmt: discAmt, taxable, vatAmt, lineTotal: taxable + vatAmt };
}

interface InvoiceSheetProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (invoice: { id: string }) => void;
    defaultCustomerId?: string;
}

export function InvoiceSheet({ open, onClose, onSuccess, defaultCustomerId }: InvoiceSheetProps) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [customerModalOpen, setCustomerModalOpen] = useState(false);
    const orgSettings = useOrgSettings();

    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date(Date.now() + orgSettings.defaultDueDateDays * 86400000).toISOString().split("T")[0];

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        mode: "onChange",
        defaultValues: {
            customerId: defaultCustomerId ?? "",
            issueDate: today,
            dueDate,
            currency: orgSettings.defaultCurrency,
            notes: orgSettings.defaultNotes,
            termsAndConditions: orgSettings.defaultTerms,
            lineItems: [{ description: "", quantity: 1, unitPrice: 0, discountPercent: 0, vatTreatment: "STANDARD_RATED" }],
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });
    const watchedItems = form.watch("lineItems");
    const currency = form.watch("currency");

    const fetchData = useCallback(async () => {
        const [c, p] = await Promise.all([
            fetch("/api/customers?limit=200"),
            fetch("/api/products?limit=200"),
        ]);
        if (c.ok) setCustomers((await c.json()).data ?? []);
        if (p.ok) setProducts((await p.json()).data ?? []);
    }, []);

    useEffect(() => {
        if (open) {
            fetchData();
            loadOrgSettings().then((s) => {
                const due = new Date(Date.now() + s.defaultDueDateDays * 86400000).toISOString().split("T")[0];
                form.reset({
                    customerId: defaultCustomerId ?? "",
                    issueDate: today,
                    dueDate: due,
                    currency: s.defaultCurrency,
                    notes: s.defaultNotes,
                    termsAndConditions: s.defaultTerms,
                    lineItems: [{ description: "", quantity: 1, unitPrice: 0, discountPercent: 0, vatTreatment: "STANDARD_RATED" }],
                });
            });
        }
         
    }, [open]);

    const totals = watchedItems.reduce(
        (acc, item) => {
            const r = calcLine(Number(item.quantity) || 0, Number(item.unitPrice) || 0, Number(item.discountPercent) || 0, item.vatTreatment ?? "STANDARD_RATED");
            return { subtotal: acc.subtotal + r.subtotal, discount: acc.discount + r.discountAmt, taxable: acc.taxable + r.taxable, vat: acc.vat + r.vatAmt, total: acc.total + r.lineTotal };
        },
        { subtotal: 0, discount: 0, taxable: 0, vat: 0, total: 0 }
    );

    function applyProduct(index: number, productId: string) {
        const p = products.find((x) => x.id === productId);
        if (!p) return;
        form.setValue(`lineItems.${index}.productId`, productId);
        form.setValue(`lineItems.${index}.description`, p.name);
        form.setValue(`lineItems.${index}.unitPrice`, p.unitPrice);
        form.setValue(`lineItems.${index}.vatTreatment`, p.vatTreatment ?? "STANDARD_RATED");
    }

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const res = await fetch("/api/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (!res.ok) {
                // Propagate server-side field errors into the form
                const fieldErrors: Record<string, string[]> = data?.details?.fieldErrors ?? {};
                let hasFieldError = false;
                for (const [key, msgs] of Object.entries(fieldErrors)) {
                    const message = Array.isArray(msgs) ? msgs[0] : String(msgs);
                    // Map API field names back to frontend schema names
                    const frontendKey = key.replace(/\.discount\b/, ".discountPercent").replace(
                        /lineItems\.(\d+)\./,
                        (_, i) => `lineItems.${i}.`
                    ) as Parameters<typeof form.setError>[0];
                    form.setError(frontendKey as never, { message });
                    hasFieldError = true;
                }
                if (!hasFieldError) {
                    toast.error(data.error ?? "Failed to create invoice");
                }
                return;
            }
            toast.success("Invoice created");
            onSuccess(data);
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
                <SheetContent
                    side="right"
                    className="w-full sm:max-w-3xl flex flex-col p-0"
                    showCloseButton={false}
                >
                    <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                        <div className="flex items-center justify-between">
                            <SheetTitle className="text-lg">New Invoice</SheetTitle>
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                                <X className="h-4 w-4" />
                                <span className="sr-only">Close</span>
                            </Button>
                        </div>
                    </SheetHeader>

                    <ScrollArea className="flex-1">
                        <form id="invoice-sheet-form" onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-4 space-y-6">
                            {/* Invoice Details */}
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Invoice Details</p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="sm:col-span-2 space-y-1.5">
                                        <Label>Customer <span className="text-destructive">*</span></Label>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <Select value={form.watch("customerId")} onValueChange={(v) => form.setValue("customerId", v, { shouldValidate: true })}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select customer..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {customers.map((c) => (
                                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="shrink-0"
                                                onClick={() => setCustomerModalOpen(true)}
                                            >
                                                <UserPlus className="h-4 w-4" />
                                                <span className="sr-only">New Customer</span>
                                            </Button>
                                        </div>
                                        {form.formState.errors.customerId && (
                                            <p className="text-xs text-destructive">{form.formState.errors.customerId.message}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Issue Date <span className="text-destructive">*</span></Label>
                                        <DatePicker value={form.watch("issueDate")} onChange={(v) => form.setValue("issueDate", v, { shouldValidate: true })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Due Date <span className="text-destructive">*</span></Label>
                                        <DatePicker value={form.watch("dueDate")} onChange={(v) => form.setValue("dueDate", v, { shouldValidate: true })} />
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
                                                <SelectItem value="SAR">SAR — Saudi Riyal</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Line Items */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Line Items</p>
                                </div>
                                {form.formState.errors.lineItems?.root && (
                                    <p className="text-xs text-destructive mb-2">{form.formState.errors.lineItems.root.message}</p>
                                )}

                                <div className="rounded-lg border divide-y">
                                    {fields.map((field, index) => {
                                        const item = watchedItems[index] ?? {};
                                        const { vatAmt, lineTotal } = calcLine(Number(item.quantity) || 0, Number(item.unitPrice) || 0, Number(item.discountPercent) || 0, item.vatTreatment ?? "STANDARD_RATED");
                                        return (
                                            <div key={field.id} className="p-3 space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-muted-foreground">Line</span>
                                                    {fields.length > 1 && (
                                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => remove(index)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    <Select onValueChange={(v) => applyProduct(index, v)}>
                                                        <SelectTrigger className="h-8 text-xs">
                                                            <SelectValue placeholder="Auto-fill from catalog..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {products.map((p) => (
                                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <div>
                                                        <Input className="h-8 text-sm" placeholder="Description *" {...form.register(`lineItems.${index}.description`)} />
                                                        {form.formState.errors.lineItems?.[index]?.description && (
                                                            <p className="text-[10px] text-destructive mt-0.5">{form.formState.errors.lineItems[index]?.description?.message}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px] text-muted-foreground">Qty</Label>
                                                        <Input className="h-8 text-sm" type="text" inputMode="decimal" placeholder="0" {...form.register(`lineItems.${index}.quantity`, { setValueAs: (v) => v === "" ? 0 : parseFloat(v) || 0 })} onKeyDown={(e) => { if (!/[\d.]/.test(e.key) && !["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px] text-muted-foreground">Price ({currency})</Label>
                                                        <Input className="h-8 text-sm" type="text" inputMode="decimal" placeholder="0.00" {...form.register(`lineItems.${index}.unitPrice`, { setValueAs: (v) => v === "" ? 0 : parseFloat(v) || 0 })} onKeyDown={(e) => { if (!/[\d.]/.test(e.key) && !["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px] text-muted-foreground">Disc %</Label>
                                                        <Input className="h-8 text-sm" type="text" inputMode="decimal" placeholder="0" {...form.register(`lineItems.${index}.discountPercent`, { setValueAs: (v) => v === "" ? 0 : parseFloat(v) || 0 })} onKeyDown={(e) => { if (!/[\d.]/.test(e.key) && !["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px] text-muted-foreground">VAT</Label>
                                                        <Select value={form.watch(`lineItems.${index}.vatTreatment`)} onValueChange={(v) => form.setValue(`lineItems.${index}.vatTreatment`, v)}>
                                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="STANDARD_RATED">Std 5%</SelectItem>
                                                                <SelectItem value="ZERO_RATED">0%</SelectItem>
                                                                <SelectItem value="EXEMPT">Exempt</SelectItem>
                                                                <SelectItem value="REVERSE_CHARGE">Rev. Charge</SelectItem>
                                                                <SelectItem value="OUT_OF_SCOPE">OOS</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-4 text-xs text-muted-foreground pt-0.5">
                                                    <span>VAT: {currency} {vatAmt.toFixed(2)}</span>
                                                    <span className="font-medium text-foreground">Total: {currency} {lineTotal.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2 w-full border border-dashed text-muted-foreground hover:text-foreground"
                                    onClick={() => append({ description: "", quantity: 1, unitPrice: 0, discountPercent: 0, vatTreatment: "STANDARD_RATED" })}
                                >
                                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Line Item
                                </Button>
                            </div>

                            <Separator />

                            {/* Totals */}
                            <div className="rounded-lg bg-muted/40 p-4 space-y-2 text-sm">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal</span><span>{currency} {totals.subtotal.toFixed(2)}</span>
                                </div>
                                {totals.discount > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Discount</span><span className="text-green-600">− {currency} {totals.discount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-muted-foreground">
                                    <span>VAT</span><span>{currency} {totals.vat.toFixed(2)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-semibold text-base">
                                    <span>Total</span><span>{currency} {totals.total.toFixed(2)}</span>
                                </div>
                            </div>

                            <Separator />

                            {/* Notes */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Notes</Label>
                                    <Textarea placeholder="Notes to customer..." rows={3} {...form.register("notes")} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Terms & Conditions</Label>
                                    <Textarea placeholder="Payment terms..." rows={3} {...form.register("termsAndConditions")} />
                                </div>
                            </div>
                        </form >
                    </ScrollArea >

                    <SheetFooter className="px-6 py-4 border-t gap-2 shrink-0">
                        <Button variant="outline" onClick={onClose} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" form="invoice-sheet-form" disabled={submitting} className="flex-1 sm:flex-none">
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Invoice
                        </Button>
                    </SheetFooter>
                </SheetContent >
            </Sheet >
            <CustomerModal
                open={customerModalOpen}
                onClose={() => setCustomerModalOpen(false)}
                onSuccess={(customer) => {
                    setCustomers((prev) => [...prev, customer]);
                    form.setValue("customerId", customer.id, { shouldValidate: true });
                    setCustomerModalOpen(false);
                }}
            />
        </>
    );
}
