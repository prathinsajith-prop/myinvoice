"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    Truck, Package, MapPin, Hash, User, FileText,
    Loader2, Trash2, CheckCircle2, Send, Ban, Clock,
    Navigation, Car, NotepadText
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { formatDate } from "@/lib/format";

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitOfMeasure: string;
    notes: string | null;
    sortOrder: number;
}

interface DeliveryNoteDetail {
    id: string;
    deliveryNoteNumber: string;
    status: string;
    issueDate: string;
    deliveryDate: string | null;
    shippingAddress: string | null;
    trackingNumber: string | null;
    carrier: string | null;
    driverName: string | null;
    vehicleNumber: string | null;
    notes: string | null;
    internalNotes: string | null;
    dispatchedAt: string | null;
    deliveredAt: string | null;
    currency: string;
    customer: { id: string; name: string; email: string | null };
    invoice: { id: string; invoiceNumber: string } | null;
    lineItems: LineItem[];
}

interface Props {
    open: boolean;
    onClose: () => void;
    noteId: string | null;
    onUpdate: () => void;
}

const STATUS_STEPS = [
    { key: "DRAFT", icon: Clock, label: "Draft" },
    { key: "DISPATCHED", icon: Send, label: "Dispatched" },
    { key: "DELIVERED", icon: CheckCircle2, label: "Delivered" },
] as const;

export function DeliveryNoteDetailDrawer({ open, onClose, noteId, onUpdate }: Props) {
    const t = useTranslations("deliveryNotes");
    const tc = useTranslations("common");
    const orgSettings = useOrgSettings();
    const dateFormat = orgSettings.dateFormat;

    const [note, setNote] = useState<DeliveryNoteDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [confirmAction, setConfirmAction] = useState<"void" | "delete" | null>(null);
    const [voidReason, setVoidReason] = useState("");

    const fetchNote = useCallback(async () => {
        if (!noteId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/delivery-notes/${noteId}`);
            if (res.ok) {
                setNote(await res.json());
            } else {
                toast.error("Failed to load delivery note");
                onClose();
            }
        } finally {
            setLoading(false);
        }
    }, [noteId, onClose]);

    useEffect(() => {
        if (open && noteId) {
            fetchNote();
        } else {
            setNote(null);
        }
    }, [open, noteId, fetchNote]);

    async function updateStatus(status: string, extraData?: Record<string, unknown>) {
        if (!noteId) return;
        setUpdating(true);
        try {
            const res = await fetch(`/api/delivery-notes/${noteId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, ...extraData }),
            });
            if (res.ok) {
                const msgKey = status === "DISPATCHED" ? "dispatched" : status === "DELIVERED" ? "delivered" : "voided";
                toast.success(t(msgKey));
                await fetchNote();
                onUpdate();
            } else {
                const err = await res.json();
                toast.error(err.error ?? "Update failed");
            }
        } finally {
            setUpdating(false);
            setConfirmAction(null);
            setVoidReason("");
        }
    }

    async function handleDelete() {
        if (!noteId) return;
        setUpdating(true);
        try {
            const res = await fetch(`/api/delivery-notes/${noteId}`, { method: "DELETE" });
            if (res.ok) {
                toast.success(t("deleted"));
                onUpdate();
                onClose();
            } else {
                toast.error("Delete failed");
            }
        } finally {
            setUpdating(false);
            setConfirmAction(null);
        }
    }

    const canDispatch = note?.status === "DRAFT";
    const canDeliver = note?.status === "DISPATCHED";
    const canVoid = note?.status !== "VOID" && note?.status !== "DELIVERED";
    const canDelete = note?.status === "DRAFT";
    const isVoid = note?.status === "VOID";

    // Determine current step index for progress bar
    const stepIndex = note?.status === "DELIVERED" ? 2
        : note?.status === "DISPATCHED" ? 1
            : 0;

    return (
        <>
            <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
                <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
                    {/* Header */}
                    <SheetHeader className="px-5 py-4 border-b bg-muted/30">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                    <Truck className="h-5 w-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <SheetTitle className="text-base leading-tight">
                                        {loading || !note ? t("details") : note.deliveryNoteNumber}
                                    </SheetTitle>
                                    {note && (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{note.customer.name}</p>
                                    )}
                                </div>
                            </div>
                            {note && <StatusBadge status={note.status} />}
                        </div>
                    </SheetHeader>

                    <ScrollArea className="flex-1">
                        {loading || !note ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="px-5 py-4 space-y-5 pb-8">
                                {/* Status progress — only for non-void */}
                                {!isVoid && (
                                    <div className="rounded-xl border bg-card p-4">
                                        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Progress</p>
                                        <div className="flex items-center gap-0">
                                            {STATUS_STEPS.map((step, i) => {
                                                const isCompleted = i < stepIndex;
                                                const isCurrent = i === stepIndex;
                                                const StepIcon = step.icon;
                                                return (
                                                    <div key={step.key} className="flex items-center flex-1 last:flex-none">
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${isCompleted ? "border-primary bg-primary text-primary-foreground"
                                                                    : isCurrent ? "border-primary bg-primary/10 text-primary"
                                                                        : "border-border bg-background text-muted-foreground"
                                                                }`}>
                                                                <StepIcon className="h-4 w-4" />
                                                            </div>
                                                            <span className={`text-xs font-medium ${isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                                                                {t(`statuses.${step.key}` as never) || step.label}
                                                            </span>
                                                        </div>
                                                        {i < STATUS_STEPS.length - 1 && (
                                                            <div className={`flex-1 h-0.5 mx-2 mb-5 rounded transition-colors ${i < stepIndex ? "bg-primary" : "bg-border"}`} />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {isVoid && (
                                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 flex items-center gap-2 text-sm text-destructive">
                                        <Ban className="h-4 w-4 shrink-0" />
                                        <span>{t("voidConfirm")}</span>
                                    </div>
                                )}

                                {/* Key Info Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <InfoCard icon={User} label={t("customer")} value={note.customer.name} />
                                    <InfoCard icon={FileText} label={t("linkedInvoice")} value={note.invoice?.invoiceNumber ?? "—"} />
                                    <InfoCard label={t("issueDate")} value={formatDate(note.issueDate, dateFormat)} />
                                    <InfoCard label={t("deliveryDate")} value={note.deliveryDate ? formatDate(note.deliveryDate, dateFormat) : "—"} />
                                    {note.dispatchedAt && (
                                        <InfoCard label={t("dispatchedAt")} value={formatDate(note.dispatchedAt, dateFormat)} />
                                    )}
                                    {note.deliveredAt && (
                                        <InfoCard label={t("deliveredAt")} value={formatDate(note.deliveredAt, dateFormat)} />
                                    )}
                                </div>

                                {/* Shipping Details */}
                                {(note.shippingAddress || note.trackingNumber || note.carrier || note.driverName || note.vehicleNumber) && (
                                    <>
                                        <Separator />
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                                                {t("shippingDetails")}
                                            </p>
                                            <div className="grid grid-cols-2 gap-3">
                                                {note.shippingAddress && (
                                                    <div className="col-span-2">
                                                        <InfoCard icon={MapPin} label={t("shippingAddress")} value={note.shippingAddress} />
                                                    </div>
                                                )}
                                                {note.trackingNumber && (
                                                    <InfoCard icon={Hash} label={t("trackingNumber")} value={note.trackingNumber} mono />
                                                )}
                                                {note.carrier && (
                                                    <InfoCard icon={Truck} label={t("carrier")} value={note.carrier} />
                                                )}
                                                {note.driverName && (
                                                    <InfoCard icon={Navigation} label={t("driverName")} value={note.driverName} />
                                                )}
                                                {note.vehicleNumber && (
                                                    <InfoCard icon={Car} label={t("vehicleNumber")} value={note.vehicleNumber} mono />
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Line Items */}
                                <Separator />
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                                        {t("lineItems")}
                                    </p>
                                    {note.lineItems.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">{t("noItems")}</p>
                                    ) : (
                                        <div className="rounded-lg border overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-muted/40">
                                                        <th className="px-3 py-2 text-start font-medium text-xs text-muted-foreground">{t("itemDescription")}</th>
                                                        <th className="px-3 py-2 text-end font-medium text-xs text-muted-foreground w-16">{t("quantity")}</th>
                                                        <th className="px-3 py-2 text-start font-medium text-xs text-muted-foreground w-20">{t("unitOfMeasure")}</th>
                                                        <th className="px-3 py-2 text-start font-medium text-xs text-muted-foreground hidden sm:table-cell">{t("notes")}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {note.lineItems.map((item, i) => (
                                                        <tr key={item.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                                                            <td className="px-3 py-2.5 font-medium">{item.description}</td>
                                                            <td className="px-3 py-2.5 text-end tabular-nums">{Number(item.quantity)}</td>
                                                            <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.unitOfMeasure}</td>
                                                            <td className="px-3 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{item.notes || "—"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Notes */}
                                {(note.notes || note.internalNotes) && (
                                    <>
                                        <Separator />
                                        <div className="space-y-3">
                                            {note.notes && (
                                                <InfoCard icon={NotepadText} label={t("notes")} value={note.notes} full />
                                            )}
                                            {note.internalNotes && (
                                                <InfoCard icon={Package} label={t("internalNotes")} value={note.internalNotes} full />
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Footer Actions */}
                    {note && !isVoid && (
                        <SheetFooter className="px-5 py-3.5 border-t bg-muted/20 gap-2 flex-row items-center">
                            {canDelete && (
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={updating} onClick={() => setConfirmAction("delete")}>
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                    {tc("delete")}
                                </Button>
                            )}
                            <div className="flex-1" />
                            {canVoid && (
                                <Button variant="outline" size="sm" disabled={updating} onClick={() => setConfirmAction("void")}>
                                    <Ban className="mr-1.5 h-3.5 w-3.5" />
                                    {t("markVoid")}
                                </Button>
                            )}
                            {canDispatch && (
                                <Button size="sm" disabled={updating} onClick={() => updateStatus("DISPATCHED")}>
                                    {updating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                                    {t("markDispatched")}
                                </Button>
                            )}
                            {canDeliver && (
                                <Button size="sm" disabled={updating} onClick={() => updateStatus("DELIVERED")}>
                                    {updating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                                    {t("markDelivered")}
                                </Button>
                            )}
                        </SheetFooter>
                    )}
                </SheetContent>
            </Sheet>

            {/* Delete Confirm */}
            <AlertDialog open={confirmAction === "delete"} onOpenChange={(o) => !o && setConfirmAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{tc("delete")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
                            {tc("delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Void with reason */}
            <AlertDialog open={confirmAction === "void"} onOpenChange={(o) => { if (!o) { setConfirmAction(null); setVoidReason(""); } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Ban className="h-4 w-4 text-destructive" />
                            {t("markVoid")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>{t("voidConfirm")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-1 pb-2">
                        <Label className="text-sm font-medium">{t("voidReason")} <span className="text-muted-foreground font-normal">({tc("optional")})</span></Label>
                        <Textarea
                            className="mt-1.5 resize-none"
                            rows={3}
                            placeholder={t("voidReasonPlaceholder")}
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setVoidReason("")}>{tc("cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => updateStatus("VOID", voidReason ? { voidReason } : {})}
                        >
                            {t("markVoid")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function InfoCard({
    icon: Icon,
    label,
    value,
    mono = false,
    full = false,
}: {
    icon?: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    mono?: boolean;
    full?: boolean;
}) {
    return (
        <div className={`rounded-lg bg-muted/40 px-3 py-2.5 space-y-1 ${full ? "col-span-2" : ""}`}>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {Icon && <Icon className="h-3 w-3 shrink-0" />}
                {label}
            </p>
            <p className={`text-sm font-medium leading-snug ${mono ? "font-mono" : ""}`}>{value}</p>
        </div>
    );
}
