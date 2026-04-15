"use client";

import { useState } from "react";
import useSWR from "swr";
import {
    Loader2,
    FileText,
    DollarSign,
    Hash,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { jsonFetcher } from "@/lib/fetcher";
import { invalidateOrgSettingsCache } from "@/lib/hooks/use-org-settings";

const CURRENCIES = [
    { value: "AED", label: "AED — UAE Dirham" },
    { value: "USD", label: "USD — US Dollar" },
    { value: "EUR", label: "EUR — Euro" },
    { value: "GBP", label: "GBP — British Pound" },
    { value: "SAR", label: "SAR — Saudi Riyal" },
    { value: "OMR", label: "OMR — Omani Rial" },
    { value: "QAR", label: "QAR — Qatari Riyal" },
    { value: "KWD", label: "KWD — Kuwaiti Dinar" },
    { value: "BHD", label: "BHD — Bahraini Dinar" },
] as const;

const PAYMENT_TERMS_OPTIONS = [
    { value: 0, label: "Due on receipt (0 days)" },
    { value: 7, label: "Net 7 days" },
    { value: 14, label: "Net 14 days" },
    { value: 15, label: "Net 15 days" },
    { value: 30, label: "Net 30 days" },
    { value: 45, label: "Net 45 days" },
    { value: 60, label: "Net 60 days" },
    { value: 90, label: "Net 90 days" },
] as const;

interface InvoiceSettingsData {
    defaultCurrency: string;
    fiscalYearStart: number;
    invoicePrefix: string;
    proformaPrefix: string;
    quotePrefix: string;
    creditNotePrefix: string;
    debitNotePrefix: string;
    billPrefix: string;
    paymentPrefix: string;
    defaultPaymentTerms: number;
    defaultDueDateDays: number;
    defaultVatRate: number | string;
    defaultNotes: string | null;
    defaultTerms: string | null;
}

interface InvoiceSettingsResponse {
    organization: Partial<InvoiceSettingsData>;
    role: string;
}

export default function InvoiceSettingsPage() {
    const [saving, setSaving] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [form, setForm] = useState<InvoiceSettingsData>({
        defaultCurrency: "AED",
        fiscalYearStart: 1,
        invoicePrefix: "INV",
        proformaPrefix: "PI",
        quotePrefix: "QT",
        creditNotePrefix: "CN",
        debitNotePrefix: "DN",
        billPrefix: "BILL",
        paymentPrefix: "PAY",
        defaultPaymentTerms: 30,
        defaultDueDateDays: 30,
        defaultVatRate: 5,
        defaultNotes: "",
        defaultTerms: "",
    });
    const { isLoading: loading, mutate } = useSWR<InvoiceSettingsResponse>("/api/organization", jsonFetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        onSuccess(json) {
            const org = json.organization;
            setForm({
                defaultCurrency: org.defaultCurrency ?? "AED",
                fiscalYearStart: org.fiscalYearStart ?? 1,
                invoicePrefix: org.invoicePrefix ?? "INV",
                proformaPrefix: org.proformaPrefix ?? "PI",
                quotePrefix: org.quotePrefix ?? "QT",
                creditNotePrefix: org.creditNotePrefix ?? "CN",
                debitNotePrefix: org.debitNotePrefix ?? "DN",
                billPrefix: org.billPrefix ?? "BILL",
                paymentPrefix: org.paymentPrefix ?? "PAY",
                defaultPaymentTerms: org.defaultPaymentTerms ?? 30,
                defaultDueDateDays: org.defaultDueDateDays ?? 30,
                defaultVatRate: Number(org.defaultVatRate ?? 5),
                defaultNotes: org.defaultNotes ?? "",
                defaultTerms: org.defaultTerms ?? "",
            });
            setIsAdmin(json.role === "OWNER" || json.role === "ADMIN");
        },
        onError() {
            toast.error("Failed to load invoice settings");
        },
    });

    const set = <K extends keyof InvoiceSettingsData>(key: K, value: InvoiceSettingsData[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...form,
                defaultVatRate: Number(form.defaultVatRate),
                defaultNotes: form.defaultNotes || null,
                defaultTerms: form.defaultTerms || null,
            };

            const res = await fetch("/api/organization", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "Failed to save settings");
            }

            toast.success("Invoice settings saved");
            invalidateOrgSettingsCache();
            await mutate();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Currency & Tax */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <CardTitle>Currency & Tax</CardTitle>
                    </div>
                    <CardDescription>
                        Default currency and VAT rate applied to new documents
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Default Currency</Label>
                        <Select
                            value={form.defaultCurrency}
                            onValueChange={(v) => set("defaultCurrency", v)}
                            disabled={!isAdmin}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CURRENCIES.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>
                                        {c.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="vatRate">Default VAT Rate (%)</Label>
                        <Input
                            id="vatRate"
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={form.defaultVatRate}
                            onChange={(e) => set("defaultVatRate", e.target.value)}
                            disabled={!isAdmin}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Default Payment Terms</Label>
                        <Select
                            value={String(form.defaultPaymentTerms)}
                            onValueChange={(v) => set("defaultPaymentTerms", Number(v))}
                            disabled={!isAdmin}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PAYMENT_TERMS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={String(o.value)}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fiscalYear">Fiscal Year Start (month)</Label>
                        <Select
                            value={String(form.fiscalYearStart)}
                            onValueChange={(v) => set("fiscalYearStart", Number(v))}
                            disabled={!isAdmin}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[
                                    "January", "February", "March", "April", "May", "June",
                                    "July", "August", "September", "October", "November", "December",
                                ].map((m, i) => (
                                    <SelectItem key={i + 1} value={String(i + 1)}>
                                        {m}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Document Prefixes */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Hash className="h-5 w-5 text-primary" />
                        <CardTitle>Document Number Prefixes</CardTitle>
                    </div>
                    <CardDescription>
                        Prefix used when generating new document numbers (e.g. INV-0001)
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {(
                        [
                            ["invoicePrefix", "Invoice"],
                            ["proformaPrefix", "Proforma Invoice"],
                            ["quotePrefix", "Quotation"],
                            ["creditNotePrefix", "Credit Note"],
                            ["debitNotePrefix", "Debit Note"],
                            ["billPrefix", "Bill"],
                            ["paymentPrefix", "Payment"],
                        ] as [keyof InvoiceSettingsData, string][]
                    ).map(([field, label]) => (
                        <div key={field} className="space-y-2">
                            <Label htmlFor={field}>{label}</Label>
                            <Input
                                id={field}
                                value={form[field] as string}
                                onChange={(e) => set(field, e.target.value.toUpperCase())}
                                maxLength={10}
                                disabled={!isAdmin}
                                placeholder="e.g. INV"
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Default Content */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <CardTitle>Default Document Content</CardTitle>
                    </div>
                    <CardDescription>
                        Pre-filled notes and terms that appear on new invoices and quotes
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="defaultNotes">Default Notes</Label>
                        <Textarea
                            id="defaultNotes"
                            rows={4}
                            placeholder="e.g. Thank you for your business. Payment is appreciated within the agreed terms."
                            value={form.defaultNotes ?? ""}
                            onChange={(e) => set("defaultNotes", e.target.value)}
                            disabled={!isAdmin}
                        />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <Label htmlFor="defaultTerms">Default Terms & Conditions</Label>
                        <Textarea
                            id="defaultTerms"
                            rows={6}
                            placeholder="e.g. All goods remain the property of the seller until payment is received in full."
                            value={form.defaultTerms ?? ""}
                            onChange={(e) => set("defaultTerms", e.target.value)}
                            disabled={!isAdmin}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Save */}
            {isAdmin && (
                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            "Save Invoice Settings"
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
