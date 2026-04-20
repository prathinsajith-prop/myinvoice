"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import {
    RefreshCw,
    DollarSign,
    AlertCircle,
    CheckCircle2,
    Unlink,
    Link2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { jsonFetcher } from "@/lib/fetcher";
import { formatCurrency } from "@/lib/format";

interface OutstandingInvoice {
    id: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    status: string;
    total: number;
    amountPaid: number;
    outstanding: number;
    currency: string;
    customer: { id: string; name: string };
}

interface UnallocatedPayment {
    id: string;
    paymentNumber: string;
    paymentDate: string;
    method: string;
    amount: number;
    currency: string;
    reference: string | null;
    customer: { id: string; name: string };
    allocatedTotal: number;
    unallocated: number;
}

interface ReconciliationSummary {
    totalOutstanding: number;
    totalPaymentsInPeriod: number;
    totalUnallocated: number;
    reconciledInvoicesCount: number;
    outstandingInvoicesCount: number;
    unallocatedPaymentsCount: number;
}

interface ReconciliationData {
    summary: ReconciliationSummary;
    outstandingInvoices: OutstandingInvoice[];
    unallocatedPayments: UnallocatedPayment[];
}

const METHOD_LABELS: Record<string, string> = {
    CASH: "Cash",
    BANK_TRANSFER: "Bank Transfer",
    CHEQUE: "Cheque",
    CARD: "Card",
    STRIPE: "Stripe",
    PAYBY: "PayBy",
    TABBY: "Tabby",
    TAMARA: "Tamara",
    OTHER: "Other",
};

export default function ReconciliationPage() {
    const t = useTranslations("reconciliation");

    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const [fromDate, setFromDate] = useState(format(firstOfMonth, "yyyy-MM-dd"));
    const [toDate, setToDate] = useState(format(today, "yyyy-MM-dd"));

    const [selectedPayment, setSelectedPayment] = useState<UnallocatedPayment | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<OutstandingInvoice | null>(null);
    const [allocateAmount, setAllocateAmount] = useState("");
    const [allocateOpen, setAllocateOpen] = useState(false);
    const [allocating, setAllocating] = useState(false);

    const queryParams = new URLSearchParams({ from: fromDate, to: toDate }).toString();
    const { data, isLoading, mutate } = useSWR<ReconciliationData>(
        `/api/reconciliation?${queryParams}`,
        jsonFetcher
    );

    const openAllocateDialog = useCallback(
        (payment: UnallocatedPayment, invoice: OutstandingInvoice) => {
            setSelectedPayment(payment);
            setSelectedInvoice(invoice);
            const suggestedAmount = Math.min(payment.unallocated, Number(invoice.outstanding));
            setAllocateAmount(suggestedAmount.toFixed(2));
            setAllocateOpen(true);
        },
        []
    );

    const handleAllocate = async () => {
        if (!selectedPayment || !selectedInvoice) return;
        const amount = parseFloat(allocateAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }

        setAllocating(true);
        try {
            const res = await fetch("/api/reconciliation/allocate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    paymentId: selectedPayment.id,
                    invoiceId: selectedInvoice.id,
                    amount,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to allocate");
            }
            toast.success(t("allocateSuccess"));
            setAllocateOpen(false);
            setSelectedPayment(null);
            setSelectedInvoice(null);
            mutate();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : t("allocateError"));
        } finally {
            setAllocating(false);
        }
    };

    const summary = data?.summary;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                    <p className="text-muted-foreground text-sm">{t("description")}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    {t("refresh")}
                </Button>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Label htmlFor="from" className="text-sm">{t("from")}:</Label>
                    <Input
                        id="from"
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-40 h-8 text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="to" className="text-sm">{t("to")}:</Label>
                    <Input
                        id="to"
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-40 h-8 text-sm"
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    {
                        title: t("totalOutstanding"),
                        value: formatCurrency(summary?.totalOutstanding ?? 0),
                        sub: `${summary?.outstandingInvoicesCount ?? 0} invoices`,
                        icon: AlertCircle,
                        color: "text-amber-500",
                    },
                    {
                        title: t("totalPayments"),
                        value: formatCurrency(summary?.totalPaymentsInPeriod ?? 0),
                        sub: "in selected period",
                        icon: DollarSign,
                        color: "text-blue-500",
                    },
                    {
                        title: t("unallocated"),
                        value: formatCurrency(summary?.totalUnallocated ?? 0),
                        sub: `${summary?.unallocatedPaymentsCount ?? 0} payments`,
                        icon: Unlink,
                        color: "text-orange-500",
                    },
                    {
                        title: t("reconciledThisMonth"),
                        value: String(summary?.reconciledInvoicesCount ?? 0),
                        sub: "invoices fully paid",
                        icon: CheckCircle2,
                        color: "text-green-500",
                    },
                ].map(({ title, value, sub, icon: Icon, color }) => (
                    <Card key={title} className="gap-1 py-4">
                        <CardHeader className="pb-0 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Icon className={`h-3.5 w-3.5 ${color}`} />
                                {title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4">
                            <div className="text-xl font-bold">{value}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Two-Panel Layout */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Outstanding Invoices */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                            {t("outstandingInvoices")}
                            {data?.outstandingInvoices.length ? (
                                <Badge variant="secondary" className="ml-auto">
                                    {data.outstandingInvoices.length}
                                </Badge>
                            ) : null}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
                        ) : !data?.outstandingInvoices.length ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">
                                {t("noOutstandingInvoices")}
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">{t("invoice")}</TableHead>
                                        <TableHead className="text-xs">{t("customer")}</TableHead>
                                        <TableHead className="text-xs text-right">{t("outstanding")}</TableHead>
                                        <TableHead className="text-xs">{t("status")}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.outstandingInvoices.map((inv) => (
                                        <TableRow
                                            key={inv.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => {
                                                if (selectedPayment) {
                                                    openAllocateDialog(selectedPayment, inv);
                                                } else {
                                                    setSelectedInvoice(
                                                        selectedInvoice?.id === inv.id ? null : inv
                                                    );
                                                }
                                            }}
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    {selectedInvoice?.id === inv.id && !selectedPayment && (
                                                        <span className="h-2 w-2 rounded-full bg-primary inline-block" />
                                                    )}
                                                    <span className="font-mono text-xs">{inv.invoiceNumber}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    Due {format(new Date(inv.dueDate), "dd MMM yyyy")}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs">{inv.customer.name}</TableCell>
                                            <TableCell className="text-right text-xs font-medium">
                                                {formatCurrency(inv.outstanding, inv.currency)}
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={inv.status} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Unallocated Payments */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Unlink className="h-4 w-4 text-blue-500" />
                            {t("unallocatedPayments")}
                            {data?.unallocatedPayments.length ? (
                                <Badge variant="secondary" className="ml-auto">
                                    {data.unallocatedPayments.length}
                                </Badge>
                            ) : null}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
                        ) : !data?.unallocatedPayments.length ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">
                                {t("noUnallocatedPayments")}
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">{t("payment")}</TableHead>
                                        <TableHead className="text-xs">{t("customer")}</TableHead>
                                        <TableHead className="text-xs text-right">{t("available")}</TableHead>
                                        <TableHead className="text-xs w-20" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.unallocatedPayments.map((pay) => (
                                        <TableRow
                                            key={pay.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => {
                                                if (selectedInvoice) {
                                                    openAllocateDialog(pay, selectedInvoice);
                                                } else {
                                                    setSelectedPayment(
                                                        selectedPayment?.id === pay.id ? null : pay
                                                    );
                                                }
                                            }}
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    {selectedPayment?.id === pay.id && !selectedInvoice && (
                                                        <span className="h-2 w-2 rounded-full bg-primary inline-block" />
                                                    )}
                                                    <span className="font-mono text-xs">{pay.paymentNumber}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {format(new Date(pay.paymentDate), "dd MMM yyyy")} ·{" "}
                                                    {METHOD_LABELS[pay.method] ?? pay.method}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs">{pay.customer.name}</TableCell>
                                            <TableCell className="text-right text-xs font-medium text-green-700">
                                                {formatCurrency(pay.unallocated, pay.currency)}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedPayment(pay);
                                                        setAllocateOpen(true);
                                                        setSelectedInvoice(null);
                                                        setAllocateAmount(pay.unallocated.toFixed(2));
                                                    }}
                                                >
                                                    <Link2 className="h-3 w-3 mr-1" />
                                                    {t("allocate")}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Selection hint */}
            {(selectedPayment || selectedInvoice) && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                        {selectedPayment && (
                            <span className="text-primary font-medium">
                                Payment: {selectedPayment.paymentNumber} ({formatCurrency(selectedPayment.unallocated)})
                            </span>
                        )}
                        {selectedPayment && selectedInvoice && (
                            <span className="text-muted-foreground">→</span>
                        )}
                        {selectedInvoice && (
                            <span className="text-primary font-medium">
                                Invoice: {selectedInvoice.invoiceNumber} ({formatCurrency(Number(selectedInvoice.outstanding))})
                            </span>
                        )}
                        {selectedPayment && selectedInvoice && (
                            <Button
                                size="sm"
                                className="ml-2 h-7 text-xs"
                                onClick={() => openAllocateDialog(selectedPayment, selectedInvoice)}
                            >
                                <Link2 className="h-3 w-3 mr-1" />
                                {t("allocate")}
                            </Button>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => {
                            setSelectedPayment(null);
                            setSelectedInvoice(null);
                        }}
                    >
                        Clear
                    </Button>
                </div>
            )}

            {/* Allocate Dialog */}
            <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("allocatePayment")}</DialogTitle>
                        <DialogDescription>
                            Allocate funds from a payment to an invoice.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedPayment && (
                            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                                <div className="font-medium">{t("payment")}: {selectedPayment.paymentNumber}</div>
                                <div className="text-muted-foreground">
                                    {selectedPayment.customer.name} · {METHOD_LABELS[selectedPayment.method] ?? selectedPayment.method}
                                </div>
                                <div className="text-green-700 font-medium">
                                    {t("available")}: {formatCurrency(selectedPayment.unallocated)}
                                </div>
                            </div>
                        )}
                        {selectedInvoice && (
                            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                                <div className="font-medium">{t("invoice")}: {selectedInvoice.invoiceNumber}</div>
                                <div className="text-muted-foreground">{selectedInvoice.customer.name}</div>
                                <div className="text-amber-700 font-medium">
                                    {t("outstanding")}: {formatCurrency(Number(selectedInvoice.outstanding))}
                                </div>
                            </div>
                        )}
                        {!selectedInvoice && (
                            <div>
                                <Label className="text-sm mb-1.5 block">{t("selectInvoice")}</Label>
                                <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                                    {data?.outstandingInvoices.map((inv) => (
                                        <button
                                            key={inv.id}
                                            onClick={() => setSelectedInvoice(inv)}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                                        >
                                            <span>
                                                <span className="font-mono">{inv.invoiceNumber}</span>
                                                <span className="text-muted-foreground ml-2">{inv.customer.name}</span>
                                            </span>
                                            <span className="text-amber-700 font-medium text-xs">
                                                {formatCurrency(Number(inv.outstanding))}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <Label htmlFor="allocate-amount" className="text-sm mb-1.5 block">
                                {t("amountToAllocate")}
                            </Label>
                            <Input
                                id="allocate-amount"
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={allocateAmount}
                                onChange={(e) => setAllocateAmount(e.target.value)}
                                className="h-9"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAllocateOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAllocate}
                            disabled={allocating || !selectedPayment || !selectedInvoice}
                        >
                            {allocating ? "Allocating…" : t("allocate")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
