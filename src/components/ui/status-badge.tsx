"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatusConfig {
    label: string;
    dot: string;          // Tailwind bg-* color class for the dot
    badge: string;        // Full badge className (bg + text + border)
}

/** Central registry of status → colors & label */
export const STATUS_CONFIG: Record<string, StatusConfig> = {
    // ── Neutral ────────────────────────────────────────────────────────────
    DRAFT: { label: "Draft", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 border-slate-200" },
    VOID: { label: "Void", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 border-slate-200" },
    // ── Blue ───────────────────────────────────────────────────────────────
    SENT: { label: "Sent", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200" },
    RECEIVED: { label: "Received", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200" },
    // ── Indigo ─────────────────────────────────────────────────────────────
    VIEWED: { label: "Viewed", dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    // ── Amber ──────────────────────────────────────────────────────────────
    PARTIALLY_PAID: { label: "Partial", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
    PENDING_APPROVAL: { label: "Pending", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
    // ── Green ──────────────────────────────────────────────────────────────
    PAID: { label: "Paid", dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200" },
    ACCEPTED: { label: "Accepted", dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200" },
    APPROVED: { label: "Approved", dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200" },
    // ── Emerald ────────────────────────────────────────────────────────────
    REIMBURSED: { label: "Reimbursed", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    CONVERTED: { label: "Converted", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    CREDITED: { label: "Credited", dot: "bg-teal-500", badge: "bg-teal-50 text-teal-700 border-teal-200" },
    // ── Orange ─────────────────────────────────────────────────────────────
    EXPIRED: { label: "Expired", dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200" },
    DISPUTED: { label: "Disputed", dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200" },
    // ── Red ────────────────────────────────────────────────────────────────
    OVERDUE: { label: "Overdue", dot: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
    REJECTED: { label: "Rejected", dot: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
};

function getConfig(status: string): StatusConfig {
    return STATUS_CONFIG[status] ?? {
        label: status,
        dot: "bg-slate-400",
        badge: "bg-slate-100 text-slate-600 border-slate-200",
    };
}

/** Full pill badge with colored dot — use in tables and detail headers */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
    const cfg = getConfig(status);
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                cfg.badge,
                className
            )}
        >
            <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", cfg.dot)} />
            {cfg.label}
        </span>
    );
}

/** Dot + label row — use inside SelectItem for status filter dropdowns */
export function StatusOption({ status }: { status: string }) {
    const cfg = getConfig(status);
    return (
        <span className="inline-flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full flex-shrink-0", cfg.dot)} />
            {cfg.label}
        </span>
    );
}
