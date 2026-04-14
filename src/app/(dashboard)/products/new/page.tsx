"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    sku: z.string().optional().or(z.literal("")),
    description: z.string().optional().or(z.literal("")),
    type: z.enum(["PRODUCT", "SERVICE", "EXPENSE"]).default("SERVICE"),
    unitPrice: z.coerce.number().min(0),
    unit: z.string().default("unit"),
    vatTreatment: z.enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE"]).default("STANDARD_RATED"),
    vatRate: z.coerce.number().min(0).max(100).default(5),
    category: z.string().optional().or(z.literal("")),
    trackInventory: z.boolean().default(false),
    isActive: z.boolean().default(true),
});
type FormValues = z.infer<typeof formSchema>;

export default function NewProductPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as Resolver<FormValues>,
        defaultValues: { name: "", sku: "", description: "", type: "SERVICE", unitPrice: 0, unit: "unit", vatTreatment: "STANDARD_RATED", vatRate: 5, category: "", trackInventory: false, isActive: true },
    });

    async function onSubmit(values: FormValues) {
        setSaving(true);
        try {
            const res = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...values, sku: values.sku || null, description: values.description || null, category: values.category || null }),
            });
            if (!res.ok) { const err = await res.json(); toast.error(err.error ?? "Failed"); return; }
            const product = await res.json();
            toast.success("Product created");
            router.push(`/products/${product.id}`);
        } finally { setSaving(false); }
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild><Link href="/products"><ArrowLeft className="h-4 w-4" /></Link></Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">New Product / Service</h1>
                    <p className="text-muted-foreground">Add a product or service to your catalog</p>
                </div>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input placeholder="e.g. Web Development Services" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="type" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="SERVICE">Service</SelectItem>
                                                <SelectItem value="PRODUCT">Product</SelectItem>
                                                <SelectItem value="EXPENSE">Expense</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="sku" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>SKU / Code</FormLabel>
                                        <FormControl><Input placeholder="SVC-001" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="unitPrice" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unit Price (AED)</FormLabel>
                                        <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="unit" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unit of Measure</FormLabel>
                                        <FormControl><Input placeholder="unit / hour / kg / pcs" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="vatTreatment" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>VAT Treatment</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="STANDARD_RATED">Standard Rated (5%)</SelectItem>
                                                <SelectItem value="ZERO_RATED">Zero Rated (0%)</SelectItem>
                                                <SelectItem value="EXEMPT">Exempt</SelectItem>
                                                <SelectItem value="OUT_OF_SCOPE">Out of Scope</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="category" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <FormControl><Input placeholder="e.g. IT Services" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="description" render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>Description</FormLabel>
                                        <FormControl><Textarea rows={3} placeholder="Description for line items..." {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-base">Settings</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="isActive" render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                        <FormLabel>Active</FormLabel>
                                        <FormDescription className="text-xs">Show in product picker on invoices</FormDescription>
                                    </div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" asChild><Link href="/products">Cancel</Link></Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Product
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
