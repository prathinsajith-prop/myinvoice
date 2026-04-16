"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import {
    ArrowLeft,
    Mail,
    Phone,
    MapPin,
    Globe,
    Receipt,
    FileCheck,
    Loader2,
    Edit,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerModal } from "@/components/modals/customer-modal";
import { InvoiceSheet } from "@/components/modals/invoice-sheet";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { jsonFetcher } from "@/lib/fetcher";

interface Customer {
    id: string;
    name: string;
    displayName: string | null;
    email: string | null;
    image: string | null;
    phone: string | null;
    mobile: string | null;
    type: string;
    trn: string | null;
    unitNumber: string | null;
    buildingName: string | null;
    street: string | null;
    area: string | null;
    city: string | null;
    emirate: string | null;
    country: string | null;
    postalCode: string | null;
    website: string | null;
    notes: string | null;
    isActive: boolean;
    totalInvoiced: number;
    totalOutstanding: number;
    totalPaid: number;
    invoiceCount: number;
    invoices: Array<{
        id: string;
        invoiceNumber: string;
        status: string;
        total: number;
        dueDate: string;
        issueDate: string;
    }>;
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    DRAFT: "secondary",
    SENT: "default",
    PAID: "default",
    OVERDUE: "destructive",
    VOID: "secondary",
    PARTIALLY_PAID: "default",
};

export default function CustomerDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const [editOpen, setEditOpen] = useState(false);
    const [invoiceSheetOpen, setInvoiceSheetOpen] = useState(false);
    const { data: customer, isLoading: loading, mutate } = useSWR<Customer>(
        id ? `/api/customers/${id}` : null,
        async (url: string) => {
            try {
                return await jsonFetcher<Customer>(url);
            } catch (error) {
                if (error instanceof Error && error.message === "Customer not found") {
                    router.push("/customers");
                }
                throw error;
            }
        },
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    if (loading) {
        return (
            <div className="space-y-6">
                {/* Header skeleton */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-md" />
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1.5">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-4 w-28" />
                        </div>
                    </div>
                    <Skeleton className="h-9 w-20 rounded-md" />
                </div>
                {/* Cards skeleton */}
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-lg border bg-card p-5 space-y-3">
                            <Skeleton className="h-5 w-32" />
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="flex gap-3">
                                    <Skeleton className="h-4 w-4" />
                                    <Skeleton className="h-4 w-48" />
                                </div>
                            ))}
                        </div>
                        <div className="rounded-lg border bg-card p-5 space-y-3">
                            <Skeleton className="h-5 w-32" />
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full rounded" />
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-lg border bg-card p-5 space-y-3">
                            <Skeleton className="h-5 w-24" />
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="space-y-1">
                                    <Skeleton className="h-3 w-20" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!customer) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/customers">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <Avatar className="h-14 w-14 rounded-xl border">
                        <AvatarImage src={customer.image ?? undefined} alt={customer.name} />
                        <AvatarFallback className="rounded-xl bg-primary/10 text-primary">
                            {customer.name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
                            <Badge variant={customer.isActive ? "default" : "secondary"}>
                                {customer.isActive ? "Active" : "Inactive"}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">
                            {customer.type?.toLowerCase() ?? "Business"} Customer
                            {customer.trn && ` · TRN: ${customer.trn}`}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setInvoiceSheetOpen(true)}>
                        <Receipt className="mr-2 h-4 w-4" />
                        New Invoice
                    </Button>
                    <Button variant="outline" onClick={() => setEditOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left: info cards */}
                <div className="space-y-6 lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total Invoiced</span>
                                <span className="font-medium">
                                    {currency} {Number(customer.totalInvoiced).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total Paid</span>
                                <span className="font-medium text-emerald-600">
                                    {currency} {Number(customer.totalPaid).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Outstanding</span>
                                <span className={`font-semibold ${Number(customer.totalOutstanding) > 0 ? "text-amber-600" : ""}`}>
                                    {currency} {Number(customer.totalOutstanding).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Contact Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {customer.email && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <a href={`mailto:${customer.email}`} className="hover:underline">
                                        {customer.email}
                                    </a>
                                </div>
                            )}
                            {customer.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    {customer.phone}
                                </div>
                            )}
                            {customer.mobile && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    {customer.mobile}
                                    <span className="text-xs text-muted-foreground">(mobile)</span>
                                </div>
                            )}
                            {(customer.unitNumber || customer.buildingName || customer.street || customer.city) && (
                                <div className="flex items-start gap-2 text-sm">
                                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span>
                                        {[customer.unitNumber, customer.buildingName, customer.street, customer.area, customer.city, customer.emirate, customer.country]
                                            .filter(Boolean)
                                            .join(", ")}
                                    </span>
                                </div>
                            )}
                            {customer.website && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                    <a
                                        href={customer.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline truncate"
                                    >
                                        {customer.website}
                                    </a>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right: invoices list */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <CardTitle className="text-sm font-medium">
                                Invoices ({customer.invoiceCount})
                            </CardTitle>
                            <Button size="sm" onClick={() => setInvoiceSheetOpen(true)}>
                                <Receipt className="mr-2 h-3 w-3" />
                                New Invoice
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {customer.invoices.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <FileCheck className="h-8 w-8 text-muted-foreground/40 mb-2" />
                                    <p className="text-sm text-muted-foreground">No invoices yet</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead>Invoice</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {customer.invoices.map((inv) => (
                                            <TableRow
                                                key={inv.id}
                                                className="cursor-pointer hover:bg-muted/30"
                                                onClick={() => router.push(`/invoices/${inv.id}`)}
                                            >
                                                <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {new Date(inv.issueDate).toLocaleDateString("en-AE")}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {currency} {Number(inv.total).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={STATUS_COLORS[inv.status] ?? "secondary"}
                                                        className="text-xs"
                                                    >
                                                        {inv.status.replace(/_/g, " ")}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
            <CustomerModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                onSuccess={() => {
                    setEditOpen(false);
                    void mutate();
                }}
                initialData={{
                    name: customer.name,
                    email: customer.email ?? "",
                    phone: customer.phone ?? "",
                    mobile: customer.mobile ?? "",
                    image: customer.image ?? "",
                    type: (customer.type as "BUSINESS" | "INDIVIDUAL") ?? "BUSINESS",
                    taxRegistrationNumber: customer.trn ?? "",
                    unitNumber: customer.unitNumber ?? "",
                    buildingName: customer.buildingName ?? "",
                    street: customer.street ?? "",
                    area: customer.area ?? "",
                    city: customer.city ?? "",
                    emirate: customer.emirate ?? "",
                    country: customer.country ?? "",
                    postalCode: customer.postalCode ?? "",
                    website: customer.website ?? "",
                    notes: customer.notes ?? "",
                }}
                id={customer.id}
            />
            <InvoiceSheet
                open={invoiceSheetOpen}
                onClose={() => setInvoiceSheetOpen(false)}
                onSuccess={(invoice) => { setInvoiceSheetOpen(false); router.push(`/invoices/${invoice.id}`); }}
                defaultCustomerId={customer.id}
            />
        </div>
    );
}
