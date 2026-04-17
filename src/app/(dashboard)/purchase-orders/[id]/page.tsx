"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Pencil, XCircle, Loader2 } from "lucide-react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { formatAmount, formatDate } from "@/lib/format";
import { PurchaseOrderSheet } from "@/components/modals/purchase-order-sheet";

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

interface PurchaseOrder {
    id: string;
    poNumber: string;
    status: string;
    issueDate: string;
    expectedDate: string | null;
    currency: string;
    reference: string | null;
    description: string | null;
    notes: string | null;
    internalNotes: string | null;
    shippingAddress: string | null;
    terms: string | null;
    subtotal: number;
    discount: number;
    totalVat: number;
    total: number;
    supplier: { id: string; name: string; email: string | null; phone: string | null };
    lineItems: LineItem[];
}

const STATUSES = [
    "DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED",
] as const;

export default function PurchaseOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orgSettings = useOrgSettings();
    const currency = orgSettings.defaultCurrency;
    const dateFormat = orgSettings.dateFormat;

    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [editOpen, setEditOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [acting, setActing] = useState(false);

    const fetchPO = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/purchase-orders/${params.id}`);
            if (res.ok) setPo(await res.json());
            else router.push("/purchase-orders");
        } finally {
            setLoading(false);
        }
    }, [params.id, router]);

    useEffect(() => { fetchPO(); }, [fetchPO]);

    const handleStatusChange = async (newStatus: string) => {
        if (!po) return;
        setActing(true);
        try {
            const res = await fetch(`/api/purchase-orders/${po.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                const updated = await res.json();
                setPo((prev) => prev ? { ...prev, status: updated.status } : prev);
                toast.success(`Status updated to ${newStatus}`);
            } else {
                toast.error("Failed to update status");
            }
        } finally {
            setActing(false);
        }
    };

    const handleCancel = async () => {
        if (!po) return;
        setActing(true);
        try {
            const res = await fetch(`/api/purchase-orders/${po.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "CANCELLED" }),
            });
            if (res.ok) {
                setPo((prev) => prev ? { ...prev, status: "CANCELLED" } : prev);
                setCancelOpen(false);
                toast.success("Purchase Order cancelled");
            } else {
                toast.error("Failed to cancel");
            }
        } finally {
            setActing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!po) return null;

    const canEdit = !["RECEIVED", "CANCELLED"].includes(po.status);
    const canCancel = !["RECEIVED", "CANCELLED"].includes(po.status);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/purchase-orders">
                            <ChevronLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold">{po.poNumber}</h1>
                            <StatusBadge status={po.status} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {po.supplier.name} · {formatDate(po.issueDate, dateFormat)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {canEdit && (
                        <>
                            <Select
                                value={po.status}
                                onValueChange={handleStatusChange}
                                disabled={acting}
                            >
                                <SelectTrigger className="w-44">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUSES.filter((s) => s !== "CANCELLED").map((s) => (
                                        <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                            </Button>
                        </>
                    )}
                    {canCancel && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCancelOpen(true)}
                            className="text-destructive hover:text-destructive"
                        >
                            <XCircle className="mr-1.5 h-3.5 w-3.5" />
                            Cancel
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left — main content */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Line items */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Items</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Unit Price</TableHead>
                                        <TableHead className="text-right">Disc %</TableHead>
                                        <TableHead className="text-right">VAT</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {po.lineItems.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell className="text-right tabular-nums">{Number(item.quantity).toLocaleString()}</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatAmount(Number(item.unitPrice))}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">{Number(item.discount) > 0 ? `${item.discount}%` : "—"}</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatAmount(Number(item.vatAmount))}</TableCell>
                                            <TableCell className="text-right tabular-nums font-medium">{formatAmount(Number(item.total))}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Notes */}
                    {(po.notes || po.terms) && (
                        <Card>
                            <CardContent className="pt-6 space-y-3">
                                {po.notes && (
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Notes</p>
                                        <p className="text-sm">{po.notes}</p>
                                    </div>
                                )}
                                {po.terms && (
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Terms</p>
                                        <p className="text-sm">{po.terms}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right — summary */}
                <div className="space-y-4">
                    <Card>
                        <CardContent className="pt-6 space-y-3">
                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Supplier</span>
                                    <span className="font-medium">{po.supplier.name}</span>
                                </div>
                                {po.reference && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Reference</span>
                                        <span>{po.reference}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Issue Date</span>
                                    <span>{formatDate(po.issueDate, dateFormat)}</span>
                                </div>
                                {po.expectedDate && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Expected</span>
                                        <span>{formatDate(po.expectedDate, dateFormat)}</span>
                                    </div>
                                )}
                                {po.shippingAddress && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Ship To</span>
                                        <span className="text-right max-w-[180px]">{po.shippingAddress}</span>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>{currency} {formatAmount(Number(po.subtotal))}</span>
                                </div>
                                {Number(po.discount) > 0 && (
                                    <div className="flex justify-between text-green-600">
                                        <span>Discount</span>
                                        <span>- {currency} {formatAmount(Number(po.discount))}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">VAT</span>
                                    <span>{currency} {formatAmount(Number(po.totalVat))}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-semibold text-base">
                                    <span>Total</span>
                                    <span>{currency} {formatAmount(Number(po.total))}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Edit sheet */}
            <PurchaseOrderSheet
                open={editOpen}
                onClose={() => setEditOpen(false)}
                purchaseOrderId={po.id}
                onSuccess={() => { setEditOpen(false); fetchPO(); }}
            />

            {/* Cancel dialog */}
            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Purchase Order?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will mark {po.poNumber} as cancelled. The supplier will need to be notified separately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleCancel}
                            disabled={acting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {acting ? "Cancelling…" : "Cancel Order"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
