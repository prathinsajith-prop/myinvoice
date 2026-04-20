"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ChevronLeft, Pencil, XCircle, Loader2,
    Send, CheckCircle2, PackageCheck, Package,
    Building2, Hash, CalendarDays, CalendarClock, MapPin, Download,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
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

const PIPELINE_STEPS = [
    { key: "DRAFT", label: "Draft" },
    { key: "SENT", label: "Sent" },
    { key: "CONFIRMED", label: "Confirmed" },
    { key: "PARTIALLY_RECEIVED", label: "Partial Receipt" },
    { key: "RECEIVED", label: "Received" },
] as const;

type POStatus = "DRAFT" | "SENT" | "CONFIRMED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

const NEXT_ACTIONS: Record<string, { status: string; label: string; icon: React.ElementType; variant: "default" | "outline" }[]> = {
    DRAFT: [{ status: "SENT", label: "Send to Supplier", icon: Send, variant: "default" }],
    SENT: [{ status: "CONFIRMED", label: "Confirm Order", icon: CheckCircle2, variant: "default" }],
    CONFIRMED: [
        { status: "PARTIALLY_RECEIVED", label: "Mark Partial Receipt", icon: Package, variant: "outline" },
        { status: "RECEIVED", label: "Mark Fully Received", icon: PackageCheck, variant: "default" },
    ],
    PARTIALLY_RECEIVED: [{ status: "RECEIVED", label: "Mark Fully Received", icon: PackageCheck, variant: "default" }],
    RECEIVED: [],
    CANCELLED: [],
};

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
    const [confirmAction, setConfirmAction] = useState<{ status: string; label: string } | null>(null);
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
                toast.success(`Status updated to ${newStatus.replace(/_/g, " ")}`);
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
    const nextActions = NEXT_ACTIONS[po.status as POStatus] ?? [];
    const currentStepIndex = PIPELINE_STEPS.findIndex((s) => s.key === po.status);
    const isCancelled = po.status === "CANCELLED";

    return (
        <div className="max-w-7xl mx-auto space-y-0">

            {/* ── Top bar ── */}
            <div className="flex items-center justify-between py-4 px-1">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" asChild>
                        <Link href="/purchase-orders">
                            <ChevronLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-xl font-bold tracking-tight">{po.poNumber}</h1>
                            <StatusBadge status={po.status} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {po.supplier.name} · {formatDate(po.issueDate, dateFormat)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {canEdit && (
                        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                        </Button>
                    )}
                    {nextActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Button
                                key={action.status}
                                variant={action.variant}
                                size="sm"
                                disabled={acting}
                                onClick={() => setConfirmAction({ status: action.status, label: action.label })}
                            >
                                {acting
                                    ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    : <Icon className="mr-1.5 h-3.5 w-3.5" />
                                }
                                {action.label}
                            </Button>
                        );
                    })}
                    {canCancel && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCancelOpen(true)}
                            className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                        >
                            <XCircle className="mr-1.5 h-3.5 w-3.5" />
                            Cancel
                        </Button>
                    )}
                    <Button variant="outline" size="icon" asChild title="Download PDF">
                        <a href={`/api/purchase-orders/${po.id}/pdf`}>
                            <Download className="h-4 w-4" />
                        </a>
                    </Button>
                </div>
            </div>

            {/* ── Status pipeline ── */}
            {!isCancelled && (
                <div className="border rounded-xl px-6 py-4 mb-6 bg-card">
                    <div className="flex items-start">
                        {PIPELINE_STEPS.map((step, idx) => {
                            const isDone = currentStepIndex > idx;
                            const isCurrent = currentStepIndex === idx;
                            const isLast = idx === PIPELINE_STEPS.length - 1;
                            return (
                                <div key={step.key} className="flex items-start flex-1 min-w-0">
                                    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 transition-all ${isDone ? "bg-primary border-primary text-primary-foreground shadow-sm" :
                                            isCurrent ? "border-primary bg-primary/5 text-primary shadow-sm" :
                                                "border-border bg-muted/40 text-muted-foreground"
                                            }`}>
                                            {isDone
                                                ? <CheckCircle2 className="h-4 w-4" />
                                                : <span className="text-[11px] font-bold">{idx + 1}</span>
                                            }
                                        </div>
                                        <span className={`text-[11px] font-medium text-center leading-tight ${isCurrent ? "text-primary" :
                                            isDone ? "text-foreground" :
                                                "text-muted-foreground"
                                            }`}>
                                            {step.label}
                                        </span>
                                    </div>
                                    {!isLast && (
                                        <div className={`h-0.5 flex-1 mx-2 mt-4 rounded-full transition-colors ${isDone ? "bg-primary" : "bg-border"
                                            }`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Main content ── */}
            <div className="grid gap-6 lg:grid-cols-3">

                {/* Left — items + notes */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Items table */}
                    <div className="border rounded-xl overflow-hidden bg-card">
                        <div className="px-5 py-4 border-b">
                            <h2 className="text-sm font-semibold">Items</h2>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                    <TableHead className="pl-5">Description</TableHead>
                                    <TableHead className="text-right w-20">Qty</TableHead>
                                    <TableHead className="text-right w-28">Unit Price</TableHead>
                                    <TableHead className="text-right w-20">Disc %</TableHead>
                                    <TableHead className="text-right w-24">VAT</TableHead>
                                    <TableHead className="text-right pr-5 w-28">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {po.lineItems.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-muted/20">
                                        <TableCell className="pl-5 font-medium">{item.description}</TableCell>
                                        <TableCell className="text-right tabular-nums text-muted-foreground">{Number(item.quantity).toLocaleString()}</TableCell>
                                        <TableCell className="text-right tabular-nums">{formatAmount(Number(item.unitPrice))}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {Number(item.discount) > 0
                                                ? <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-normal">{item.discount}%</Badge>
                                                : <span className="text-muted-foreground/50">—</span>
                                            }
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatAmount(Number(item.vatAmount))}</TableCell>
                                        <TableCell className="text-right tabular-nums font-semibold pr-5">{formatAmount(Number(item.total))}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Notes & Terms */}
                    {(po.notes || po.terms || po.description || po.internalNotes) && (
                        <div className="border rounded-xl overflow-hidden bg-card divide-y">
                            {po.description && (
                                <div className="px-5 py-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Description</p>
                                    <p className="text-sm leading-relaxed">{po.description}</p>
                                </div>
                            )}
                            {po.notes && (
                                <div className="px-5 py-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Notes</p>
                                    <p className="text-sm leading-relaxed">{po.notes}</p>
                                </div>
                            )}
                            {po.terms && (
                                <div className="px-5 py-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Terms</p>
                                    <p className="text-sm leading-relaxed">{po.terms}</p>
                                </div>
                            )}
                            {po.internalNotes && (
                                <div className="px-5 py-4 bg-amber-50/50 dark:bg-amber-950/10">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1.5">Internal Notes</p>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{po.internalNotes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right — details + totals */}
                <div className="space-y-4">

                    {/* Supplier & meta */}
                    <div className="border rounded-xl overflow-hidden bg-card">
                        <div className="px-5 py-4 border-b">
                            <h2 className="text-sm font-semibold">Details</h2>
                        </div>
                        <div className="divide-y">
                            <div className="flex items-start gap-3 px-5 py-3.5">
                                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] text-muted-foreground mb-0.5">Supplier</p>
                                    <p className="text-sm font-medium truncate">{po.supplier.name}</p>
                                    {po.supplier.email && (
                                        <p className="text-xs text-muted-foreground truncate">{po.supplier.email}</p>
                                    )}
                                </div>
                            </div>
                            {po.reference && (
                                <div className="flex items-start gap-3 px-5 py-3.5">
                                    <Hash className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[11px] text-muted-foreground mb-0.5">Reference</p>
                                        <p className="text-sm font-medium">{po.reference}</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-3 px-5 py-3.5">
                                <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[11px] text-muted-foreground mb-0.5">Issue Date</p>
                                    <p className="text-sm font-medium">{formatDate(po.issueDate, dateFormat)}</p>
                                </div>
                            </div>
                            {po.expectedDate && (
                                <div className="flex items-start gap-3 px-5 py-3.5">
                                    <CalendarClock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[11px] text-muted-foreground mb-0.5">Expected Delivery</p>
                                        <p className="text-sm font-medium">{formatDate(po.expectedDate, dateFormat)}</p>
                                    </div>
                                </div>
                            )}
                            {po.shippingAddress && (
                                <div className="flex items-start gap-3 px-5 py-3.5">
                                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[11px] text-muted-foreground mb-0.5">Ship To</p>
                                        <p className="text-sm font-medium leading-snug">{po.shippingAddress}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="border rounded-xl overflow-hidden bg-card">
                        <div className="divide-y">
                            <div className="flex justify-between items-center px-5 py-3 text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span className="tabular-nums">{currency} {formatAmount(Number(po.subtotal))}</span>
                            </div>
                            {Number(po.discount) > 0 && (
                                <div className="flex justify-between items-center px-5 py-3 text-sm text-green-600 dark:text-green-500">
                                    <span>Discount</span>
                                    <span className="tabular-nums">− {currency} {formatAmount(Number(po.discount))}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center px-5 py-3 text-sm">
                                <span className="text-muted-foreground">VAT</span>
                                <span className="tabular-nums">{currency} {formatAmount(Number(po.totalVat))}</span>
                            </div>
                            <div className="flex justify-between items-center px-5 py-4 font-bold text-base">
                                <span>Total</span>
                                <span className="tabular-nums">{currency} {formatAmount(Number(po.total))}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit sheet */}
            <PurchaseOrderSheet
                open={editOpen}
                onClose={() => setEditOpen(false)}
                purchaseOrderId={po.id}
                onSuccess={() => { setEditOpen(false); fetchPO(); }}
            />

            {/* Confirm status transition */}
            <AlertDialog open={!!confirmAction} onOpenChange={(open: boolean) => { if (!open) setConfirmAction(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmAction?.label}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmAction?.status === "SENT" && `This will mark ${po.poNumber} as sent to the supplier.`}
                            {confirmAction?.status === "CONFIRMED" && `Confirm that ${po.poNumber} has been agreed with the supplier.`}
                            {confirmAction?.status === "PARTIALLY_RECEIVED" && `Mark ${po.poNumber} as partially received. You can mark it fully received later.`}
                            {confirmAction?.status === "RECEIVED" && `Mark ${po.poNumber} as fully received. This action cannot be undone.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={acting}>Keep Current</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={acting}
                            onClick={async () => {
                                if (!confirmAction) return;
                                await handleStatusChange(confirmAction.status);
                                setConfirmAction(null);
                            }}
                        >
                            {acting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {confirmAction?.label}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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

