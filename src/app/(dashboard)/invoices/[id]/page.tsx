"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, CheckCircle, XCircle, Send, Printer } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

interface Payment {
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    reference: string;
}

interface Invoice {
    id: string;
    invoiceNumber: string;
    status: string;
    issueDate: string;
    dueDate: string;
    currency: string;
    subtotal: number;
    discount: number;
    taxableAmount: number;
    totalVat: number;
    total: number;
    outstanding: number;
    notes: string;
    terms: string;
    customer: { id: string; name: string; email: string; phone: string; trn: string };
    lineItems: LineItem[];
    payments: Payment[];
}

export default function InvoiceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [voidOpen, setVoidOpen] = useState(false);
    const [payOpen, setPayOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
    const [paymentRef, setPaymentRef] = useState("");
    const [acting, setActing] = useState(false);

    const fetchInvoice = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/invoices/${params.id}`);
            if (res.ok) setInvoice(await res.json());
            else router.push("/invoices");
        } finally {
            setLoading(false);
        }
    }, [params.id, router]);

    useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

    async function doVoid() {
        setActing(true);
        try {
            const res = await fetch(`/api/invoices/${params.id}/void`, { method: "POST" });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            toast.success("Invoice voided");
            fetchInvoice();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to void invoice");
        } finally {
            setActing(false);
            setVoidOpen(false);
        }
    }

    async function doMarkPaid() {
        setActing(true);
        try {
            const res = await fetch(`/api/invoices/${params.id}/mark-paid`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: Number(paymentAmount),
                    paymentDate,
                    reference: paymentRef,
                    paymentMethod: "BANK_TRANSFER",
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            toast.success("Payment recorded");
            fetchInvoice();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to record payment");
        } finally {
            setActing(false);
            setPayOpen(false);
        }
    }

    async function markSent() {
        setActing(true);
        try {
            const res = await fetch(`/api/invoices/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "SENT" }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            toast.success("Invoice marked as sent");
            fetchInvoice();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
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

    if (!invoice) return null;

    const canVoid = !["VOID", "CREDITED"].includes(invoice.status);
    const canPay = !["PAID", "VOID", "CREDITED"].includes(invoice.status);
    const canSend = invoice.status === "DRAFT";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/invoices"><ChevronLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{invoice.invoiceNumber}</h1>
                            <StatusBadge status={invoice.status} />
                        </div>
                        <p className="text-muted-foreground text-sm">{invoice.customer?.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canSend && (
                        <Button variant="outline" size="sm" onClick={markSent} disabled={acting}>
                            <Send className="mr-2 h-4 w-4" />
                            Mark Sent
                        </Button>
                    )}
                    {canPay && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setPaymentAmount(String(Number(invoice.outstanding).toFixed(2)));
                                setPayOpen(true);
                            }}
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Record Payment
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
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left sidebar */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <Link href={`/customers/${invoice.customer?.id}`} className="font-semibold hover:underline">
                                {invoice.customer?.name}
                            </Link>
                            {invoice.customer?.email && <p className="text-muted-foreground">{invoice.customer.email}</p>}
                            {invoice.customer?.phone && <p className="text-muted-foreground">{invoice.customer.phone}</p>}
                            {invoice.customer?.trn && <p className="text-muted-foreground">TRN: {invoice.customer.trn}</p>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Invoice #</span>
                                <span className="font-medium">{invoice.invoiceNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Issue Date</span>
                                <span>{new Date(invoice.issueDate).toLocaleDateString("en-AE")}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Due Date</span>
                                <span>{new Date(invoice.dueDate).toLocaleDateString("en-AE")}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Currency</span>
                                <span>{invoice.currency}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>{Number(invoice.subtotal).toFixed(2)}</span>
                            </div>
                            {Number(invoice.discount) > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Discount</span>
                                    <span className="text-green-600">− {Number(invoice.discount).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">VAT</span>
                                <span>{Number(invoice.totalVat).toFixed(2)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-semibold">
                                <span>Total</span>
                                <span>{invoice.currency} {Number(invoice.total).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-amber-600 font-medium">
                                <span>Outstanding</span>
                                <span>{invoice.currency} {Number(invoice.outstanding).toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right main content */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Description</th>
                                            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Qty</th>
                                            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Unit Price</th>
                                            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Disc%</th>
                                            <th className="px-4 py-2 text-right font-medium text-muted-foreground">VAT</th>
                                            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoice.lineItems?.map((item) => (
                                            <tr key={item.id} className="border-b">
                                                <td className="px-4 py-2">{item.description}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{Number(item.quantity)}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{Number(item.unitPrice).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{Number(item.discount).toFixed(0)}%</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{Number(item.vatAmount).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right tabular-nums font-medium">{Number(item.total).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {invoice.payments && invoice.payments.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                                            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Method</th>
                                            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Reference</th>
                                            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoice.payments.map((p) => (
                                            <tr key={p.id} className="border-b">
                                                <td className="px-4 py-2">{new Date(p.paymentDate).toLocaleDateString("en-AE")}</td>
                                                <td className="px-4 py-2 capitalize">{p.paymentMethod?.toLowerCase().replace("_", " ")}</td>
                                                <td className="px-4 py-2 text-muted-foreground">{p.reference || "—"}</td>
                                                <td className="px-4 py-2 text-right tabular-nums font-medium">{invoice.currency} {Number(p.amount).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}

                    {(invoice.notes || invoice.termsAndConditions) && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Notes & Terms</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {invoice.notes && <div><p className="font-medium mb-1">Notes</p><p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p></div>}
                                {invoice.terms && <div><p className="font-medium mb-1">Terms & Conditions</p><p className="text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p></div>}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Void dialog */}
            <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Void invoice?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will void {invoice.invoiceNumber}. The invoice will no longer be collectible. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={doVoid} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Void Invoice
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Record payment dialog */}
            <AlertDialog open={payOpen} onOpenChange={setPayOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Record Payment</AlertDialogTitle>
                        <AlertDialogDescription>
                            Outstanding: {invoice.currency} {Number(invoice.outstanding).toFixed(2)}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Amount</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Payment Date</Label>
                            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Reference (optional)</Label>
                            <Input placeholder="Transaction reference" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={doMarkPaid} disabled={!paymentAmount || acting}>
                            {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Record Payment
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
