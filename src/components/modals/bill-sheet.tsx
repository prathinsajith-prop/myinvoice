"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useOrgSettings, loadOrgSettings } from "@/lib/hooks/use-org-settings";
import { jsonFetcher } from "@/lib/fetcher";
import { calcLine, reduceTotals, DEFAULT_LINE_ITEM, lineItemSchema as sharedLineItemSchema, numericKeyDown } from "@/lib/utils/document";
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

const schema = z.object({
    supplierId: z.string().min(1, "Supplier required"),
    billDate: z.string().min(1, "Bill date required"),
    dueDate: z.string().min(1, "Due date required"),
    supplierReference: z.string().optional().or(z.literal("")),
    currency: z.string().min(1),
    notes: z.string().optional(),
    lineItems: z.array(sharedLineItemSchema).min(1, "At least one line item required"),
});

type FormValues = z.infer<typeof schema>;
interface Supplier { id: string; name: string }

interface BillSheetProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (bill: { id: string }) => void;
    defaultSupplierId?: string;
    editBillId?: string | null;
}

export function BillSheet({ open, onClose, onSuccess, defaultSupplierId, editBillId }: BillSheetProps) {
    const { data: suppliersData } = useSWR(
        open ? "/api/suppliers?limit=200" : null,
        jsonFetcher<{ data: Supplier[] }>
    );
    const suppliers = suppliersData?.data ?? [];
    const [submitting, setSubmitting] = useState(false);
    const orgSettings = useOrgSettings();

    // Fetch edit data via SWR (conditional key)
    const { data: editBillData } = useSWR(
        open && editBillId ? `/api/bills/${editBillId}` : null,
        jsonFetcher
    );

    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date(Date.now() + orgSettings.defaultDueDateDays * 86400000).toISOString().split("T")[0];

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        mode: "onChange",
        defaultValues: {
            supplierId: defaultSupplierId ?? "",
            billDate: today,
            dueDate,
            supplierReference: "",
            currency: orgSettings.defaultCurrency,
            notes: "",
            lineItems: [DEFAULT_LINE_ITEM],
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });
    const watchedItems = form.watch("lineItems");
    const currency = form.watch("currency");

    useEffect(() => {
        if (open) {
            if (editBillId && editBillData) {
                const bill = editBillData as Record<string, unknown> & { supplier: { id: string }; lineItems: Record<string, unknown>[] };
                form.reset({
                    supplierId: bill.supplier.id,
                    billDate: (bill.issueDate as string).split('T')[0],
                    dueDate: (bill.dueDate as string).split('T')[0],
                    supplierReference: (bill.reference as string) || "",
                    currency: bill.currency as string,
                    notes: (bill.notes as string) || "",
                    lineItems: bill.lineItems.map((item: Record<string, unknown>) => ({
                        description: item.description as string,
                        quantity: item.quantity as number,
                        unitPrice: item.unitPrice as number,
                        discountPercent: item.discount as number,
                        vatTreatment: item.vatTreatment as string,
                    })),
                });
            } else if (!editBillId) {
                loadOrgSettings().then((s) => {
                    const due = new Date(Date.now() + s.defaultDueDateDays * 86400000).toISOString().split("T")[0];
                    form.reset({
                        supplierId: defaultSupplierId ?? "",
                        billDate: today,
                        dueDate: due,
                        supplierReference: "",
                        currency: s.defaultCurrency,
                        notes: "",
                        lineItems: [DEFAULT_LINE_ITEM],
                    });
                });
            }
        }

    }, [open, editBillId, editBillData]);

    const totals = reduceTotals(watchedItems);

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const url = editBillId ? `/api/bills/${editBillId}` : "/api/bills";
            const method = editBillId ? "PATCH" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...values,
                    supplierReference: values.supplierReference || null,
                    notes: values.notes || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? `Failed to ${editBillId ? 'update' : 'create'} bill`);
            toast.success(`Bill ${editBillId ? 'updated' : 'created'}`);
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
            <SheetContent
                side="right"
                className="w-full sm:max-w-3xl flex flex-col p-0"
                showCloseButton={false}
            >
                <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-lg">{editBillId ? "Edit Bill" : "New Bill"}</SheetTitle>
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </Button>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1">
                    <form id="bill-sheet-form" onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-4 space-y-6">
                        {/* Details */}
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Bill Details</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="sm:col-span-2 space-y-1.5">
                                    <Label>Supplier <span className="text-destructive">*</span></Label>
                                    <Select value={form.watch("supplierId")} onValueChange={(v) => form.setValue("supplierId", v, { shouldValidate: true })}>
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
                                    <Label>Bill Date <span className="text-destructive">*</span></Label>
                                    <DatePicker value={form.watch("billDate")} onChange={(v) => form.setValue("billDate", v, { shouldValidate: true })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Due Date <span className="text-destructive">*</span></Label>
                                    <DatePicker value={form.watch("dueDate")} onChange={(v) => form.setValue("dueDate", v, { shouldValidate: true })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Supplier Reference</Label>
                                    <Input placeholder="Supplier's invoice number" {...form.register("supplierReference")} />
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
                            </div>
                        </div>

                        <Separator />

                        {/* Line Items */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Line Items</p>
                            </div>

                            <div className="rounded-lg border divide-y">
                                {fields.map((field, index) => {
                                    const item = watchedItems[index] ?? {};
                                    const { vatAmt, lineTotal } = calcLine(Number(item.quantity) || 0, Number(item.unitPrice) || 0, Number(item.discountPercent) || 0, item.vatTreatment ?? "STANDARD_RATED");
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
                                            <div>
                                                <Input className="h-8 text-sm" placeholder="Description *" {...form.register(`lineItems.${index}.description`)} />
                                                {form.formState.errors.lineItems?.[index]?.description && (
                                                    <p className="text-xs text-destructive mt-1">{form.formState.errors.lineItems[index]?.description?.message}</p>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-muted-foreground">Qty</Label>
                                                    <Input className="h-8 text-sm" type="text" inputMode="decimal" placeholder="0" {...form.register(`lineItems.${index}.quantity`, { setValueAs: (v) => v === '' ? 0 : parseFloat(v) || 0 })} onKeyDown={numericKeyDown} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-muted-foreground">Price ({currency})</Label>
                                                    <Input className="h-8 text-sm" type="text" inputMode="decimal" placeholder="0.00" {...form.register(`lineItems.${index}.unitPrice`, { setValueAs: (v) => v === '' ? 0 : parseFloat(v) || 0 })} onKeyDown={numericKeyDown} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-muted-foreground">Disc %</Label>
                                                    <Input className="h-8 text-sm" type="text" inputMode="decimal" placeholder="0" {...form.register(`lineItems.${index}.discountPercent`, { setValueAs: (v) => v === '' ? 0 : parseFloat(v) || 0 })} onKeyDown={numericKeyDown} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px] text-muted-foreground">VAT</Label>
                                                    <Select value={form.watch(`lineItems.${index}.vatTreatment`)} onValueChange={(v) => form.setValue(`lineItems.${index}.vatTreatment`, v)}>
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
                                onClick={() => append(DEFAULT_LINE_ITEM)}
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

                        <div className="space-y-1.5">
                            <Label className="text-xs">Notes</Label>
                            <Textarea placeholder="Internal notes..." rows={3} {...form.register("notes")} />
                        </div>
                    </form>
                </ScrollArea>

                <SheetFooter className="px-6 py-4 border-t gap-2 shrink-0">
                    <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
                    <Button type="submit" form="bill-sheet-form" disabled={submitting || (!!editBillId && !form.formState.isDirty)} className="flex-1 sm:flex-none">
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editBillId ? "Update Bill" : "Create Bill"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
