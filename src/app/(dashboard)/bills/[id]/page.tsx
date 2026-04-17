"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, CheckCircle, XCircle, PackageCheck, Printer, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    vatTreatment: string;
    vatAmount: number;
    total: number;
}

interface PaymentLink {
    paymentOut: {
        id: string;
        paymentNumber: string;
        amount: number;
        paymentDate: string;
        method: string;
    };
}

interface Bill {
    id: string;
    billNumber: string;
    status: string;
    issueDate: string;
    dueDate: string;
    currency: string;
    supplierInvoiceNumber: string | null;
    reference: string | null;
    notes: string | null;
    internalNotes: string | null;
    subtotal: number;
    discount: number;
    totalVat: number;
    total: number;
    amountPaid: number;
    outstanding: number;
    supplier: { id: string; name: string; email: string | null; phone: string | null; trn: string | null };
    lineItems: LineItem[];
    paymentsOut: PaymentLink[];
}

export default function BillDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [bill, setBill] = useState<Bill | null>(null);
    const [loading, setLoading] = useState(true);
    const [voidOpen, setVoidOpen] = useState(false);
    const [acting, setActing] = useState(false);

    const fetchBill = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/bills/${params.id}`);
            if (res.ok) setBill(await res.json());
            else router.push("/bills");
        } finally {
            setLoading(false);
        }
    }, [params.id, router]);

    useEffect(() => { fetchBill(); }, [fetchBill]);

    async function doVoid() {
        setActing(true);
        try {
            const res = await fetch(`/api/bills/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "VOID" }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            toast.success("Bill voided");
            fetchBill();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to void bill");
        } finally {
            setActing(false);
            setVoidOpen(false);
        }
    }

    async function markReceived() {
        setActing(true);
        try {
            const res = await fetch(`/api/bills/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "RECEIVED" }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            toast.success("Bill marked as received");
            fetchBill();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
        } finally {
            setActing(false);
        }
    }

    async function markPaid() {
        setActing(true);
        try {
            const res = await fetch(`/api/bills/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "PAID" }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            toast.success("Bill marked as paid");
            fetchBill();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to mark as paid");
        } finally {
            setActing(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!bill) return null;

    const canVoid = !["VOID", "PAID", "PARTIALLY_PAID"].includes(bill.status) && Number(bill.amountPaid) <= 0.01;
    const canPay = !["PAID", "VOID"].includes(bill.status) && Number(bill.outstanding) > 0;
    const canReceive = bill.status === "DRAFT";
    const isOverdue = !["PAID", "VOID"].includes(bill.status) && new Date(bill.dueDate) < new Date();
    const shareText = encodeURIComponent(
        `Bill ${bill.billNumber}\nAmount: ${bill.currency} ${Number(bill.total).toFixed(2)}\nOutstanding: ${bill.currency} ${Number(bill.outstanding).toFixed(2)}`
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/bills"><ChevronLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{bill.billNumber}</h1>
                            <StatusBadge status={bill.status} />
                        </div>
                        <p className="text-muted-foreground text-sm">{bill.supplier?.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canReceive && (
                        <Button variant="outline" size="sm" onClick={markReceived} disabled={acting}>
                            <PackageCheck className="mr-2 h-4 w-4" />
                            Mark Received
                        </Button>
                    )}
                    {canPay && (
                        <Button variant="outline" size="sm" onClick={markPaid} disabled={acting}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark Paid
                        </Button>
                    )}
                    {canVoid && (
                        <Button variant="destructive" size="sm" onClick={() => setVoidOpen(true)} disabled={acting}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Void
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                        <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-4 w-4" />
                        </a>
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Sidebar */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Supplier</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <Link href={`/suppliers/${bill.supplier?.id}`} className="font-semibold hover:underline">
                                {bill.supplier?.name}
                            </Link>
                            {bill.supplier?.email && <p className="text-muted-foreground">{bill.supplier.email}</p>}
                            {bill.supplier?.phone && <p className="text-muted-foreground">{bill.supplier.phone}</p>}
                            {bill.supplier?.trn && <p className="text-muted-foreground">TRN: {bill.supplier.trn}</p>}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Bill #</span>
                                <span className="font-medium">{bill.billNumber}</span>
                            </div>
                            {bill.supplierInvoiceNumber && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Supplier Ref</span>
                                    <span>{bill.supplierInvoiceNumber}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Bill Date</span>
                                <span>{new Date(bill.issueDate).toLocaleDateString("en-AE")}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Due Date</span>
                                <span className={isOverdue ? "text-destructive font-medium" : ""}>
                                    {new Date(bill.dueDate).toLocaleDateString("en-AE")}
                                    {isOverdue && " (Overdue)"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Currency</span>
                                <span>{bill.currency}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>{bill.currency} {Number(bill.subtotal).toFixed(2)}</span>
                            </div>
                            {Number(bill.discount) > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Discount</span>
                                    <span className="text-green-600">− {bill.currency} {Number(bill.discount).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">VAT</span>
                                <span>{bill.currency} {Number(bill.totalVat).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Paid</span>
                                <span>{bill.currency} {Number(bill.amountPaid).toFixed(2)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-semibold">
                                <span>Total</span>
                                <span>{bill.currency} {Number(bill.total).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-amber-600 font-medium">
                                <span>Outstanding</span>
                                <span>{bill.currency} {Number(bill.outstanding).toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main content */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Unit Price</TableHead>
                                            <TableHead className="text-right">Disc%</TableHead>
                                            <TableHead className="text-right">VAT</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {bill.lineItems?.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{item.description}</TableCell>
                                                <TableCell className="text-right tabular-nums">{Number(item.quantity)}</TableCell>
                                                <TableCell className="text-right tabular-nums">{bill.currency} {Number(item.unitPrice).toFixed(2)}</TableCell>
                                                <TableCell className="text-right tabular-nums">{Number(item.discount).toFixed(0)}%</TableCell>
                                                <TableCell className="text-right tabular-nums">{bill.currency} {Number(item.vatAmount).toFixed(2)}</TableCell>
                                                <TableCell className="text-right tabular-nums font-medium">{bill.currency} {Number(item.total).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {bill.paymentsOut && bill.paymentsOut.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead>Payment #</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Method</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {bill.paymentsOut.map((link) => (
                                            <TableRow key={link.paymentOut.id}>
                                                <TableCell className="font-medium">{link.paymentOut.paymentNumber}</TableCell>
                                                <TableCell>{new Date(link.paymentOut.paymentDate).toLocaleDateString("en-AE")}</TableCell>
                                                <TableCell className="capitalize">{link.paymentOut.method?.toLowerCase().replace(/_/g, " ")}</TableCell>
                                                <TableCell className="text-right tabular-nums font-medium">
                                                    {bill.currency} {Number(link.paymentOut.amount).toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {(bill.notes || bill.internalNotes) && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {bill.notes && (
                                    <div>
                                        <p className="font-medium mb-1">Notes</p>
                                        <p className="text-muted-foreground whitespace-pre-wrap">{bill.notes}</p>
                                    </div>
                                )}
                                {bill.internalNotes && (
                                    <div>
                                        <p className="font-medium mb-1">Internal Notes</p>
                                        <p className="text-muted-foreground whitespace-pre-wrap">{bill.internalNotes}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Void dialog */}
            <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Void this bill?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will mark the bill as void. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={doVoid}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Void Bill
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
