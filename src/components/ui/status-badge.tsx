"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
    FileEdit,
    Ban,
    Clock,
    Send,
    Inbox,
    FileCheck,
    Activity,
    Truck,
    Eye,
    FlaskConical,
    CircleDollarSign,
    Hourglass,
    Stamp,
    RotateCcw,
    AlertTriangle,
    CircleCheck,
    ThumbsUp,
    ClipboardCheck,
    PackageCheck,
    Wallet,
    ArrowRightLeft,
    CreditCard,
    RefreshCcw,
    Timer,
    ShieldAlert,
    Pause,
    AlertCircle,
    XCircle,
    CircleX,
    PowerOff,
    type LucideIcon,
} from "lucide-react";

export interface StatusConfig {
    label: string;
    icon: LucideIcon;
    dot: string;          // Tailwind bg-* color class for the dot
    badge: string;        // Full badge className (bg + text + border)
}

/** Central registry of status → colors, icon & label */
export const STATUS_CONFIG: Record<string, StatusConfig> = {
    // ── Neutral ────────────────────────────────────────────────────────────
    DRAFT: { label: "Draft", icon: FileEdit, dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 border-slate-200" },
    VOID: { label: "Void", icon: Ban, dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 border-slate-200" },
    PENDING: { label: "Pending", icon: Clock, dot: "bg-slate-500", badge: "bg-slate-100 text-slate-700 border-slate-200" },
    INACTIVE: { label: "Inactive", icon: PowerOff, dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 border-slate-200" },
    UNPAID: { label: "Unpaid", icon: Clock, dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
    // ── Blue ───────────────────────────────────────────────────────────────
    SENT: { label: "Sent", icon: Send, dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200" },
    RECEIVED: { label: "Received", icon: Inbox, dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200" },
    ISSUED: { label: "Issued", icon: FileCheck, dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200" },
    ACTIVE: { label: "Active", icon: Activity, dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200" },
    DISPATCHED: { label: "Dispatched", icon: Truck, dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200" },
    // ── Indigo ─────────────────────────────────────────────────────────────
    VIEWED: { label: "Viewed", icon: Eye, dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    TRIALING: { label: "Trialing", icon: FlaskConical, dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    // ── Amber ──────────────────────────────────────────────────────────────
    PARTIALLY_PAID: { label: "Partial", icon: CircleDollarSign, dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
    PENDING_APPROVAL: { label: "Pending", icon: Hourglass, dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
    APPLIED: { label: "Applied", icon: Stamp, dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
    PARTIALLY_REFUNDED: { label: "Partially Refunded", icon: RotateCcw, dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
    PAST_DUE: { label: "Past Due", icon: AlertTriangle, dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
    // ── Green ──────────────────────────────────────────────────────────────
    PAID: { label: "Paid", icon: CircleCheck, dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200" },
    ACCEPTED: { label: "Accepted", icon: ThumbsUp, dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200" },
    APPROVED: { label: "Approved", icon: ClipboardCheck, dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200" },
    COMPLETED: { label: "Completed", icon: PackageCheck, dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200" },
    DELIVERED: { label: "Delivered", icon: Truck, dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200" },
    // ── Emerald ────────────────────────────────────────────────────────────
    REIMBURSED: { label: "Reimbursed", icon: Wallet, dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    CONVERTED: { label: "Converted", icon: ArrowRightLeft, dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    CREDITED: { label: "Credited", icon: CreditCard, dot: "bg-teal-500", badge: "bg-teal-50 text-teal-700 border-teal-200" },
    REFUNDED: { label: "Refunded", icon: RefreshCcw, dot: "bg-teal-500", badge: "bg-teal-50 text-teal-700 border-teal-200" },
    // ── Orange ─────────────────────────────────────────────────────────────
    EXPIRED: { label: "Expired", icon: Timer, dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200" },
    DISPUTED: { label: "Disputed", icon: ShieldAlert, dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200" },
    PAUSED: { label: "Paused", icon: Pause, dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200" },
    // ── Red ────────────────────────────────────────────────────────────────
    OVERDUE: { label: "Overdue", icon: AlertCircle, dot: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
    REJECTED: { label: "Rejected", icon: XCircle, dot: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
    FAILED: { label: "Failed", icon: CircleX, dot: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
    CANCELED: { label: "Canceled", icon: Ban, dot: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
};

function prettifyStatus(status: string): string {
    return status
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function getConfig(status: string): StatusConfig {
    return STATUS_CONFIG[status] ?? {
        label: prettifyStatus(status),
        icon: Clock,
        dot: "bg-slate-400",
        badge: "bg-slate-100 text-slate-600 border-slate-200",
    };
}

/** Full pill badge with icon — use in tables and detail headers */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
    const cfg = getConfig(status);
    const Icon = cfg.icon;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                cfg.badge,
                className
            )}
        >
            <Icon className="h-3 w-3 flex-shrink-0" />
            {cfg.label}
        </span>
    );
}

/** Icon + label row — use inside SelectItem for status filter dropdowns */
export function StatusOption({ status }: { status: string }) {
    const cfg = getConfig(status);
    const Icon = cfg.icon;
    return (
        <span className="inline-flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            {cfg.label}
        </span>
    );
}
