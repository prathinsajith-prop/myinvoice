"use client";

import { useDeferredValue, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, MoreHorizontal, Truck, Mail, Phone, Loader2, Eye, Pencil, FileText } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { SupplierModal } from "@/components/modals/supplier-modal";
import { BillSheet } from "@/components/modals/bill-sheet";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Supplier {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    type: string;
    totalBilled: number;
    totalOutstanding: number;
    billCount: number;
    isActive: boolean;
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export default function SuppliersPage() {
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const createParamHandled = useRef(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Record<string, unknown> | undefined>(undefined);
    const [billOpen, setBillOpen] = useState(false);
    const [billSupplierId, setBillSupplierId] = useState<string | undefined>(undefined);
    const deferredSearch = useDeferredValue(search);
    const normalizedSearch = deferredSearch.trim();

    useEffect(() => {
        if (createParamHandled.current) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("create") === "1") {
            setCreateOpen(true);
        }
        createParamHandled.current = true;
    }, []);

    const fetchSuppliers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (normalizedSearch) params.set("search", normalizedSearch);
            const res = await fetch(`/api/suppliers?${params}`);
            if (res.ok) {
                const data = await res.json();
                setSuppliers(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, normalizedSearch]);

    useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

    const handleSearchChange = (value: string) => {
        setPage(1);
        setSearch(value);
    };

    const columns = useMemo<ColumnDef<Supplier>[]>(() => [
        {
            id: "name",
            header: "Supplier",
            accessorFn: (row) => row.name,
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.name}</div>
                    <div className="text-xs text-muted-foreground">
                        {row.original.billCount} bill{row.original.billCount !== 1 ? "s" : ""}
                    </div>
                </div>
            ),
        },
        {
            id: "contact",
            header: "Contact",
            cell: ({ row }) => (
                <div className="flex flex-col gap-0.5">
                    {row.original.email && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />{row.original.email}
                        </span>
                    )}
                    {row.original.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />{row.original.phone}
                        </span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "type",
            header: "Type",
            cell: ({ row }) => (
                <Badge variant="outline" className="text-xs capitalize">
                    {(row.getValue("type") as string)?.toLowerCase() ?? "business"}
                </Badge>
            ),
        },
        {
            accessorKey: "totalBilled",
            header: () => <div className="text-right">Total Billed</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {currency} {Number(row.getValue("totalBilled")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                </div>
            ),
        },
        {
            accessorKey: "totalOutstanding",
            header: () => <div className="text-right">Outstanding</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    <span className={Number(row.getValue("totalOutstanding")) > 0 ? "text-amber-600 font-medium" : ""}>
                        {currency} {Number(row.getValue("totalOutstanding")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "isActive",
            header: "Status",
            cell: ({ row }) => (
                <Badge variant={row.getValue("isActive") ? "default" : "secondary"} className="text-xs">
                    {row.getValue("isActive") ? "Active" : "Inactive"}
                </Badge>
            ),
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="View"
                        onClick={() => router.push(`/suppliers/${row.original.id}`)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit"
                        onClick={() => openEdit(row.original.id)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setBillSupplierId(row.original.id); setBillOpen(true); }}>
                                <FileText className="mr-2 h-4 w-4" />
                                New Bill
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ], [currency, router]);

    async function openEdit(id: string) {
        const res = await fetch(`/api/suppliers/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setEditData({
            name: data.name ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
            type: data.type ?? "BUSINESS",
            taxRegistrationNumber: data.trn ?? "",
            address: data.addressLine1 ?? "",
            city: data.city ?? "",
            country: data.country ?? "AE",
            website: data.website ?? "",
            bankAccountNumber: data.bankAccountNumber ?? "",
            bankAccountName: data.bankAccountName ?? "",
            iban: data.bankIban ?? "",
            notes: data.notes ?? "",
        });
        setEditId(id);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
                    <p className="text-muted-foreground">
                        {pagination ? `${pagination.total} total suppliers` : "Manage your supplier directory"}
                    </p>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Supplier
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search suppliers..."
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : suppliers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Truck className="h-10 w-10 text-muted-foreground/40 mb-3" />
                            <p className="text-sm font-medium">No suppliers found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {normalizedSearch ? "Try a different search term" : "Add your first supplier"}
                            </p>
                            {!normalizedSearch && (
                                <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Supplier
                                </Button>
                            )}
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={suppliers}
                            onRowClick={(supplier) => router.push(`/suppliers/${supplier.id}`)}
                        />
                    )}
                    {pagination && pagination.pages > 1 && (
                        <div className="flex items-center justify-between border-t px-4 py-3">
                            <p className="text-sm text-muted-foreground">
                                Showing {(pagination.page - 1) * pagination.limit + 1}–
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                                <Button variant="outline" size="sm" disabled={page === pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <SupplierModal
                open={createOpen || editId !== null}
                onClose={() => { setCreateOpen(false); setEditId(null); setEditData(undefined); }}
                onSuccess={() => { fetchSuppliers(); setCreateOpen(false); setEditId(null); setEditData(undefined); }}
                initialData={editData as Record<string, string>}
                id={editId ?? undefined}
            />

            <BillSheet
                open={billOpen}
                onClose={() => { setBillOpen(false); setBillSupplierId(undefined); }}
                onSuccess={() => { setBillOpen(false); }}
                defaultSupplierId={billSupplierId}
            />
        </div>
    );
}
