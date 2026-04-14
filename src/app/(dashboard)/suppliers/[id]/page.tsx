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

interface Bill { id: string; billNumber: string; status: string; total: number; outstandingAmount: number; billDate: string; dueDate: string }

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
    outstandingAmount: number;
    bills: Bill[];
}

export default function SupplierDetailPage() {
    const params = useParams();
    const router = useRouter();
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
                                <span className="font-medium">AED {Number(supplier.totalBilled || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Outstanding</span>
                                <span className={`font-medium ${Number(supplier.outstandingAmount) > 0 ? "text-amber-600" : ""}`}>
                                    AED {Number(supplier.outstandingAmount || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
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
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Bill #</th>
                                                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                                                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Due</th>
                                                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
                                                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Outstanding</th>
                                                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {supplier.bills.map((bill) => {
                                                return (
                                                    <tr
                                                        key={bill.id}
                                                        className="border-b hover:bg-muted/30 cursor-pointer"
                                                        onClick={() => router.push(`/bills/${bill.id}`)}
                                                    >
                                                        <td className="px-4 py-2 font-medium">{bill.billNumber}</td>
                                                        <td className="px-4 py-2 text-muted-foreground">{new Date(bill.billDate).toLocaleDateString("en-AE")}</td>
                                                        <td className="px-4 py-2 text-muted-foreground">{new Date(bill.dueDate).toLocaleDateString("en-AE")}</td>
                                                        <td className="px-4 py-2 text-right tabular-nums">AED {Number(bill.total).toFixed(2)}</td>
                                                        <td className="px-4 py-2 text-right tabular-nums">
                                                            <span className={Number(bill.outstandingAmount) > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                                                                AED {Number(bill.outstandingAmount).toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <StatusBadge status={bill.status} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
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
