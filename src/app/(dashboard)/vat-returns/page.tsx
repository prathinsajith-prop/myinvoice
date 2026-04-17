"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Calculator, Save, Download, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { formatDate } from "@/lib/format";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";

interface VatReturn {
    id: string;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    outputVat: number;
    inputVat: number;
    netVat: number;
    status: string;
}

interface Preview {
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    outputVat: number;
    inputVat: number;
    netVat: number;
    standardRatedSales: number;
    standardRatedPurchases: number;
}

function quarterStart(d: Date) {
    const q = Math.floor(d.getMonth() / 3) * 3;
    return new Date(d.getFullYear(), q, 1);
}

function quarterEnd(d: Date) {
    const q = Math.floor(d.getMonth() / 3) * 3;
    return new Date(d.getFullYear(), q + 3, 0, 23, 59, 59, 999);
}

export default function VatReturnsPage() {
    const t = useTranslations("vatReturns");
    const orgSettings = useOrgSettings();
    const now = new Date();
    const [from, setFrom] = useState(() => quarterStart(now).toISOString().slice(0, 10));
    const [to, setTo] = useState(() => quarterEnd(now).toISOString().slice(0, 10));
    const [loading, setLoading] = useState(true);
    const [computing, setComputing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState<VatReturn[]>([]);
    const [exporting, setExporting] = useState<string | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);

    async function loadRows() {
        setLoading(true);
        try {
            const res = await fetch("/api/vat-returns");
            const data = await res.json();
            setRows(data.data ?? []);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadRows();
    }, []);

    async function compute(save: boolean) {
        const isoFrom = `${from}T00:00:00.000Z`;
        const isoTo = `${to}T23:59:59.999Z`;

        if (save) setSaving(true); else setComputing(true);
        try {
            const res = await fetch("/api/vat-returns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periodStart: isoFrom, periodEnd: isoTo, save }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");

            setPreview(data.data ?? null);
            if (save) {
                toast.success(t("vatSaved"));
                loadRows();
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed");
        } finally {
            setComputing(false);
            setSaving(false);
        }
    }

    async function exportReturn(id: string, format: "csv" | "pdf") {
        setExporting(id + format);
        try {
            const res = await fetch(`/api/vat-returns/${id}/export?format=${format}`);
            if (!res.ok) throw new Error("Export failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `vat-return-${id}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error(t("exportFailed"));
        } finally {
            setExporting(null);
        }
    }

    const currency = orgSettings.defaultCurrency;
    const dateFormat = orgSettings.dateFormat;
    const fmt = useMemo(
        () => (n: number) => `${currency} ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}`,
        [currency]
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                <p className="text-muted-foreground text-sm">{t("description")}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t("computeReturn")}</CardTitle>
                    <CardDescription>{t("computeReturnDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>{t("periodStart")}</Label>
                            <DatePicker value={from} onChange={setFrom} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>{t("periodEnd")}</Label>
                            <DatePicker value={to} onChange={setTo} />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => compute(false)} disabled={computing || saving}>
                            {computing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                            {t("compute")}
                        </Button>
                        <Button variant="outline" onClick={() => compute(true)} disabled={saving || computing}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {t("saveReturn")}
                        </Button>
                    </div>

                    {preview && (
                        <div className="rounded-lg border p-4 text-sm space-y-2">
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("outputVat")}</span><span>{fmt(preview.outputVat)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("inputVat")}</span><span>{fmt(preview.inputVat)}</span></div>
                            <div className="flex justify-between font-semibold"><span>{t("netVat")}</span><span>{fmt(preview.netVat)}</span></div>
                            <div className="text-xs text-muted-foreground">{t("dueDate")}: {formatDate(preview.dueDate, dateFormat)}</div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-base">{t("savedReturns")}</CardTitle></CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("noReturns")}</p>
                    ) : (
                        <div className="space-y-2 text-sm">
                            {rows.map((r) => (
                                <div key={r.id} className="rounded border p-3 flex items-center gap-3">
                                    <div className="flex-1 grid grid-cols-4 gap-2">
                                        <div className="text-muted-foreground text-xs">{formatDate(r.periodStart, dateFormat)} – {formatDate(r.periodEnd, dateFormat)}</div>
                                        <div><span className="text-muted-foreground text-xs">{t("outputVat")}: </span>{fmt(Number(r.outputVat))}</div>
                                        <div><span className="text-muted-foreground text-xs">{t("inputVat")}: </span>{fmt(Number(r.inputVat))}</div>
                                        <div className="font-medium"><span className="text-muted-foreground text-xs">{t("netVat")}: </span>{fmt(Number(r.netVat))}</div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            title={t("exportCsv")}
                                            disabled={exporting === r.id + "csv"}
                                            onClick={() => exportReturn(r.id, "csv")}
                                        >
                                            {exporting === r.id + "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            title={t("exportPdf")}
                                            disabled={exporting === r.id + "pdf"}
                                            onClick={() => exportReturn(r.id, "pdf")}
                                        >
                                            {exporting === r.id + "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
