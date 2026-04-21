"use client";

import { useDeferredValue, useState, useEffect, useCallback, useMemo } from "react";
import { Shield, Activity } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/search-input";
import { LoadingState } from "@/components/loading-state";
import { PaginationControls } from "@/components/pagination-controls";

interface AuditLogEntry {
    id: string;
    userId: string;
    userEmail: string | null;
    userRole: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    entityRef: string | null;
    ipAddress: string | null;
    createdAt: string;
    metadata: Record<string, unknown> | null;
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

const ACTION_COLORS: Record<string, string> = {
    CREATE: "bg-green-50 text-green-700 border-green-200",
    UPDATE: "bg-blue-50 text-blue-700 border-blue-200",
    DELETE: "bg-red-50 text-red-700 border-red-200",
    SOFT_DELETE: "bg-red-50 text-red-700 border-red-200",
    RESTORE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    VIEW: "bg-gray-50 text-gray-700 border-gray-200",
    EXPORT: "bg-purple-50 text-purple-700 border-purple-200",
    SEND: "bg-indigo-50 text-indigo-700 border-indigo-200",
    VOID: "bg-orange-50 text-orange-700 border-orange-200",
    MARK_PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CONVERT: "bg-cyan-50 text-cyan-700 border-cyan-200",
    LOGIN: "bg-slate-50 text-slate-700 border-slate-200",
    LOGOUT: "bg-slate-50 text-slate-700 border-slate-200",
    SETTINGS_CHANGE: "bg-amber-50 text-amber-700 border-amber-200",
    PASSWORD_CHANGE: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export default function AuditLogPage() {
    const t = useTranslations("auditLog");
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("ALL");
    const [entityFilter, setEntityFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const deferredSearch = useDeferredValue(search);
    const normalizedSearch = deferredSearch.trim();

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "30" });
            if (normalizedSearch) params.set("search", normalizedSearch);
            if (actionFilter !== "ALL") params.set("action", actionFilter);
            if (entityFilter !== "ALL") params.set("entityType", entityFilter);
            const res = await fetch(`/api/audit-log?${params}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.data ?? []);
                setPagination(data.pagination ?? null);
            }
        } finally {
            setLoading(false);
        }
    }, [page, normalizedSearch, actionFilter, entityFilter]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const handleSearchChange = (value: string) => { setPage(1); setSearch(value); };

    const columns = useMemo<ColumnDef<AuditLogEntry>[]>(() => [
        {
            accessorKey: "createdAt",
            header: t("time"),
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(row.getValue("createdAt")).toLocaleString("en-AE", {
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                </span>
            ),
        },
        {
            accessorKey: "userEmail",
            header: t("user"),
            cell: ({ row }) => (
                <span className="text-sm truncate max-w-[160px] block">{row.getValue("userEmail") ?? t("system")}</span>
            ),
        },
        {
            accessorKey: "action",
            header: t("action"),
            cell: ({ row }) => {
                const action = row.getValue("action") as string;
                return (
                    <Badge variant="outline" className={ACTION_COLORS[action] ?? "bg-gray-50 text-gray-700"}>
                        {action.replace(/_/g, " ")}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "entityType",
            header: t("entity"),
            cell: ({ row }) => (
                <span className="text-sm font-medium">{row.getValue("entityType")}</span>
            ),
        },
        {
            id: "ref",
            header: t("reference"),
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground font-mono">
                    {row.original.entityRef ?? row.original.entityId?.slice(0, 8) ?? "—"}
                </span>
            ),
        },
        {
            accessorKey: "ipAddress",
            header: t("ipAddress"),
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground font-mono">
                    {row.getValue("ipAddress") ?? "—"}
                </span>
            ),
        },
    ], [t]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        <CardTitle>{t("title")}</CardTitle>
                    </div>
                    <CardDescription>
                        {t("description")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <SearchInput
                            value={search}
                            onChange={handleSearchChange}
                            placeholder={t("searchPlaceholder")}
                            className="sm:w-72"
                        />
                        <Select value={actionFilter} onValueChange={(v) => { setPage(1); setActionFilter(v); }}>
                            <SelectTrigger className="sm:w-40">
                                <SelectValue placeholder="All actions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{t("allActions")}</SelectItem>
                                <SelectItem value="CREATE">{t("actions.CREATE")}</SelectItem>
                                <SelectItem value="UPDATE">{t("actions.UPDATE")}</SelectItem>
                                <SelectItem value="DELETE">{t("actions.DELETE")}</SelectItem>
                                <SelectItem value="SEND">{t("actions.SEND")}</SelectItem>
                                <SelectItem value="VOID">{t("actions.VOID")}</SelectItem>
                                <SelectItem value="MARK_PAID">{t("actions.MARK_PAID")}</SelectItem>
                                <SelectItem value="EXPORT">{t("actions.EXPORT")}</SelectItem>
                                <SelectItem value="LOGIN">{t("actions.LOGIN")}</SelectItem>
                                <SelectItem value="SETTINGS_CHANGE">{t("actions.SETTINGS_CHANGE")}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={entityFilter} onValueChange={(v) => { setPage(1); setEntityFilter(v); }}>
                            <SelectTrigger className="sm:w-40">
                                <SelectValue placeholder="All entities" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{t("allEntities")}</SelectItem>
                                <SelectItem value="Invoice">{t("entities.Invoice")}</SelectItem>
                                <SelectItem value="Quotation">{t("entities.Quotation")}</SelectItem>
                                <SelectItem value="Customer">{t("entities.Customer")}</SelectItem>
                                <SelectItem value="Supplier">{t("entities.Supplier")}</SelectItem>
                                <SelectItem value="Product">{t("entities.Product")}</SelectItem>
                                <SelectItem value="Bill">{t("entities.Bill")}</SelectItem>
                                <SelectItem value="Expense">{t("entities.Expense")}</SelectItem>
                                <SelectItem value="CreditNote">{t("entities.CreditNote")}</SelectItem>
                                <SelectItem value="DebitNote">{t("entities.DebitNote")}</SelectItem>
                                <SelectItem value="DeliveryNote">{t("entities.DeliveryNote")}</SelectItem>
                                <SelectItem value="Organization">{t("entities.Organization")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {loading ? (
                        <LoadingState />
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Shield className="h-10 w-10 text-muted-foreground mb-3" />
                            <p className="font-medium">{t("empty")}</p>
                            <p className="text-sm text-muted-foreground">{t("emptyDescription")}</p>
                        </div>
                    ) : (
                        <DataTable columns={columns} data={logs} />
                    )}
                </CardContent>
            </Card>

            {pagination && pagination.pages > 1 && (
                <PaginationControls
                    pagination={pagination}
                    page={page}
                    onPageChange={setPage}
                />
            )}
        </div>
    );
}
