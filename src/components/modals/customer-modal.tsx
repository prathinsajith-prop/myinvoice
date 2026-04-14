"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Loader2, User } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CountrySelect } from "@/components/ui/country-select";

const schema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    mobile: z.string().optional().or(z.literal("")),
    type: z.enum(["BUSINESS", "INDIVIDUAL"]).default("BUSINESS"),
    image: z.string().optional().or(z.literal("")),
    taxRegistrationNumber: z.string().optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    country: z.string().optional().or(z.literal("")),
    website: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_VALUES: FormValues = {
    name: "",
    email: "",
    phone: "",
    mobile: "",
    type: "BUSINESS",
    image: "",
    taxRegistrationNumber: "",
    address: "",
    city: "",
    country: "AE",
    website: "",
    notes: "",
};

interface CustomerModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (customer: { id: string; name: string }) => void;
    initialData?: Partial<FormValues>;
    id?: string;
}

export function CustomerModal({
    open,
    onClose,
    onSuccess,
    initialData,
    id,
}: CustomerModalProps) {
    const isEdit = Boolean(id);
    const [saving, setSaving] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: DEFAULT_VALUES,
    });

    useEffect(() => {
        if (open) {
            form.reset(initialData ? { ...DEFAULT_VALUES, ...initialData } : DEFAULT_VALUES);
        }
    }, [open, initialData, form]);

    function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error("Image must be smaller than 2MB");
            return;
        }

        if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
            toast.error("Only JPG, PNG, GIF or WebP images are allowed");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            form.setValue("image", reader.result as string, { shouldDirty: true });
        };
        reader.readAsDataURL(file);
    }

    async function onSubmit(values: FormValues) {
        setSaving(true);
        try {
            const url = isEdit ? `/api/customers/${id}` : "/api/customers";
            const method = isEdit ? "PATCH" : "POST";
            const body = {
                name: values.name,
                type: values.type,
                email: values.email || null,
                phone: values.phone || null,
                mobile: values.mobile || null,
                image: values.image || null,
                website: values.website || null,
                trn: values.taxRegistrationNumber || null,
                isVatRegistered: Boolean(values.taxRegistrationNumber),
                addressLine1: values.address || null,
                city: values.city || null,
                country: values.country || "AE",
                notes: values.notes || null,
            };
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error ?? "Failed to save customer");
                return;
            }
            const data = await res.json();
            toast.success(isEdit ? "Customer updated" : "Customer created");
            onSuccess(data);
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="w-[96vw] max-w-[46rem] overflow-hidden p-0 sm:max-w-[46rem]">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle>{isEdit ? "Edit Customer" : "New Customer"}</DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[74vh] px-6">
                    <Form {...form}>
                        <form
                            id="customer-form"
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="space-y-4 py-4 pb-8"
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                className="hidden"
                                onChange={handleImageChange}
                            />

                            <div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-4">
                                <div className="relative">
                                    <Avatar className="h-16 w-16 border bg-background">
                                        <AvatarImage src={form.watch("image") || undefined} alt={form.watch("name") || "Customer"} />
                                        <AvatarFallback className="text-base font-semibold">
                                            {form.watch("name")
                                                ? form.watch("name").split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
                                                : <User className="h-5 w-5" />}
                                        </AvatarFallback>
                                    </Avatar>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Camera className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div>
                                    <p className="font-medium">Customer Image</p>
                                    <p className="text-sm text-muted-foreground">
                                        Upload a logo or contact image for customer lists and records.
                                    </p>
                                </div>
                            </div>

                            {/* Basic */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem className="sm:col-span-2">
                                            <FormLabel>
                                                Name <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Acme Trading LLC" {...field} />
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
                                                <Input
                                                    type="email"
                                                    placeholder="billing@acme.ae"
                                                    {...field}
                                                />
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
                                    name="mobile"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Mobile</FormLabel>
                                            <FormControl>
                                                <Input placeholder="+971 5X XXX XXXX" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="website"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Website</FormLabel>
                                            <FormControl>
                                                <Input placeholder="https://acme.ae" {...field} />
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
                                                <Input placeholder="Office 101, Building Name" {...field} />
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
                                                <CountrySelect
                                                    value={field.value ?? "AE"}
                                                    onChange={field.onChange}
                                                />
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
                                                placeholder="Internal notes about this customer..."
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
                    <Button type="submit" form="customer-form" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEdit ? "Save Changes" : "Create Customer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
