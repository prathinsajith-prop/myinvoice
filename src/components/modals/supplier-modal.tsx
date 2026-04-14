"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
    Dialog,
    DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CountrySelect } from "@/components/ui/country-select";

const schema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    type: z.enum(["BUSINESS", "INDIVIDUAL"]).default("BUSINESS"),
    taxRegistrationNumber: z.string().optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    country: z.string().optional().or(z.literal("")),
    website: z.string().optional().or(z.literal("")),
    bankAccountNumber: z.string().optional().or(z.literal("")),
    bankAccountName: z.string().optional().or(z.literal("")),
    iban: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_VALUES: FormValues = {
    name: "",
    email: "",
    phone: "",
    type: "BUSINESS",
    taxRegistrationNumber: "",
    address: "",
    city: "",
    country: "AE",
    website: "",
    bankAccountNumber: "",
    bankAccountName: "",
    iban: "",
    notes: "",
};

interface SupplierModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (supplier: { id: string; name: string }) => void;
    initialData?: Partial<FormValues>;
    id?: string;
}

export function SupplierModal({
    open,
    onClose,
    onSuccess,
    initialData,
    id,
}: SupplierModalProps) {
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
            const url = isEdit ? `/api/suppliers/${id}` : "/api/suppliers";
            const method = isEdit ? "PATCH" : "POST";
            const body = {
                name: values.name,
                type: values.type,
                email: values.email || null,
                phone: values.phone || null,
                website: values.website || null,
                trn: values.taxRegistrationNumber || null,
                isVatRegistered: Boolean(values.taxRegistrationNumber),
                addressLine1: values.address || null,
                city: values.city || null,
                country: values.country || "AE",
                bankAccountName: values.bankAccountName || null,
                bankAccountNumber: values.bankAccountNumber || null,
                bankIban: values.iban || null,
                notes: values.notes || null,
            };
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error ?? "Failed to save supplier");
                return;
            }
            const data = await res.json();
            toast.success(isEdit ? "Supplier updated" : "Supplier created");
            onSuccess(data);
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="w-[96vw] max-w-[52rem] overflow-hidden p-0 sm:max-w-[52rem]">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle>{isEdit ? "Edit Supplier" : "New Supplier"}</DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[74vh] px-6">
                    <Form {...form}>
                        <form
                            id="supplier-form"
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
                                            <FormLabel>
                                                Supplier Name <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Emirates Paper Supply" {...field} />
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
                                                    <SelectItem value="BUSINESS">Business</SelectItem>
                                                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="taxRegistrationNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>TRN</FormLabel>
                                            <FormControl>
                                                <Input placeholder="100XXXXXXXXX003" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Separator />

                            {/* Contact */}
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Contact
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="accounts@supplier.ae" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone</FormLabel>
                                            <FormControl>
                                                <Input placeholder="+971 4 XXX XXXX" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="website"
                                    render={({ field }) => (
                                        <FormItem className="sm:col-span-2">
                                            <FormLabel>Website</FormLabel>
                                            <FormControl>
                                                <Input placeholder="https://supplier.ae" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Separator />

                            {/* Address */}
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Address
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem className="sm:col-span-2">
                                            <FormLabel>Street Address</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Warehouse 5, Industrial Area" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>City</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Dubai" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="country"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Country</FormLabel>
                                            <FormControl>
                                                <CountrySelect value={field.value ?? "AE"} onChange={field.onChange} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Separator />

                            {/* Banking */}
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Banking Details
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="bankAccountName"
                                    render={({ field }) => (
                                        <FormItem className="sm:col-span-2">
                                            <FormLabel>Account Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Account holder name" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="bankAccountNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Account Number</FormLabel>
                                            <FormControl>
                                                <Input placeholder="XXXXXXXXXX" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="iban"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>IBAN</FormLabel>
                                            <FormControl>
                                                <Input placeholder="AE07 0331 2345 6789 0123 456" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Separator />

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Internal notes about this supplier..."
                                                rows={3}
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
                    <Button type="submit" form="supplier-form" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEdit ? "Save Changes" : "Create Supplier"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
