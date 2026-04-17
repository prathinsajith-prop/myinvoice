"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Edit, Building2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierModal } from "@/components/modals/supplier-modal";
import { BillSheet } from "@/components/modals/bill-sheet";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";

interface Bill { id: string; billNumber: string; status: string; total: number; outstanding: number; issueDate: string; dueDate: string }

interface Supplier {
    id: string;
    name: string;
    type: string;
    email: string;
    phone: string;
    mobile: string;
    website: string;
    trn: string;
    isActive: boolean;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankIban: string;
    bankName: string;
    notes: string | null;
    totalBilled: number;
    outstanding: number;
    bills: Bill[];
}

export default function SupplierDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [loading, setLoading] = useState(true);
    const [editOpen, setEditOpen] = useState(false);
    const [billSheetOpen, setBillSheetOpen] = useState(false);

    const fetchSupplier = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/suppliers/${params.id}`);
            if (res.ok) setSupplier(await res.json());
            else {
                toast.error("Supplier not found");
                router.push("/suppliers");
            }
        } finally {
            setLoading(false);
        }
    }, [params.id, router]);

    useEffect(() => { fetchSupplier(); }, [fetchSupplier]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!supplier) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/suppliers"><ChevronLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
                            {!supplier.isActive && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                        <p className="text-muted-foreground text-sm capitalize">{supplier.type?.toLowerCase()}</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />Edit
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left sidebar */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Contact Details</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            {supplier.email && (
                                <div><span className="text-muted-foreground block text-xs">Email</span>{supplier.email}</div>
                            )}
                            {supplier.phone && (
                                <div><span className="text-muted-foreground block text-xs">Phone</span>{supplier.phone}</div>
                            )}
                            {supplier.mobile && (
                                <div><span className="text-muted-foreground block text-xs">Mobile</span>{supplier.mobile}</div>
                            )}
                            {supplier.website && (
                                <div>
                                    <span className="text-muted-foreground block text-xs">Website</span>
                                    <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                        {supplier.website}
                                    </a>
                                </div>
                            )}
                            {supplier.trn && (
                                <div><span className="text-muted-foreground block text-xs">TRN</span>{supplier.trn}</div>
                            )}
                        </CardContent>
                    </Card>

                    {(supplier.addressLine1 || supplier.city) && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Address</CardTitle></CardHeader>
                            <CardContent className="text-sm text-muted-foreground space-y-0.5">
                                {supplier.addressLine1 && <p>{supplier.addressLine1}</p>}
                                {supplier.addressLine2 && <p>{supplier.addressLine2}</p>}
                                {(supplier.city || supplier.state) && (
                                    <p>{[supplier.city, supplier.state].filter(Boolean).join(", ")}</p>
                                )}
                                {supplier.postalCode && <p>{supplier.postalCode}</p>}
                                {supplier.country && <p>{supplier.country}</p>}
                            </CardContent>
                        </Card>
                    )}

                    {(supplier.bankAccountNumber || supplier.bankIban) && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Banking</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {supplier.bankName && (
                                    <div><span className="text-muted-foreground block text-xs">Bank</span>{supplier.bankName}</div>
                                )}
                                {supplier.bankAccountName && (
                                    <div><span className="text-muted-foreground block text-xs">Account Name</span>{supplier.bankAccountName}</div>
                                )}
                                {supplier.bankAccountNumber && (
                                    <div><span className="text-muted-foreground block text-xs">Account Number</span>{supplier.bankAccountNumber}</div>
                                )}
                                {supplier.bankIban && (
                                    <div><span className="text-muted-foreground block text-xs">IBAN</span>{supplier.bankIban}</div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Billed</span>
                                <span className="font-medium">{currency} {Number(supplier.totalBilled || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Outstanding</span>
                                <span className={`font-medium ${Number(supplier.outstanding) > 0 ? "text-amber-600" : ""}`}>
                                    {currency} {Number(supplier.outstanding || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Bill history */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base">Bill History</CardTitle>
                            <Button size="sm" onClick={() => setBillSheetOpen(true)}>
                                New Bill
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {!supplier.bills || supplier.bills.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Building2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
                                    <p className="text-sm text-muted-foreground">No bills yet</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead>Bill #</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Due</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-right">Outstanding</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {supplier.bills.map((bill) => (
                                            <TableRow
                                                key={bill.id}
                                                className="cursor-pointer hover:bg-muted/30"
                                                onClick={() => router.push(`/bills/${bill.id}`)}
                                            >
                                                <TableCell className="font-medium">{bill.billNumber}</TableCell>
                                                <TableCell className="text-muted-foreground">{new Date(bill.issueDate).toLocaleDateString("en-AE")}</TableCell>
                                                <TableCell className="text-muted-foreground">{new Date(bill.dueDate).toLocaleDateString("en-AE")}</TableCell>
                                                <TableCell className="text-right tabular-nums">{currency} {Number(bill.total).toFixed(2)}</TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    <span className={Number(bill.outstanding) > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                                                        {currency} {Number(bill.outstanding).toFixed(2)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={bill.status} />
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
            <SupplierModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                onSuccess={() => { setEditOpen(false); fetchSupplier(); }}
                initialData={{
                    name: supplier.name,
                    email: supplier.email ?? "",
                    phone: supplier.phone ?? "",
                    type: (supplier.type as "BUSINESS" | "INDIVIDUAL") ?? "BUSINESS",
                    taxRegistrationNumber: supplier.trn ?? "",
                    address: supplier.addressLine1 ?? "",
                    city: supplier.city ?? "",
                    country: supplier.country ?? "",
                    website: supplier.website ?? "",
                    bankAccountNumber: supplier.bankAccountNumber ?? "",
                    bankAccountName: supplier.bankAccountName ?? "",
                    iban: supplier.bankIban ?? "",
                    notes: supplier.notes ?? "",
                }}
                id={supplier.id}
            />
            <BillSheet
                open={billSheetOpen}
                onClose={() => setBillSheetOpen(false)}
                onSuccess={(bill) => {
                    setBillSheetOpen(false);
                    router.push(`/bills/${bill.id}`);
                }}
                defaultSupplierId={supplier.id}
            />
        </div>
    );
}
