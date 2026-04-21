"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
    Loader2,
    FileText,
    DollarSign,
    Hash,
    Bell,
    AlertTriangle,
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { jsonFetcher } from "@/lib/fetcher";
import { invalidateOrgSettingsCache } from "@/lib/hooks/use-org-settings";
import { useTranslations } from "next-intl";

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
    { value: "INR", label: "INR — Indian Rupee" },
    { value: "PKR", label: "PKR — Pakistani Rupee" },
    { value: "EGP", label: "EGP — Egyptian Pound" },
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
    autoReminders: boolean;
    reminderDaysBefore: number[];
    reminderDaysAfter: number[];
    lateFeeEnabled: boolean;
    lateFeeType: string;
    lateFeeValue: number | null;
    lateFeeDays: number | null;
}

interface InvoiceSettingsResponse {
    organization: Partial<InvoiceSettingsData> & {
        settings?: Partial<{
            autoReminders: boolean;
            reminderDaysBefore: number[];
            reminderDaysAfter: number[];
            lateFeeEnabled: boolean;
            lateFeeType: string;
            lateFeeValue: number | null;
            lateFeeDays: number | null;
        }>;
    };
    role: string;
}

export default function InvoiceSettingsPage() {
    const tc = useTranslations("common");
    const ti = useTranslations("settings.invoicing");
    const tr = useTranslations("reminders");
    const tl = useTranslations("lateFees");
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
        autoReminders: true,
        reminderDaysBefore: [3, 7],
        reminderDaysAfter: [3, 7, 14],
        lateFeeEnabled: false,
        lateFeeType: "PERCENTAGE",
        lateFeeValue: null,
        lateFeeDays: null,
    });
    const { data: settingsData, isLoading: loading, mutate, error } = useSWR<InvoiceSettingsResponse>("/api/organization", jsonFetcher, {
        revalidateOnFocus: false,
        onError(err) {
            console.error("Failed to load invoice settings:", err);
            const errorMessage = err?.response?.data?.error || err?.message || ti("failedToLoad");
            toast.error(errorMessage);
        },
    });

    useEffect(() => {
        if (!settingsData) return;
        const org = settingsData.organization;
        const s = org.settings;
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
            autoReminders: s?.autoReminders ?? true,
            reminderDaysBefore: s?.reminderDaysBefore ?? [3, 7],
            reminderDaysAfter: s?.reminderDaysAfter ?? [3, 7, 14],
            lateFeeEnabled: s?.lateFeeEnabled ?? false,
            lateFeeType: s?.lateFeeType ?? "PERCENTAGE",
            lateFeeValue: s?.lateFeeValue !== null && s?.lateFeeValue !== undefined ? Number(s.lateFeeValue) : null,
            lateFeeDays: s?.lateFeeDays ?? null,
        });
        setIsAdmin(settingsData.role === "OWNER" || settingsData.role === "ADMIN");
    }, [settingsData]);

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
                lateFeeValue: form.lateFeeEnabled ? form.lateFeeValue : null,
                lateFeeDays: form.lateFeeEnabled ? form.lateFeeDays : null,
            };

            const res = await fetch("/api/organization", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                const errorMessage = err.error ?? "Failed to save settings";
                if (res.status === 403) {
                    throw new Error("You don't have permission to change invoice settings. Only Admins and Owners can modify these settings.");
                }
                throw new Error(errorMessage);
            }

            toast.success(ti("saved"));
            invalidateOrgSettingsCache();
            await mutate();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : ti("failedToSave"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-5 w-full max-w-2xl" />
                </div>
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        {error?.response?.data?.error || "Failed to load invoice settings. Please check your permissions and try again."}
                    </AlertDescription>
                </Alert>
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
                        <CardTitle>{ti("currencyAndTax")}</CardTitle>
                    </div>
                    <CardDescription>
                        {ti("currencyAndTaxDesc")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label>{ti("defaultCurrency")}</Label>
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
                        <Label htmlFor="vatRate">{ti("defaultVatRate")}</Label>
                        <Input
                            id="vatRate"
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={form.defaultVatRate}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (/^\d*\.?\d*$/.test(v)) set("defaultVatRate", v);
                            }}
                            disabled={!isAdmin}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{ti("defaultPaymentTerms")}</Label>
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
                        <Label htmlFor="fiscalYear">{ti("fiscalYearStart")}</Label>
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
                                    "1", "2", "3", "4", "5", "6",
                                    "7", "8", "9", "10", "11", "12",
                                ].map((m, i) => (
                                    <SelectItem key={i + 1} value={String(i + 1)}>
                                        {ti(`months.${m}`)}
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
                        <CardTitle>{ti("documentPrefixes")}</CardTitle>
                    </div>
                    <CardDescription>
                        {ti("documentPrefixesDesc")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {(
                        [
                            ["invoicePrefix", ti("invoicePrefix")],
                            ["proformaPrefix", ti("proformaPrefix")],
                            ["quotePrefix", ti("quotePrefix")],
                            ["creditNotePrefix", ti("creditNotePrefix")],
                            ["debitNotePrefix", ti("debitNotePrefix")],
                            ["billPrefix", ti("billPrefix")],
                            ["paymentPrefix", ti("paymentPrefix")],
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
                        <CardTitle>{ti("defaultContent")}</CardTitle>
                    </div>
                    <CardDescription>
                        {ti("defaultContentDesc")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="defaultNotes">{ti("defaultNotesLabel")}</Label>
                        <Textarea
                            id="defaultNotes"
                            rows={4}
                            placeholder={ti("defaultNotesPlaceholder")}
                            value={form.defaultNotes ?? ""}
                            onChange={(e) => set("defaultNotes", e.target.value)}
                            disabled={!isAdmin}
                        />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <Label htmlFor="defaultTerms">{ti("defaultTermsLabel")}</Label>
                        <Textarea
                            id="defaultTerms"
                            rows={6}
                            placeholder={ti("defaultTermsPlaceholder")}
                            value={form.defaultTerms ?? ""}
                            onChange={(e) => set("defaultTerms", e.target.value)}
                            disabled={!isAdmin}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Auto Reminders */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-primary" />
                        <CardTitle>{tr("title")}</CardTitle>
                    </div>
                    <CardDescription>
                        {tr("description")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>{tr("enable")}</Label>
                            <p className="text-sm text-muted-foreground">{tr("enableDescription")}</p>
                        </div>
                        <Switch
                            checked={form.autoReminders}
                            onCheckedChange={(v) => set("autoReminders", v)}
                            disabled={!isAdmin}
                        />
                    </div>

                    {form.autoReminders && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <Label>{tr("daysBefore")}</Label>
                                <Input
                                    placeholder="e.g. 3, 7"
                                    value={form.reminderDaysBefore.join(", ")}
                                    onChange={(e) =>
                                        set("reminderDaysBefore",
                                            e.target.value.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n > 0)
                                        )
                                    }
                                    disabled={!isAdmin}
                                />
                                <p className="text-xs text-muted-foreground">{tr("daysBeforeHelp")}</p>
                            </div>
                            <div className="space-y-2">
                                <Label>{tr("daysAfter")}</Label>
                                <Input
                                    placeholder="e.g. 3, 7, 14"
                                    value={form.reminderDaysAfter.join(", ")}
                                    onChange={(e) =>
                                        set("reminderDaysAfter",
                                            e.target.value.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n > 0)
                                        )
                                    }
                                    disabled={!isAdmin}
                                />
                                <p className="text-xs text-muted-foreground">{tr("daysAfterHelp")}</p>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Late Fees */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-primary" />
                        <CardTitle>{tl("title")}</CardTitle>
                    </div>
                    <CardDescription>
                        {tl("description")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>{tl("enable")}</Label>
                            <p className="text-sm text-muted-foreground">{tl("enableDescription")}</p>
                        </div>
                        <Switch
                            checked={form.lateFeeEnabled}
                            onCheckedChange={(v) => set("lateFeeEnabled", v)}
                            disabled={!isAdmin}
                        />
                    </div>

                    {form.lateFeeEnabled && (
                        <>
                            <Separator />
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>{tl("feeType")}</Label>
                                    <Select
                                        value={form.lateFeeType}
                                        onValueChange={(v) => set("lateFeeType", v)}
                                        disabled={!isAdmin}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PERCENTAGE">{tl("percentage")}</SelectItem>
                                            <SelectItem value="FIXED">{tl("fixedAmount")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{tl("feeValue")}</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={form.lateFeeType === "PERCENTAGE" ? 0.5 : 1}
                                        placeholder={form.lateFeeType === "PERCENTAGE" ? "e.g. 2" : "e.g. 50"}
                                        value={form.lateFeeValue ?? ""}
                                        onChange={(e) => set("lateFeeValue", e.target.value ? Number(e.target.value) : null)}
                                        disabled={!isAdmin}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{tl("gracePeriod")}</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        placeholder="e.g. 7"
                                        value={form.lateFeeDays ?? ""}
                                        onChange={(e) => set("lateFeeDays", e.target.value ? Number(e.target.value) : null)}
                                        disabled={!isAdmin}
                                    />
                                    <p className="text-xs text-muted-foreground">{tl("gracePeriodHelp")}</p>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Save */}
            {isAdmin && (
                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {tc("loading")}
                            </>
                        ) : (
                            tc("save")
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
