"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DatePicker } from "@/components/ui/date-picker";
import { jsonFetcher } from "@/lib/fetcher";

const lineItemSchema = z.object({
    description: z.string().min(1, "Required"),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    unitOfMeasure: z.string().default("unit"),
    discount: z.coerce.number().min(0).max(100).default(0),
    vatRate: z.coerce.number().min(0).max(100).default(5),
});

const schema = z.object({
    customerId: z.string().min(1, "Customer required"),
    templateName: z.string().optional(),
    frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUALLY", "ANNUALLY"]),
    startDate: z.string().min(1, "Start date required"),
    endDate: z.string().optional(),
    autoSend: z.boolean().default(false),
    notes: z.string().optional(),
    lineItems: z.array(lineItemSchema).min(1, "At least one item required"),
});

type FormValues = z.infer<typeof schema>;

interface Customer { id: string; name: string }

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function RecurringInvoiceSheet({ open, onClose, onSuccess }: Props) {
    const t = useTranslations("recurringInvoices");
    const tc = useTranslations("common");

    const { data: customersData } = useSWR<{ data: Customer[] }>(
        open ? "/api/customers?limit=100" : null,
        jsonFetcher,
        { revalidateOnFocus: false }
    );

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: {
            customerId: "",
            templateName: "",
            frequency: "MONTHLY",
            startDate: new Date().toISOString().split("T")[0],
            endDate: "",
            autoSend: false,
            notes: "",
            lineItems: [{ description: "", quantity: 1, unitPrice: 0, unitOfMeasure: "unit", discount: 0, vatRate: 5 }],
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            form.reset({
                customerId: "",
                templateName: "",
                frequency: "MONTHLY",
                startDate: new Date().toISOString().split("T")[0],
                endDate: "",
                autoSend: false,
                notes: "",
                lineItems: [{ description: "", quantity: 1, unitPrice: 0, unitOfMeasure: "unit", discount: 0, vatRate: 5 }],
            });
        }
    }, [open, form]);

    // Live total calculation
    const lineItems = form.watch("lineItems");
    const total = lineItems.reduce((sum, item) => {
        const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
        const afterDiscount = lineTotal * (1 - (item.discount || 0) / 100);
        return sum + afterDiscount * (1 + (item.vatRate || 0) / 100);
    }, 0);

    async function onSubmit(values: FormValues) {
        setSaving(true);
        try {
            const res = await fetch("/api/recurring-invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...values,
                    endDate: values.endDate || null,
                    templateName: values.templateName || null,
                    notes: values.notes || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error ?? "Failed to create");
                return;
            }
            toast.success(t("created"));
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create");
        } finally {
            setSaving(false);
        }
    }

    const customers = customersData?.data ?? [];

    const FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUALLY", "ANNUALLY"] as const;

    return (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
                <SheetHeader className="px-6 py-4 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <RefreshCcw className="h-5 w-5" />
                        {t("new")}
                    </SheetTitle>
                </SheetHeader>

                <ScrollArea className="flex-1 px-6">
                    <form id="ri-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 pb-8">
                        {/* Basic Info */}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>{t("customer")} <span className="text-destructive">*</span></Label>
                                <Select
                                    value={form.watch("customerId")}
                                    onValueChange={(v) => form.setValue("customerId", v, { shouldDirty: true })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={tc("selectCustomer")} />
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
                                <Label>{t("templateName")}</Label>
                                <Input placeholder={tc("optional")} {...form.register("templateName")} />
                            </div>
                        </div>

                        {/* Frequency & Dates */}
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label>{t("frequency")} <span className="text-destructive">*</span></Label>
                                <Select
                                    value={form.watch("frequency")}
                                    onValueChange={(v) => form.setValue("frequency", v as FormValues["frequency"])}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FREQUENCIES.map((f) => (
                                            <SelectItem key={f} value={f}>{t(`frequencies.${f}`)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t("startDate")} <span className="text-destructive">*</span></Label>
                                <DatePicker
                                    value={form.watch("startDate")}
                                    onChange={(d) => form.setValue("startDate", d)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t("endDate")}</Label>
                                <DatePicker
                                    value={form.watch("endDate") ?? ""}
                                    onChange={(d) => form.setValue("endDate", d)}
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* Line Items */}
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("lineItems")}</p>
                        {fields.map((field, i) => (
                            <div key={field.id} className="rounded-md border p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Item {i + 1}</span>
                                    {fields.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(i)}>
                                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="space-y-1 sm:col-span-2">
                                        <Label className="text-xs">{t("description")}</Label>
                                        <Input {...form.register(`lineItems.${i}.description`)} placeholder={t("description")} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">{t("quantity")}</Label>
                                        <Input type="number" step="0.001" min="0.001" {...form.register(`lineItems.${i}.quantity`)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">{t("unitPrice")}</Label>
                                        <Input type="number" step="0.01" min="0" {...form.register(`lineItems.${i}.unitPrice`)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">{t("vatRate")} (%)</Label>
                                        <Input type="number" step="0.01" min="0" max="100" {...form.register(`lineItems.${i}.vatRate`)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">{t("discount")} (%)</Label>
                                        <Input type="number" step="0.01" min="0" max="100" {...form.register(`lineItems.${i}.discount`)} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append({ description: "", quantity: 1, unitPrice: 0, unitOfMeasure: "unit", discount: 0, vatRate: 5 })}
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            {t("addItem")}
                        </Button>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>{t("notes")}</Label>
                            <Textarea rows={2} {...form.register("notes")} />
                        </div>

                        {/* Total preview */}
                        <div className="rounded-md bg-muted px-4 py-2 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{t("total")}</span>
                            <span className="font-semibold">
                                {new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(total)}
                            </span>
                        </div>
                    </form>
                </ScrollArea>

                <SheetFooter className="px-6 py-4 border-t gap-2">
                    <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
                    <Button type="submit" form="ri-form" disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        {t("create")}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
