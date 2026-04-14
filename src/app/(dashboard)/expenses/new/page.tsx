"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, Loader2 } from "lucide-react";
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

const schema = z.object({
    description: z.string().min(1, "Description required"),
    category: z.string().min(1, "Category required"),
    expenseDate: z.string().min(1),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    vatAmount: z.coerce.number().min(0).default(0),
    paymentMethod: z.string().default("CASH"),
    currency: z.string().default("AED"),
    vendorName: z.string().optional(),
    receiptNumber: z.string().optional(),
    notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const CATEGORIES = [
    { value: "TRAVEL", label: "Travel" },
    { value: "MEALS_AND_ENTERTAINMENT", label: "Meals & Entertainment" },
    { value: "OFFICE_SUPPLIES", label: "Office Supplies" },
    { value: "UTILITIES", label: "Utilities" },
    { value: "RENT", label: "Rent" },
    { value: "MARKETING", label: "Marketing" },
    { value: "PROFESSIONAL_SERVICES", label: "Professional Services" },
    { value: "INSURANCE", label: "Insurance" },
    { value: "MAINTENANCE", label: "Maintenance" },
    { value: "OTHER", label: "Other" },
];

const PAYMENT_METHODS = [
    { value: "CASH", label: "Cash" },
    { value: "CREDIT_CARD", label: "Credit Card" },
    { value: "DEBIT_CARD", label: "Debit Card" },
    { value: "BANK_TRANSFER", label: "Bank Transfer" },
    { value: "CHEQUE", label: "Cheque" },
    { value: "PETTY_CASH", label: "Petty Cash" },
];

export default function NewExpensePage() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    const today = new Date().toISOString().split("T")[0];

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: {
            description: "",
            category: "",
            expenseDate: today,
            amount: 0,
            vatAmount: 0,
            paymentMethod: "CASH",
            currency: "AED",
            vendorName: "",
            receiptNumber: "",
            notes: "",
        },
    });

    const amount = form.watch("amount") || 0;
    const vatAmount = form.watch("vatAmount") || 0;
    const totalAmount = Number(amount) + Number(vatAmount);

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const res = await fetch("/api/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to create expense");
            toast.success("Expense created");
            router.push(`/expenses/${data.id}`);
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
                    <Link href="/expenses"><ChevronLeft className="h-5 w-5" /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">New Expense</h1>
                    <p className="text-muted-foreground">Record a business expense</p>
                </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Expense Details</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2 space-y-1.5">
                            <Label>Description <span className="text-destructive">*</span></Label>
                            <Input placeholder="What was this expense for?" {...form.register("description")} />
                            {form.formState.errors.description && (
                                <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Category <span className="text-destructive">*</span></Label>
                            <Select
                                value={form.watch("category")}
                                onValueChange={(v) => form.setValue("category", v, { shouldValidate: true })}
                            >
                                <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {form.formState.errors.category && (
                                <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Expense Date</Label>
                            <Input type="date" {...form.register("expenseDate")} />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Amount (excl. VAT) <span className="text-destructive">*</span></Label>
                            <Input type="number" min="0" step="0.01" placeholder="0.00" {...form.register("amount")} />
                            {form.formState.errors.amount && (
                                <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label>VAT Amount</Label>
                            <Input type="number" min="0" step="0.01" placeholder="0.00" {...form.register("vatAmount")} />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Payment Method</Label>
                            <Select
                                value={form.watch("paymentMethod")}
                                onValueChange={(v) => form.setValue("paymentMethod", v)}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
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
                            <Label>Vendor Name</Label>
                            <Input placeholder="Who was paid?" {...form.register("vendorName")} />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Receipt Number</Label>
                            <Input placeholder="Receipt or reference number" {...form.register("receiptNumber")} />
                        </div>

                        <div className="sm:col-span-2 space-y-1.5">
                            <Label>Notes</Label>
                            <Textarea placeholder="Additional notes..." rows={3} {...form.register("notes")} />
                        </div>
                    </CardContent>
                </Card>

                {/* Total preview */}
                <Card>
                    <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount (excl. VAT)</span>
                            <span>AED {Number(amount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">VAT Amount</span>
                            <span>AED {Number(vatAmount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t pt-3">
                            <span>Total Amount</span>
                            <span>AED {totalAmount.toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex items-center justify-end gap-3">
                    <Button type="button" variant="outline" asChild>
                        <Link href="/expenses">Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Expense
                    </Button>
                </div>
            </form>
        </div>
    );
}
