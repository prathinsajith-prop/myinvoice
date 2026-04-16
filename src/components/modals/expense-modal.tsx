"use client";

import { useEffect, useState } from "react";
import { useOrgSettings, loadOrgSettings } from "@/lib/hooks/use-org-settings";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
    EXPENSE_CATEGORIES,
    EXPENSE_PAYMENT_METHODS,
} from "@/lib/constants/expense";

const schema = z.object({
    description: z.string().min(1, "Description required"),
    category: z.string().min(1, "Category required"),
    expenseDate: z.string().min(1, "Date required"),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    vatAmount: z.coerce.number().min(0).default(0),
    paymentMethod: z.string().default("CASH"),
    currency: z.string().min(1),
    vendorName: z.string().optional().or(z.literal("")),
    receiptNumber: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
}).superRefine((data, ctx) => {
    if (data.vatAmount > data.amount) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "VAT amount cannot exceed the expense amount",
            path: ["vatAmount"],
        });
    }
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_VALUES: Omit<FormValues, "currency"> = {
    description: "",
    category: "",
    expenseDate: new Date().toISOString().split("T")[0],
    amount: 0,
    vatAmount: 0,
    paymentMethod: "CASH",
    vendorName: "",
    receiptNumber: "",
    notes: "",
};

interface ExpenseModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (expense: { id: string }) => void;
    initialData?: Partial<FormValues>;
    id?: string;
}

export function ExpenseModal({
    open,
    onClose,
    onSuccess,
    initialData,
    id,
}: ExpenseModalProps) {
    const isEdit = Boolean(id);
    const [saving, setSaving] = useState(false);
    const orgSettings = useOrgSettings();

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: { ...DEFAULT_VALUES, currency: orgSettings.defaultCurrency },
    });

    useEffect(() => {
        if (open) {
            loadOrgSettings().then((s) => {
                form.reset(
                    initialData
                        ? {
                            ...DEFAULT_VALUES,
                            currency: s.defaultCurrency,
                            ...initialData,
                            expenseDate:
                                initialData.expenseDate ??
                                new Date().toISOString().split("T")[0],
                        }
                        : {
                            ...DEFAULT_VALUES,
                            currency: s.defaultCurrency,
                            expenseDate: new Date().toISOString().split("T")[0],
                        }
                );
            });
        }
    }, [open, initialData, form]);

    async function onSubmit(values: FormValues) {
        setSaving(true);
        try {
            const url = isEdit ? `/api/expenses/${id}` : "/api/expenses";
            const method = isEdit ? "PATCH" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    description: values.description,
                    category: values.category,
                    expenseDate: new Date(values.expenseDate).toISOString(),
                    amount: values.amount,
                    currency: values.currency,
                    reference: values.receiptNumber || null,
                    merchantName: values.vendorName || null,
                    paymentMethod: values.paymentMethod,
                    vatTreatment: "STANDARD_RATED",
                    vatRate: values.amount > 0 && values.vatAmount > 0 ? Number(((values.vatAmount / values.amount) * 100).toFixed(2)) : 0,
                    isVatReclaimable: values.vatAmount > 0,
                    isPaid: true,
                    notes: values.notes || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error ?? "Failed to save expense");
                return;
            }
            const data = await res.json();
            toast.success(isEdit ? "Expense updated" : "Expense recorded");
            onSuccess(data);
            onClose();
        } finally {
            setSaving(false);
        }
    }

    const watchedAmount = form.watch("amount");
    const watchedVat = form.watch("vatAmount");
    const watchedCurrency = form.watch("currency");
    const total = (Number(watchedAmount) || 0) + (Number(watchedVat) || 0);

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="w-[96vw] max-w-[46rem] overflow-hidden p-0 sm:max-w-[46rem]">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle>{isEdit ? "Edit Expense" : "Record Expense"}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {isEdit ? "Update expense details" : "Create a new expense entry"}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[74vh] px-6">
                    <Form {...form}>
                        <form
                            id="expense-form"
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="space-y-4 py-4 pb-6"
                        >
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Description <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g. Office supplies purchase"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Category <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {EXPENSE_CATEGORIES.map((c) => (
                                                        <SelectItem key={c.value} value={c.value}>
                                                            {c.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="expenseDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Date <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <DatePicker value={field.value} onChange={field.onChange} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Amount <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0.00"
                                                    {...field}
                                                    onKeyDown={(e) => { if (!/[\d.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="vatAmount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>VAT Amount</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0.00"
                                                    {...field}
                                                    onKeyDown={(e) => { if (!/[\d.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {total > 0 && (
                                <div className="rounded-lg bg-muted/50 px-4 py-2.5 text-sm flex justify-between">
                                    <span className="text-muted-foreground">Total (incl. VAT)</span>
                                    <span className="font-semibold">
                                        {watchedCurrency} {total.toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}

                            <Separator />

                            <div className="grid gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="paymentMethod"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Payment Method</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {EXPENSE_PAYMENT_METHODS.map((m) => (
                                                        <SelectItem key={m.value} value={m.value}>
                                                            {m.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="vendorName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Vendor Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Vendor / supplier name" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="receiptNumber"
                                    render={({ field }) => (
                                        <FormItem className="sm:col-span-2">
                                            <FormLabel>Receipt / Reference</FormLabel>
                                            <FormControl>
                                                <Input placeholder="REC-001" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Additional notes..."
                                                rows={2}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </form>
                    </Form>
                </ScrollArea>

                <DialogFooter className="border-t px-6 py-4">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="submit" form="expense-form" disabled={saving || (isEdit && !form.formState.isDirty)}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEdit ? "Save Changes" : "Record Expense"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
