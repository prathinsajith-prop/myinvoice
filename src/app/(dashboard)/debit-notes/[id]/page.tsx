"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Send, XCircle, CheckCircle } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VAT_TREATMENT_LABELS } from "@/lib/constants/labels";

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vatTreatment: string;
    vatAmount: number;
    total: number;
}

interface DebitNote {
    id: string;
    debitNoteNumber: string;
    status: string;
    issueDate: string;
    reason: string;
    currency: string;
    sellerTrn: string | null;
    buyerTrn: string | null;
    notes: string | null;
    subtotal: number;
    totalVat: number;
    total: number;
    customer: { id: string; name: string; email: string | null };
    invoice: { id: string; invoiceNumber: string; status: string };
    lineItems: LineItem[];
}

export default function DebitNoteDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [note, setNote] = useState<DebitNote | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [voidDialogOpen, setVoidDialogOpen] = useState(false);

    const fetchNote = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/debit-notes/${id}`);
            if (res.ok) setNote(await res.json());
            else router.push("/debit-notes");
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useEffect(() => { fetchNote(); }, [fetchNote]);

    async function updateStatus(status: string) {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/debit-notes/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to update status");
            toast.success(`Debit note ${status.toLowerCase()}`);
            await fetchNote();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setActionLoading(false);
            setVoidDialogOpen(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!note) return null;

    const canIssue = note.status === "DRAFT";
    const canApply = note.status === "ISSUED";
    const canVoid = note.status === "ISSUED";

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/debit-notes")}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold">{note.debitNoteNumber}</h1>
                            <StatusBadge status={note.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Issued {new Date(note.issueDate).toLocaleDateString("en-AE")}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canIssue && (
                        <Button size="sm" onClick={() => updateStatus("ISSUED")} disabled={actionLoading}>
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Issue
                        </Button>
                    )}
                    {canApply && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus("APPLIED")} disabled={actionLoading}>
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Mark Applied
                        </Button>
                    )}
                    {canVoid && (
                        <Button size="sm" variant="destructive" onClick={() => setVoidDialogOpen(true)} disabled={actionLoading}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Void
                        </Button>
                    )}
                </div>
            </div>

            {/* Reference Info */}
            <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Customer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link href={`/customers/${note.customer.id}`} className="font-medium text-primary hover:underline underline-offset-4">
                            {note.customer.name}
                        </Link>
                        {note.customer.email && (
                            <p className="text-sm text-muted-foreground">{note.customer.email}</p>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Linked Invoice</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link href={`/invoices/${note.invoice.id}`} className="font-medium text-primary hover:underline underline-offset-4">
                            {note.invoice.invoiceNumber}
                        </Link>
                        <div className="mt-1">
                            <StatusBadge status={note.invoice.status} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Reason & TRN */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div>
                        <span className="text-muted-foreground">Reason: </span>
                        <span>{note.reason}</span>
                    </div>
                    {note.sellerTrn && (
                        <div>
                            <span className="text-muted-foreground">Seller TRN: </span>
                            <span className="font-mono">{note.sellerTrn}</span>
                        </div>
                    )}
                    {note.buyerTrn && (
                        <div>
                            <span className="text-muted-foreground">Buyer TRN: </span>
                            <span className="font-mono">{note.buyerTrn}</span>
                        </div>
                    )}
                    {note.notes && (
                        <div>
                            <span className="text-muted-foreground">Notes: </span>
                            <span>{note.notes}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Line Items</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Unit Price</TableHead>
                                <TableHead>VAT</TableHead>
                                <TableHead className="text-right">VAT Amt</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {note.lineItems.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {note.currency} {Number(item.unitPrice).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {VAT_TREATMENT_LABELS[item.vatTreatment] ?? item.vatTreatment.replace(/_/g, " ")}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {note.currency} {Number(item.vatAmount).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-medium">
                                        {note.currency} {Number(item.total).toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Totals */}
            <div className="flex justify-end">
                <div className="w-full sm:w-72 rounded-lg bg-muted/40 p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{note.currency} {Number(note.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>VAT</span>
                        <span>{note.currency} {Number(note.totalVat).toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-base">
                        <span>Total</span>
                        <span>{note.currency} {Number(note.total).toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Void Dialog */}
            <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Void Debit Note</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to void {note.debitNoteNumber}? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => updateStatus("VOID")}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Void Debit Note
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
