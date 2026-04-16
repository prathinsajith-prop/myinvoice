"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, CheckCircle, XCircle, Send, Printer, Download, Mail, MessageCircle, Plus, Pencil, Trash2 } from "lucide-react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LineItemModal, type LineItemData } from "@/components/modals/line-item-modal";

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
    publicToken?: string | null;
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
    const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [paymentRef, setPaymentRef] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
    const [acting, setActing] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
    const [lineItemModalOpen, setLineItemModalOpen] = useState(false);
    const [editingLineItem, setEditingLineItem] = useState<LineItemData | null>(null);
    const [deletingLineItem, setDeletingLineItem] = useState<LineItemData | null>(null);

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
                    paymentDate: `${paymentDate}T00:00:00.000Z`,
                    reference: paymentRef,
                    method: paymentMethod,
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
        setSendingEmail(true);
        try {
            const res = await fetch(`/api/invoices/${params.id}/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: invoice?.customer?.email }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            toast.success("Invoice sent successfully");
            fetchInvoice();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to send invoice");
        } finally {
            setSendingEmail(false);
        }
    }

    async function createStripeLink() {
        setCreatingPaymentLink(true);
        try {
            const res = await fetch(`/api/invoices/${params.id}/payment-link`, {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create payment link");
            if (!data.url) throw new Error("No payment URL returned");

            window.open(data.url, "_blank", "noopener,noreferrer");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create payment link");
        } finally {
            setCreatingPaymentLink(false);
        }
    }

    async function saveLineItem(data: { id?: string; description: string; quantity: number; unitPrice: number; discount: number; vatTreatment: string; productId?: string }) {
        const url = `/api/invoices/${params.id}/line-items`;
        const isEdit = Boolean(data.id);
        const res = await fetch(url, {
            method: isEdit ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error ?? "Failed to save line item");
        }
        const updated = await res.json();
        setInvoice(updated);
        toast.success(isEdit ? "Line item updated" : "Line item added");
    }

    async function deleteLineItem() {
        if (!deletingLineItem) return;
        setActing(true);
        try {
            const res = await fetch(`/api/invoices/${params.id}/line-items?lineItemId=${deletingLineItem.id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error ?? "Failed to delete line item");
            }
            const updated = await res.json();
            setInvoice(updated);
            toast.success("Line item deleted");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete line item");
        } finally {
            setActing(false);
            setDeletingLineItem(null);
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
    const canSend = !["VOID", "CREDITED"].includes(invoice.status);
    const canEditLines = !["VOID", "CREDITED"].includes(invoice.status);
    const appUrl = typeof window !== "undefined" ? window.location.origin : "";
    const shareText = encodeURIComponent(
        `Invoice ${invoice.invoiceNumber}\nAmount: ${invoice.currency} ${Number(invoice.total).toFixed(2)}\nView: ${appUrl}/portal/${invoice.publicToken || ""}`
    );

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
                        <Button variant="outline" size="sm" onClick={markSent} disabled={sendingEmail || acting}>
                            {sendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                            Send Invoice
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
                    {canPay && (
                        <Button variant="outline" size="sm" onClick={createStripeLink} disabled={creatingPaymentLink}>
                            {creatingPaymentLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Pay Online
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
                        <a href={`/api/invoices/${invoice.id}/pdf`}>
                            <Download className="h-4 w-4" />
                        </a>
                    </Button>
                    {invoice.publicToken && (
                        <Button variant="ghost" size="icon" asChild>
                            <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer">
                                <MessageCircle className="h-4 w-4" />
                            </a>
                        </Button>
                    )}
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
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-base">Line Items</CardTitle>
                            {canEditLines && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setEditingLineItem(null); setLineItemModalOpen(true); }}
                                >
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    Add Item
                                </Button>
                            )}
                        </CardHeader>
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
                                            {canEditLines && <TableHead className="w-[80px]" />}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoice.lineItems?.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{item.description}</TableCell>
                                                <TableCell className="text-right tabular-nums">{Number(item.quantity)}</TableCell>
                                                <TableCell className="text-right tabular-nums">{Number(item.unitPrice).toFixed(2)}</TableCell>
                                                <TableCell className="text-right tabular-nums">{Number(item.discount).toFixed(0)}%</TableCell>
                                                <TableCell className="text-right tabular-nums">{Number(item.vatAmount).toFixed(2)}</TableCell>
                                                <TableCell className="text-right tabular-nums font-medium">{Number(item.total).toFixed(2)}</TableCell>
                                                {canEditLines && (
                                                    <TableCell>
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => { setEditingLineItem(item); setLineItemModalOpen(true); }}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-destructive hover:text-destructive"
                                                                onClick={() => setDeletingLineItem(item)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {invoice.payments && invoice.payments.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead>Date</TableHead>
                                            <TableHead>Method</TableHead>
                                            <TableHead>Reference</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoice.payments.map((p) => (
                                            <TableRow key={p.id}>
                                                <TableCell>{new Date(p.paymentDate).toLocaleDateString("en-AE")}</TableCell>
                                                <TableCell className="capitalize">{p.paymentMethod?.toLowerCase().replace(/_/g, " ")}</TableCell>
                                                <TableCell className="text-muted-foreground">{p.reference || "—"}</TableCell>
                                                <TableCell className="text-right tabular-nums font-medium">{invoice.currency} {Number(p.amount).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {(invoice.notes || invoice.terms) && (
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
                                type="text"
                                inputMode="decimal"
                                value={paymentAmount}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (/^\d*\.?\d*$/.test(v)) setPaymentAmount(v);
                                }}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Payment Date</Label>
                            <DatePicker value={paymentDate} onChange={setPaymentDate} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Reference (optional)</Label>
                            <Input placeholder="Transaction reference" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Payment Method</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                    <SelectItem value="CASH">Cash</SelectItem>
                                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                                    <SelectItem value="CARD">Card</SelectItem>
                                    <SelectItem value="STRIPE">Stripe</SelectItem>
                                    <SelectItem value="PAYBY">PayBy</SelectItem>
                                    <SelectItem value="TABBY">Tabby</SelectItem>
                                    <SelectItem value="TAMARA">Tamara</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
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

            {/* Line item edit/add modal */}
            <LineItemModal
                open={lineItemModalOpen}
                onClose={() => { setLineItemModalOpen(false); setEditingLineItem(null); }}
                onSave={saveLineItem}
                lineItem={editingLineItem}
                currency={invoice.currency}
            />

            {/* Delete line item confirmation */}
            <AlertDialog open={!!deletingLineItem} onOpenChange={(o) => !o && setDeletingLineItem(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete line item?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove &quot;{deletingLineItem?.description}&quot; from the invoice. The invoice totals will be recalculated.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteLineItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
