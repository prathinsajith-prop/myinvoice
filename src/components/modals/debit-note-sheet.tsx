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

const VAT_TREATMENT = ["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE", "REVERSE_CHARGE"] as const;

const lineItemSchema = z.object({
    productId: z.string().optional(),
    description: z.string().min(1, "Description required"),
    quantity: z.coerce.number().positive("Must be > 0"),
    unitPrice: z.coerce.number().min(0),
    vatTreatment: z.enum(VAT_TREATMENT).default("STANDARD_RATED"),
    vatRate: z.coerce.number().min(0).max(100).default(5),
});

const schema = z.object({
    customerId: z.string().min(1, "Customer required"),
    invoiceId: z.string().min(1, "Invoice required"),
    reason: z.string().min(1, "Reason required"),
    issueDate: z.string().min(1),
    currency: z.string().min(1),
    sellerTrn: z.string().optional(),
    buyerTrn: z.string().optional(),
    notes: z.string().optional(),
    lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

type FormValues = z.infer<typeof schema>;
interface Customer { id: string; name: string }
interface Invoice { id: string; invoiceNumber: string; status: string }
interface Product { id: string; name: string; unitPrice: number; vatTreatment: string }

const VAT_RATES: Record<string, number> = { STANDARD_RATED: 0.05, REVERSE_CHARGE: 0.05, EXEMPT: 0, ZERO_RATED: 0, OUT_OF_SCOPE: 0 };

function calcLine(qty: number, price: number, vat: string) {
    const taxable = qty * price;
    const vatAmt = taxable * (VAT_RATES[vat] ?? 0.05);
    return { taxable, vatAmt, lineTotal: taxable + vatAmt };
}

interface DebitNoteSheetProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (note: { id: string }) => void;
    defaultCustomerId?: string;
    defaultInvoiceId?: string;
}

export function DebitNoteSheet({ open, onClose, onSuccess, defaultCustomerId, defaultInvoiceId }: DebitNoteSheetProps) {
    const { data: customersData } = useSWR(
        open ? "/api/customers?limit=200" : null,
        jsonFetcher<{ data: Customer[] }>
    );
    const { data: productsData } = useSWR(
        open ? "/api/products?limit=200" : null,
        jsonFetcher<{ data: Product[] }>
    );
    const customers = customersData?.data ?? [];
    const products = productsData?.data ?? [];
    const [submitting, setSubmitting] = useState(false);
    const orgSettings = useOrgSettings();

    const today = new Date().toISOString().split("T")[0];

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        mode: "onChange",
        defaultValues: {
            customerId: defaultCustomerId ?? "",
            invoiceId: defaultInvoiceId ?? "",
            reason: "",
            issueDate: today,
            currency: orgSettings.defaultCurrency,
            sellerTrn: "",
            buyerTrn: "",
            notes: "",
            lineItems: [{ description: "", quantity: 1, unitPrice: 0, vatTreatment: "STANDARD_RATED", vatRate: 5 }],
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });
    const watchedItems = form.watch("lineItems");
    const currency = form.watch("currency");
    const watchedCustomerId = form.watch("customerId");

    const { data: customerInvoicesData } = useSWR(
        watchedCustomerId ? `/api/invoices?customerId=${watchedCustomerId}&limit=100` : null,
        jsonFetcher<{ data: Invoice[] }>
    );
    const customerInvoices = (customerInvoicesData?.data ?? []).filter((inv) => inv.status !== "VOID");

    useEffect(() => {
        if (open) {
            loadOrgSettings().then((s) => {
                form.reset({
                    customerId: defaultCustomerId ?? "",
                    invoiceId: defaultInvoiceId ?? "",
                    reason: "",
                    issueDate: today,
                    currency: s.defaultCurrency,
                    sellerTrn: "",
                    buyerTrn: "",
                    notes: "",
                    lineItems: [{ description: "", quantity: 1, unitPrice: 0, vatTreatment: "STANDARD_RATED", vatRate: 5 }],
                });
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const totals = watchedItems.reduce(
        (acc, item) => {
            const r = calcLine(Number(item.quantity) || 0, Number(item.unitPrice) || 0, item.vatTreatment ?? "STANDARD_RATED");
            return { taxable: acc.taxable + r.taxable, vat: acc.vat + r.vatAmt, total: acc.total + r.lineTotal };
        },
        { taxable: 0, vat: 0, total: 0 }
    );

    function applyProduct(index: number, productId: string) {
        const p = products.find((x) => x.id === productId);
        if (!p) return;
        const vat = (VAT_TREATMENT.includes(p.vatTreatment as typeof VAT_TREATMENT[number]) ? p.vatTreatment : "STANDARD_RATED") as typeof VAT_TREATMENT[number];
        form.setValue(`lineItems.${index}.productId`, productId);
        form.setValue(`lineItems.${index}.description`, p.name);
        form.setValue(`lineItems.${index}.unitPrice`, p.unitPrice);
        form.setValue(`lineItems.${index}.vatTreatment`, vat);
        form.setValue(`lineItems.${index}.vatRate`, vat === "STANDARD_RATED" || vat === "REVERSE_CHARGE" ? 5 : 0);
    }

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const res = await fetch("/api/debit-notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...values,
                    sellerTrn: values.sellerTrn || null,
                    buyerTrn: values.buyerTrn || null,
                    notes: values.notes || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to create debit note");
            toast.success("Debit note created");
            onSuccess(data);
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col p-0" showCloseButton={false}>
                <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-lg">New Debit Note</SheetTitle>
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </Button>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1">
                    <form id="debit-note-sheet-form" onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-4 space-y-6">
                        {/* Details */}
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Debit Note Details</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Customer <span className="text-destructive">*</span></Label>
                                    <Select
                                        value={form.watch("customerId")}
                                        onValueChange={(v) => {
                                            form.setValue("customerId", v, { shouldValidate: true });
                                            form.setValue("invoiceId", "");
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                                        <SelectContent>
                                            {customers.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {form.formState.errors.customerId && (
                                        <p className="text-xs text-destructive">{form.formState.errors.customerId.message}</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Linked Invoice <span className="text-destructive">*</span></Label>
                                    <Select
                                        value={form.watch("invoiceId")}
                                        onValueChange={(v) => form.setValue("invoiceId", v, { shouldValidate: true })}
                                        disabled={!watchedCustomerId}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={watchedCustomerId ? "Select invoice..." : "Select customer first"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customerInvoices.length === 0
                                                ? <SelectItem value="_none" disabled>No invoices found</SelectItem>
                                                : customerInvoices.map((inv) => (
                                                    <SelectItem key={inv.id} value={inv.id}>{inv.invoiceNumber}</SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                    {form.formState.errors.invoiceId && (
                                        <p className="text-xs text-destructive">{form.formState.errors.invoiceId.message}</p>
                                    )}
                                </div>
                                <div className="sm:col-span-2 space-y-1.5">
                                    <Label>Reason <span className="text-destructive">*</span></Label>
                                    <Textarea placeholder="Reason for debit note..." rows={2} {...form.register("reason")} />
                                    {form.formState.errors.reason && (
                                        <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Issue Date</Label>
                                    <DatePicker value={form.watch("issueDate")} onChange={(v) => form.setValue("issueDate", v)} />
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
                                <div className="space-y-1.5">
                                    <Label>Seller TRN</Label>
                                    <Input placeholder="Your TRN..." {...form.register("sellerTrn")} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Buyer TRN</Label>
                                    <Input placeholder="Customer TRN..." {...form.register("buyerTrn")} />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Line Items */}
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Line Items</p>
                            <div className="rounded-lg border divide-y">
                                {fields.map((field, index) => {
                                    const item = watchedItems[index] ?? {};
                                    const { vatAmt, lineTotal } = calcLine(Number(item.quantity) || 0, Number(item.unitPrice) || 0, item.vatTreatment ?? "STANDARD_RATED");
                                    return (
                                        <div key={field.id} className="p-3 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
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
                                                        <p className="text-xs text-destructive mt-1">{form.formState.errors.lineItems[index]?.description?.message}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-muted-foreground">Qty</Label>
                                                    <Input className="h-8 text-sm" type="text" inputMode="decimal" placeholder="0" {...form.register(`lineItems.${index}.quantity`, { setValueAs: (v) => v === '' ? 0 : parseFloat(v) || 0 })} onKeyDown={(e) => { if (!/[\d.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-muted-foreground">Price ({currency})</Label>
                                                    <Input className="h-8 text-sm" type="text" inputMode="decimal" placeholder="0.00" {...form.register(`lineItems.${index}.unitPrice`, { setValueAs: (v) => v === '' ? 0 : parseFloat(v) || 0 })} onKeyDown={(e) => { if (!/[\d.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-muted-foreground">VAT</Label>
                                                    <Select
                                                        value={form.watch(`lineItems.${index}.vatTreatment`)}
                                                        onValueChange={(v) => {
                                                            form.setValue(`lineItems.${index}.vatTreatment`, v as typeof VAT_TREATMENT[number]);
                                                            form.setValue(`lineItems.${index}.vatRate`, v === "STANDARD_RATED" || v === "REVERSE_CHARGE" ? 5 : 0);
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="STANDARD_RATED">Std 5%</SelectItem>
                                                            <SelectItem value="ZERO_RATED">0%</SelectItem>
                                                            <SelectItem value="EXEMPT">Exempt</SelectItem>
                                                            <SelectItem value="OUT_OF_SCOPE">OOS</SelectItem>
                                                            <SelectItem value="REVERSE_CHARGE">Reverse</SelectItem>
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
                                onClick={() => append({ description: "", quantity: 1, unitPrice: 0, vatTreatment: "STANDARD_RATED", vatRate: 5 })}
                            >
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Line Item
                            </Button>
                        </div>

                        <Separator />

                        {/* Totals */}
                        <div className="rounded-lg bg-muted/40 p-4 space-y-2 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                                <span>Taxable Amount</span><span>{currency} {totals.taxable.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span>VAT</span><span>{currency} {totals.vat.toFixed(2)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-semibold text-base">
                                <span>Total</span><span>{currency} {totals.total.toFixed(2)}</span>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-1.5">
                            <Label className="text-xs">Notes</Label>
                            <Textarea placeholder="Internal notes..." rows={3} {...form.register("notes")} />
                        </div>
                    </form>
                </ScrollArea>

                <SheetFooter className="px-6 py-4 border-t gap-2 shrink-0">
                    <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
                    <Button type="submit" form="debit-note-sheet-form" disabled={submitting} className="flex-1 sm:flex-none">
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Debit Note
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
