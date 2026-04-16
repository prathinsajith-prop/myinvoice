"use client";

import { useDeferredValue, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Plus,
    MoreHorizontal,
    Building2,
    Mail,
    Phone,
    Eye,
    Pencil,
    FileText,
} from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { ExportDropdown } from "@/components/export-dropdown";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomerModal } from "@/components/modals/customer-modal";
import { DataTable } from "@/components/ui/data-table";
import { InvoiceSheet } from "@/components/modals/invoice-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PaginationControls } from "@/components/pagination-controls";
import { formatAmount } from "@/lib/format";
import { CUSTOMER_TYPE_LABELS } from "@/lib/constants/labels";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    image: string | null;
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
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const createParamHandled = useRef(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Record<string, unknown> | undefined>(undefined);
    const [invoiceOpen, setInvoiceOpen] = useState(false);
    const [invoiceCustomerId, setInvoiceCustomerId] = useState<string | undefined>(undefined);
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

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (normalizedSearch) params.set("search", normalizedSearch);
            if (typeFilter !== "ALL") params.set("type", typeFilter);
            const res = await fetch(`/api/customers?${params}`);
            if (res.ok) {
                const data = await res.json();
                setCustomers(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, normalizedSearch, typeFilter]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    const handleSearchChange = (value: string) => {
        setPage(1);
        setSearch(value);
    };

    const handleTypeFilterChange = (value: string) => {
        setPage(1);
        setTypeFilter(value);
    };

    const columns = useMemo<ColumnDef<Customer>[]>(() => [
        {
            id: "name",
            header: "Customer",
            accessorFn: (row) => row.name,
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border">
                        <AvatarImage src={row.original.image ?? undefined} alt={row.original.name} />
                        <AvatarFallback>
                            {row.original.name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="font-medium">{row.original.name}</div>
                        <div className="text-xs text-muted-foreground">
                            {row.original.invoiceCount} invoice{row.original.invoiceCount !== 1 ? "s" : ""}
                        </div>
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
                <Badge variant="outline" className="text-xs">
                    {CUSTOMER_TYPE_LABELS[row.getValue("type") as string] ?? (row.getValue("type") as string)}
                </Badge>
            ),
        },
        {
            accessorKey: "totalInvoiced",
            header: () => <div className="text-right">Invoiced</div>,
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {currency} {Number(row.getValue("totalInvoiced")).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
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
                <StatusBadge status={row.getValue("isActive") ? "ACTIVE" : "INACTIVE"} />
            ),
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div role="presentation" className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="View"
                        onClick={() => router.push(`/customers/${row.original.id}`)}>
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
                            <DropdownMenuItem onClick={() => { setInvoiceCustomerId(row.original.id); setInvoiceOpen(true); }}>
                                <FileText className="mr-2 h-4 w-4" />
                                New Invoice
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ], [currency, router]);

    async function openEdit(id: string) {
        const res = await fetch(`/api/customers/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setEditData({
            name: data.name ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
            mobile: data.mobile ?? "",
            image: data.image ?? "",
            type: data.type ?? "BUSINESS",
            taxRegistrationNumber: data.trn ?? "",
            unitNumber: data.unitNumber ?? "",
            buildingName: data.buildingName ?? "",
            street: data.street ?? "",
            area: data.area ?? "",
            city: data.city ?? "",
            emirate: data.emirate ?? "",
            country: data.country ?? "AE",
            postalCode: data.postalCode ?? "",
            website: data.website ?? "",
            notes: data.notes ?? "",
        });
        setEditId(id);
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Customers"
                description={pagination ? `${pagination.total} total customers` : "Manage your customer directory"}
                onRefresh={fetchCustomers}
                isRefreshing={loading}
                actions={
                    <>
                        <ExportDropdown
                            data={customers}
                            columns={[
                                { header: "Name", accessor: "name" },
                                { header: "Email", accessor: "email" },
                                { header: "Phone", accessor: "phone" },
                                { header: "Type", accessor: "type" },
                                { header: "Total Invoiced", accessor: "totalInvoiced", format: (v) => formatAmount(v) },
                                { header: "Outstanding", accessor: "totalOutstanding", format: (v) => formatAmount(v) },
                                { header: "Active", accessor: "isActive", format: (v) => v ? "Yes" : "No" },
                            ]}
                            filename="customers"
                            title="Customers Report"
                        />
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Customer
                        </Button>
                    </>
                }
            />

            {/* Stats */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <StatCard label="Total Customers">{pagination?.total ?? "-"}</StatCard>
                <StatCard label="Total Invoiced">
                    {currency}{" "}
                    {formatAmount(customers.reduce((s, c) => s + Number(c.totalInvoiced), 0))}
                </StatCard>
                <StatCard label="Outstanding">
                    <span className="text-amber-600">
                        {currency}{" "}
                        {formatAmount(customers.reduce((s, c) => s + Number(c.totalOutstanding), 0))}
                    </span>
                </StatCard>
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <SearchInput
                            placeholder="Search customers..."
                            value={search}
                            onChange={handleSearchChange}
                        />
                        <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Types</SelectItem>
                                <SelectItem value="BUSINESS">Business</SelectItem>
                                <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <LoadingState />
                    ) : customers.length === 0 ? (
                        <EmptyState
                            icon={Building2}
                            title="No customers found"
                            description={
                                normalizedSearch || typeFilter !== "ALL"
                                    ? "Try adjusting your filters"
                                    : "Add your first customer to get started"
                            }
                            action={
                                !normalizedSearch && typeFilter === "ALL"
                                    ? { label: "Add Customer", onClick: () => setCreateOpen(true) }
                                    : undefined
                            }
                        />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={customers}
                            onRowClick={(customer) => router.push(`/customers/${customer.id}`)}
                        />
                    )}

                    {pagination && (
                        <PaginationControls
                            pagination={pagination}
                            page={page}
                            onPageChange={setPage}
                        />
                    )}
                </CardContent>
            </Card>

            <CustomerModal
                open={createOpen || editId !== null}
                onClose={() => { setCreateOpen(false); setEditId(null); setEditData(undefined); }}
                onSuccess={() => { fetchCustomers(); setCreateOpen(false); setEditId(null); setEditData(undefined); }}
                initialData={editData as Record<string, string>}
                id={editId ?? undefined}
            />

            <InvoiceSheet
                open={invoiceOpen}
                onClose={() => { setInvoiceOpen(false); setInvoiceCustomerId(undefined); }}
                onSuccess={() => { setInvoiceOpen(false); }}
                defaultCustomerId={invoiceCustomerId}
            />
        </div>
    );
}
