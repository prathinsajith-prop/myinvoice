"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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

interface Customer {
    id: string;
    name: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    type: string;
    taxRegistrationNumber: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    website: string | null;
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

const STATUS_COLORS: Record<string, string> = {
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
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/customers/${id}`)
            .then((r) => {
                if (r.status === 404) { router.push("/customers"); return null; }
                return r.json();
            })
            .then((data) => data && setCustomer(data))
            .finally(() => setLoading(false));
    }, [id, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
                            <Badge variant={customer.isActive ? "default" : "secondary"}>
                                {customer.isActive ? "Active" : "Inactive"}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">
                            {customer.type?.toLowerCase() ?? "Business"} Customer
                            {customer.taxRegistrationNumber && ` · TRN: ${customer.taxRegistrationNumber}`}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href={`/invoices/new?customerId=${customer.id}`}>
                            <Receipt className="mr-2 h-4 w-4" />
                            New Invoice
                        </Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href={`/customers/${customer.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                        </Link>
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
                                    AED {Number(customer.totalInvoiced).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total Paid</span>
                                <span className="font-medium text-emerald-600">
                                    AED {Number(customer.totalPaid).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Outstanding</span>
                                <span className={`font-semibold ${Number(customer.totalOutstanding) > 0 ? "text-amber-600" : ""}`}>
                                    AED {Number(customer.totalOutstanding).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
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
                            {(customer.address || customer.city) && (
                                <div className="flex items-start gap-2 text-sm">
                                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span>
                                        {[customer.address, customer.city, customer.country]
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
                            <Button size="sm" asChild>
                                <Link href={`/invoices/new?customerId=${customer.id}`}>
                                    <Receipt className="mr-2 h-3 w-3" />
                                    New Invoice
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {customer.invoices.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <FileCheck className="h-8 w-8 text-muted-foreground/40 mb-2" />
                                    <p className="text-sm text-muted-foreground">No invoices yet</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Invoice</th>
                                            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                                            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Amount</th>
                                            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customer.invoices.map((inv) => (
                                            <tr
                                                key={inv.id}
                                                className="border-b hover:bg-muted/30 cursor-pointer"
                                                onClick={() => router.push(`/invoices/${inv.id}`)}
                                            >
                                                <td className="px-4 py-3 font-medium">{inv.invoiceNumber}</td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {new Date(inv.issueDate).toLocaleDateString("en-AE")}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    AED {Number(inv.total).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge
                                                        variant={(STATUS_COLORS[inv.status] as any) ?? "secondary"}
                                                        className="text-xs"
                                                    >
                                                        {inv.status.replace("_", " ")}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
