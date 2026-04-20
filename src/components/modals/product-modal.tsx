"use client";

import { useEffect, useState } from "react";
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
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const schema = z.object({
    name: z.string().min(1, "Name is required"),
    sku: z.string().optional().or(z.literal("")),
    description: z.string().optional().or(z.literal("")),
    type: z.enum(["PRODUCT", "SERVICE"]).default("SERVICE"),
    unitPrice: z.coerce.number().min(0),
    unit: z.string().default("unit"),
    vatTreatment: z
        .enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE"])
        .default("STANDARD_RATED"),
    vatRate: z.coerce.number().min(0).max(100).default(5),
    category: z.string().optional().or(z.literal("")),
    trackInventory: z.boolean().default(false),
    isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_VALUES: FormValues = {
    name: "",
    sku: "",
    description: "",
    type: "SERVICE",
    unitPrice: 0,
    unit: "unit",
    vatTreatment: "STANDARD_RATED",
    vatRate: 5,
    category: "",
    trackInventory: false,
    isActive: true,
};

interface ProductModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (product: { id: string; name: string }) => void;
    initialData?: Partial<FormValues>;
    id?: string;
}

export function ProductModal({
    open,
    onClose,
    onSuccess,
    initialData,
    id,
}: ProductModalProps) {
    const isEdit = Boolean(id);
    const [saving, setSaving] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: DEFAULT_VALUES,
    });

    useEffect(() => {
        if (open) {
            form.reset(initialData ? { ...DEFAULT_VALUES, ...initialData } : DEFAULT_VALUES);
        }
    }, [open, initialData, form]);

    async function onSubmit(values: FormValues) {
        setSaving(true);
        try {
            const url = isEdit ? `/api/products/${id}` : "/api/products";
            const method = isEdit ? "PATCH" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: values.name,
                    sku: values.sku || null,
                    description: values.description || null,
                    type: values.type,
                    unitPrice: values.unitPrice,
                    unitOfMeasure: values.unit,
                    vatTreatment: values.vatTreatment,
                    vatRate: values.vatRate,
                    category: values.category || null,
                    trackInventory: values.trackInventory,
                    isActive: values.isActive,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error ?? "Failed to save product");
                return;
            }
            const data = await res.json();
            toast.success(isEdit ? "Product updated" : "Product created");
            onSuccess(data);
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save product");
        } finally {
            setSaving(false);
        }
    }

    const watchedVatTreatment = form.watch("vatTreatment");

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="w-[96vw] max-w-[46rem] overflow-hidden p-0 sm:max-w-[46rem]">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle>
                        {isEdit ? "Edit Product / Service" : "New Product / Service"}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {isEdit ? "Update product or service pricing, VAT, and status." : "Create a new product or service with pricing and VAT settings."}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[74vh] px-6">
                    <Form {...form}>
                        <form
                            id="product-form"
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="space-y-4 py-4 pb-6"
                        >
                            {/* Basic */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem className="sm:col-span-2">
                                            <FormLabel required>
                                                Name
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g. Web Development Services"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Type</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="SERVICE">Service</SelectItem>
                                                    <SelectItem value="PRODUCT">Product</SelectItem>
                                                    <SelectItem value="EXPENSE">Expense</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="sku"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>SKU / Code</FormLabel>
                                            <FormControl>
                                                <Input placeholder="SVC-001" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem className="sm:col-span-2">
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Brief description shown on invoices"
                                                    rows={2}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Separator />

                            {/* Pricing */}
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Pricing
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="unitPrice"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel required>
                                                Unit Price (AED)
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
                                    name="unit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Unit of Measure</FormLabel>
                                            <FormControl>
                                                <Input placeholder="unit / hr / kg" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="vatTreatment"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>VAT Treatment</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="STANDARD_RATED">
                                                        Standard Rated (5%)
                                                    </SelectItem>
                                                    <SelectItem value="ZERO_RATED">Zero Rated (0%)</SelectItem>
                                                    <SelectItem value="EXEMPT">Exempt</SelectItem>
                                                    <SelectItem value="OUT_OF_SCOPE">Out of Scope</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {watchedVatTreatment === "STANDARD_RATED" && (
                                    <FormField
                                        control={form.control}
                                        name="vatRate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>VAT Rate (%)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        {...field}
                                                        onKeyDown={(e) => { if (!/[\d.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field }) => (
                                        <FormItem className="sm:col-span-2">
                                            <FormLabel>Category</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Consulting, Software" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Separator />

                            {/* Settings */}
                            <div className="space-y-3">
                                <FormField
                                    control={form.control}
                                    name="trackInventory"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                            <div>
                                                <FormLabel className="font-medium">Track Inventory</FormLabel>
                                                <FormDescription className="text-xs">
                                                    Enable stock level tracking
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="isActive"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                            <div>
                                                <FormLabel className="font-medium">Active</FormLabel>
                                                <FormDescription className="text-xs">
                                                    Show in product selectors on invoices
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </form>
                    </Form>
                </ScrollArea>

                <DialogFooter className="border-t px-6 py-4">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="submit" form="product-form" disabled={saving || (isEdit && !form.formState.isDirty)}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEdit ? "Save Changes" : "Create Product"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
