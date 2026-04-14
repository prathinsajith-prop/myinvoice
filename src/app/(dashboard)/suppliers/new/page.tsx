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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const formSchema = z.object({
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
type FormValues = z.infer<typeof formSchema>;

export default function NewSupplierPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as Resolver<FormValues>,
        defaultValues: { name: "", email: "", phone: "", type: "BUSINESS", taxRegistrationNumber: "", address: "", city: "", country: "AE", website: "", bankAccountNumber: "", bankAccountName: "", iban: "", notes: "" },
    });

    async function onSubmit(values: FormValues) {
        setSaving(true);
        try {
            const res = await fetch("/api/suppliers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v || null]))),
            });
            if (!res.ok) { const err = await res.json(); toast.error(err.error ?? "Failed"); return; }
            const supplier = await res.json();
            toast.success("Supplier created");
            router.push(`/suppliers/${supplier.id}`);
        } finally { setSaving(false); }
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild><Link href="/suppliers"><ArrowLeft className="h-4 w-4" /></Link></Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">New Supplier</h1>
                    <p className="text-muted-foreground">Add a new supplier to your directory</p>
                </div>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>Supplier Name <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input placeholder="e.g. Emirates Paper Supply" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="type" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="BUSINESS">Business</SelectItem>
                                                <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="taxRegistrationNumber" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>TRN</FormLabel>
                                        <FormControl><Input placeholder="100XXXXXXXXX003" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="email" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl><Input type="email" placeholder="supplier@company.ae" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="phone" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone</FormLabel>
                                        <FormControl><Input placeholder="+971 4 000 0000" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="address" render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>Address</FormLabel>
                                        <FormControl><Input placeholder="Office 123, Building, Street" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="city" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>City</FormLabel>
                                        <FormControl><Input placeholder="Dubai" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="country" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Country</FormLabel>
                                        <FormControl><Input placeholder="AE" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-base">Banking Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="bankAccountName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Account Name</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="bankAccountNumber" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Account Number</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="iban" render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>IBAN</FormLabel>
                                        <FormControl><Input placeholder="AE00 0000 0000 0000 0000 000" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                        <CardContent>
                            <FormField control={form.control} name="notes" render={({ field }) => (
                                <FormItem>
                                    <FormControl><Textarea placeholder="Internal notes..." rows={3} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" asChild><Link href="/suppliers">Cancel</Link></Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Supplier
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
