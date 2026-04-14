"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Plus,
    Search,
    MoreHorizontal,
    Building2,
    Mail,
    Phone,
    ArrowUpDown,
    Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    type: string;
    totalInvoiced: number;
    totalOutstanding: number;
    invoiceCount: number;
    isActive: boolean;
    createdAt: string;
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export default function CustomersPage() {
    const router = useRouter();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (debouncedSearch) params.set("search", debouncedSearch);
            const res = await fetch(`/api/customers?${params}`);
            if (res.ok) {
                const data = await res.json();
                setCustomers(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
                    <p className="text-muted-foreground">
                        {pagination ? `${pagination.total} total customers` : "Manage your customer directory"}
                    </p>
                </div>
                <Button asChild>
                    <Link href="/customers/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Customer
                    </Link>
                </Button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Customers
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pagination?.total ?? "-"}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Invoiced
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            AED{" "}
                            {customers
                                .reduce((s, c) => s + Number(c.totalInvoiced), 0)
                                .toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">
                            AED{" "}
                            {customers
                                .reduce((s, c) => s + Number(c.totalOutstanding), 0)
                                .toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search customers..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                            <p className="text-sm font-medium">No customers found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {debouncedSearch
                                    ? "Try a different search term"
                                    : "Add your first customer to get started"}
                            </p>
                            {!debouncedSearch && (
                                <Button asChild className="mt-4" size="sm">
                                    <Link href="/customers/new">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Customer
                                    </Link>
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                            <button className="flex items-center gap-1 hover:text-foreground">
                                                Customer <ArrowUpDown className="h-3 w-3" />
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                            Contact
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                                            Invoiced
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                                            Outstanding
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                            Status
                                        </th>
                                        <th className="px-4 py-3 w-10" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {customers.map((customer) => (
                                        <tr
                                            key={customer.id}
                                            className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                                            onClick={() => router.push(`/customers/${customer.id}`)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{customer.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {customer.invoiceCount} invoice{customer.invoiceCount !== 1 ? "s" : ""}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-0.5">
                                                    {customer.email && (
                                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Mail className="h-3 w-3" />
                                                            {customer.email}
                                                        </span>
                                                    )}
                                                    {customer.phone && (
                                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Phone className="h-3 w-3" />
                                                            {customer.phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className="text-xs capitalize">
                                                    {customer.type?.toLowerCase() ?? "business"}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                AED{" "}
                                                {Number(customer.totalInvoiced).toLocaleString("en-AE", {
                                                    minimumFractionDigits: 2,
                                                })}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                <span
                                                    className={
                                                        Number(customer.totalOutstanding) > 0 ? "text-amber-600 font-medium" : ""
                                                    }
                                                >
                                                    AED{" "}
                                                    {Number(customer.totalOutstanding).toLocaleString("en-AE", {
                                                        minimumFractionDigits: 2,
                                                    })}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={customer.isActive ? "default" : "secondary"} className="text-xs">
                                                    {customer.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </td>
                                            <td
                                                className="px-4 py-3"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/customers/${customer.id}`}>View</Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/customers/${customer.id}/edit`}>Edit</Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/invoices/new?customerId=${customer.id}`}>
                                                                New Invoice
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination && pagination.pages > 1 && (
                        <div className="flex items-center justify-between border-t px-4 py-3">
                            <p className="text-sm text-muted-foreground">
                                Showing {(pagination.page - 1) * pagination.limit + 1}–
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                                {pagination.total}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === pagination.pages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
