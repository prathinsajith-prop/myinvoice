"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Loader2, Truck } from "lucide-react";
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
import { jsonFetcher } from "@/lib/fetcher";

const lineItemSchema = z.object({
    description: z.string().min(1, "Description required"),
    quantity: z.coerce.number().positive("Must be > 0"),
    unitOfMeasure: z.string().default("unit"),
    notes: z.string().optional(),
});

const schema = z.object({
    customerId: z.string().min(1, "Customer required"),
    invoiceId: z.string().optional(),
    issueDate: z.string().min(1),
    deliveryDate: z.string().optional(),
    shippingAddress: z.string().optional(),
    trackingNumber: z.string().optional(),
    carrier: z.string().optional(),
    driverName: z.string().optional(),
    vehicleNumber: z.string().optional(),
    notes: z.string().optional(),
    lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

type FormValues = z.infer<typeof schema>;
interface Customer { id: string; name: string }
interface Invoice { id: string; invoiceNumber: string }

interface DeliveryNoteSheetProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (note: { id: string }) => void;
    defaultCustomerId?: string;
    defaultInvoiceId?: string;
}

export function DeliveryNoteSheet({ open, onClose, onSuccess, defaultCustomerId, defaultInvoiceId }: DeliveryNoteSheetProps) {
    const { data: customersData } = useSWR<{ data: Customer[] }>(
        open ? "/api/customers?limit=100" : null,
        jsonFetcher,
        { revalidateOnFocus: false }
    );

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: {
            customerId: defaultCustomerId ?? "",
            invoiceId: defaultInvoiceId ?? "",
            issueDate: new Date().toISOString().split("T")[0],
            deliveryDate: "",
            shippingAddress: "",
            trackingNumber: "",
            carrier: "",
            driverName: "",
            vehicleNumber: "",
            notes: "",
            lineItems: [{ description: "", quantity: 1, unitOfMeasure: "unit", notes: "" }],
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });

    const customerId = form.watch("customerId");

    const { data: invoicesData } = useSWR<{ data: Invoice[] }>(
        open && customerId ? `/api/invoices?customerId=${customerId}&limit=50` : null,
        jsonFetcher,
        { revalidateOnFocus: false }
    );

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            form.reset({
                customerId: defaultCustomerId ?? "",
                invoiceId: defaultInvoiceId ?? "",
                issueDate: new Date().toISOString().split("T")[0],
                deliveryDate: "",
                shippingAddress: "",
                trackingNumber: "",
                carrier: "",
                driverName: "",
                vehicleNumber: "",
                notes: "",
                lineItems: [{ description: "", quantity: 1, unitOfMeasure: "unit", notes: "" }],
            });
        }
    }, [open, defaultCustomerId, defaultInvoiceId, form]);

    async function onSubmit(values: FormValues) {
        setSaving(true);
        try {
            const res = await fetch("/api/delivery-notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...values,
                    invoiceId: values.invoiceId || null,
                    deliveryDate: values.deliveryDate || null,
                    shippingAddress: values.shippingAddress || null,
                    trackingNumber: values.trackingNumber || null,
                    carrier: values.carrier || null,
                    driverName: values.driverName || null,
                    vehicleNumber: values.vehicleNumber || null,
                    notes: values.notes || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error ?? "Failed to create delivery note");
                return;
            }
            const data = await res.json();
            toast.success("Delivery note created");
            onSuccess(data);
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create delivery note");
        } finally {
            setSaving(false);
        }
    }

    const customers = customersData?.data ?? [];
    const invoices = invoicesData?.data ?? [];

    return (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
                <SheetHeader className="px-6 py-4 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        New Delivery Note
                    </SheetTitle>
                </SheetHeader>

                <ScrollArea className="flex-1 px-6">
                    <form id="dn-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 pb-8">
                        {/* Customer & Invoice */}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Customer <span className="text-destructive">*</span></Label>
                                <Select
                                    value={form.watch("customerId")}
                                    onValueChange={(v) => {
                                        form.setValue("customerId", v, { shouldDirty: true });
                                        form.setValue("invoiceId", "");
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select customer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {form.formState.errors.customerId && (
                                    <p className="text-sm text-destructive">{form.formState.errors.customerId.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Linked Invoice</Label>
                                <Select
                                    value={form.watch("invoiceId") ?? ""}
                                    onValueChange={(v) => form.setValue("invoiceId", v === "__none__" ? "" : v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Optional" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">None</SelectItem>
                                        {invoices.map((inv) => (
                                            <SelectItem key={inv.id} value={inv.id}>{inv.invoiceNumber}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Issue Date <span className="text-destructive">*</span></Label>
                                <DatePicker
                                    value={form.watch("issueDate")}
                                    onChange={(d) => form.setValue("issueDate", d)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Delivery Date</Label>
                                <DatePicker
                                    value={form.watch("deliveryDate") ?? ""}
                                    onChange={(d) => form.setValue("deliveryDate", d)}
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* Shipping Info */}
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Shipping Details</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                                <Label>Shipping Address</Label>
                                <Textarea
                                    placeholder="Full delivery address"
                                    rows={2}
                                    {...form.register("shippingAddress")}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tracking Number</Label>
                                <Input placeholder="e.g. 1Z999AA10123456784" {...form.register("trackingNumber")} />
                            </div>
                            <div className="space-y-2">
                                <Label>Carrier</Label>
                                <Input placeholder="e.g. Aramex, DHL" {...form.register("carrier")} />
                            </div>
                            <div className="space-y-2">
                                <Label>Driver Name</Label>
                                <Input placeholder="Driver name" {...form.register("driverName")} />
                            </div>
                            <div className="space-y-2">
                                <Label>Vehicle Number</Label>
                                <Input placeholder="Plate number" {...form.register("vehicleNumber")} />
                            </div>
                        </div>

                        <Separator />

                        {/* Line Items */}
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Items</p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => append({ description: "", quantity: 1, unitOfMeasure: "unit", notes: "" })}
                            >
                                <Plus className="mr-1 h-3 w-3" /> Add Item
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {fields.map((field, idx) => (
                                <div key={field.id} className="rounded-lg border p-3 space-y-2">
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 space-y-2">
                                            <Input
                                                placeholder="Item description"
                                                {...form.register(`lineItems.${idx}.description`)}
                                            />
                                            {form.formState.errors.lineItems?.[idx]?.description && (
                                                <p className="text-sm text-destructive">{form.formState.errors.lineItems[idx].description?.message}</p>
                                            )}
                                        </div>
                                        {fields.length > 1 && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)}>
                                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="grid gap-2 grid-cols-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Qty</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                {...form.register(`lineItems.${idx}.quantity`, { valueAsNumber: true })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Unit</Label>
                                            <Input
                                                placeholder="unit"
                                                {...form.register(`lineItems.${idx}.unitOfMeasure`)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Notes</Label>
                                            <Input
                                                placeholder="Optional"
                                                {...form.register(`lineItems.${idx}.notes`)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Notes */}
                        <Separator />
                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea rows={3} placeholder="Additional notes..." {...form.register("notes")} />
                        </div>
                    </form>
                </ScrollArea>

                <SheetFooter className="border-t px-6 py-4">
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button type="submit" form="dn-form" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Delivery Note
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
