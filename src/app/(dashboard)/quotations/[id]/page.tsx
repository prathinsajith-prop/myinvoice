"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, CheckCircle, XCircle, Send, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface LineItem { id: string; description: string; quantity: number; unitPrice: number; discountPercent: number; vatTreatment: string; vatAmount: number; lineTotal: number }

interface Quotation {
    id: string;
    quotationNumber: string;
    status: string;
    issueDate: string;
    validUntil: string;
    currency: string;
    subtotal: number;
    discountAmount: number;
    vatAmount: number;
    total: number;
    notes: string;
    termsAndConditions: string;
    customer: { id: string; name: string; email: string; phone: string; trn: string };
    lineItems: LineItem[];
    convertedInvoiceId?: string;
}

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    DRAFT: { variant: "secondary", label: "Draft" },
    SENT: { variant: "default", label: "Sent" },
    VIEWED: { variant: "default", label: "Viewed" },
    ACCEPTED: { variant: "default", label: "Accepted" },
    REJECTED: { variant: "destructive", label: "Rejected" },
    CONVERTED: { variant: "secondary", label: "Converted" },
    EXPIRED: { variant: "destructive", label: "Expired" },
};

export default function QuotationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [loading, setLoading] = useState(true);
    const [convertOpen, setConvertOpen] = useState(false);
    const [acting, setActing] = useState(false);

    const fetchQuotation = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/quotations/${params.id}`);
            if (res.ok) setQuotation(await res.json());
            else router.push("/quotations");
        } finally {
            setLoading(false);
        }
    }, [params.id, router]);

    useEffect(() => { fetchQuotation(); }, [fetchQuotation]);

    async function doConvert() {
        setActing(true);
        try {
            const res = await fetch(`/api/quotations/${params.id}/convert`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to convert");
            toast.success("Quotation converted to invoice");
            router.push(`/invoices/${data.invoiceId}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to convert");
        } finally {
            setActing(false);
            setConvertOpen(false);
        }
    }

    async function updateStatus(status: string) {
        setActing(true);
        try {
            const res = await fetch(`/api/quotations/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            toast.success(`Quotation marked as ${status.toLowerCase()}`);
            fetchQuotation();
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

    if (!quotation) return null;

    const statusInfo = STATUS_BADGE[quotation.status] ?? { variant: "secondary" as const, label: quotation.status };
    const canConvert = quotation.status === "ACCEPTED";
    const canSend = quotation.status === "DRAFT";
    const canAccept = ["SENT", "VIEWED"].includes(quotation.status);
    const canReject = ["SENT", "VIEWED", "ACCEPTED"].includes(quotation.status);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/quotations"><ChevronLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{quotation.quotationNumber}</h1>
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">{quotation.customer?.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {canSend && (
                        <Button variant="outline" size="sm" onClick={() => updateStatus("SENT")} disabled={acting}>
                            <Send className="mr-2 h-4 w-4" />Mark Sent
                        </Button>
                    )}
                    {canAccept && (
                        <Button variant="outline" size="sm" onClick={() => updateStatus("ACCEPTED")} disabled={acting}>
                            <CheckCircle className="mr-2 h-4 w-4" />Accept
                        </Button>
                    )}
                    {canReject && (
                        <Button variant="outline" size="sm" onClick={() => updateStatus("REJECTED")} disabled={acting}>
                            <XCircle className="mr-2 h-4 w-4" />Reject
                        </Button>
                    )}
                    {canConvert && (
                        <Button size="sm" onClick={() => setConvertOpen(true)} disabled={acting}>
                            <ArrowRight className="mr-2 h-4 w-4" />Convert to Invoice
                        </Button>
                    )}
                    {quotation.convertedInvoiceId && (
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/invoices/${quotation.convertedInvoiceId}`}>
                                View Invoice <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
                        <CardContent className="space-y-1.5 text-sm">
                            <Link href={`/customers/${quotation.customer?.id}`} className="font-semibold hover:underline">
                                {quotation.customer?.name}
                            </Link>
                            {quotation.customer?.email && <p className="text-muted-foreground">{quotation.customer.email}</p>}
                            {quotation.customer?.phone && <p className="text-muted-foreground">{quotation.customer.phone}</p>}
                            {quotation.customer?.trn && <p className="text-muted-foreground">TRN: {quotation.customer.trn}</p>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Quote #</span>
                                <span className="font-medium">{quotation.quotationNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Issue Date</span>
                                <span>{new Date(quotation.issueDate).toLocaleDateString("en-AE")}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Valid Until</span>
                                <span>{new Date(quotation.validUntil).toLocaleDateString("en-AE")}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Currency</span>
                                <span>{quotation.currency}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>{Number(quotation.subtotal).toFixed(2)}</span>
                            </div>
                            {Number(quotation.discountAmount) > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Discount</span>
                                    <span className="text-green-600">− {Number(quotation.discountAmount).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">VAT</span>
                                <span>{Number(quotation.vatAmount).toFixed(2)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-semibold">
                                <span>Total</span>
                                <span>{quotation.currency} {Number(quotation.total).toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

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
                                        {quotation.lineItems?.map((item) => (
                                            <tr key={item.id} className="border-b">
                                                <td className="px-4 py-2">{item.description}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{Number(item.quantity)}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{Number(item.unitPrice).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{Number(item.discountPercent).toFixed(0)}%</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{Number(item.vatAmount).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right tabular-nums font-medium">{Number(item.lineTotal).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {(quotation.notes || quotation.termsAndConditions) && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Notes & Terms</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {quotation.notes && <div><p className="font-medium mb-1">Notes</p><p className="text-muted-foreground whitespace-pre-wrap">{quotation.notes}</p></div>}
                                {quotation.termsAndConditions && <div><p className="font-medium mb-1">Terms & Conditions</p><p className="text-muted-foreground whitespace-pre-wrap">{quotation.termsAndConditions}</p></div>}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <AlertDialog open={convertOpen} onOpenChange={setConvertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Convert to Invoice?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will create a new invoice from {quotation.quotationNumber} and mark this quotation as converted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={doConvert} disabled={acting}>
                            {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Convert to Invoice
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
