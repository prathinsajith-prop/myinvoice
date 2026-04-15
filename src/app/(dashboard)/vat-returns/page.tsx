"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Calculator, Save } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    const now = new Date();
    const [from, setFrom] = useState(quarterStart(now).toISOString().slice(0, 10));
    const [to, setTo] = useState(quarterEnd(now).toISOString().slice(0, 10));
    const [loading, setLoading] = useState(true);
    const [computing, setComputing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState<VatReturn[]>([]);
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
                toast.success("VAT return saved");
                loadRows();
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed");
        } finally {
            setComputing(false);
            setSaving(false);
        }
    }

    const currency = "AED";
    const fmt = useMemo(
        () => (n: number) => `${currency} ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}`,
        []
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">VAT Returns</h1>
                <p className="text-muted-foreground text-sm">Compute and track quarterly VAT return summaries.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Compute Return</CardTitle>
                    <CardDescription>Select a period and compute VAT.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-sm text-muted-foreground">Period start</label>
                            <DatePicker value={from} onChange={setFrom} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm text-muted-foreground">Period end</label>
                            <DatePicker value={to} onChange={setTo} />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => compute(false)} disabled={computing || saving}>
                            {computing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                            Compute
                        </Button>
                        <Button variant="outline" onClick={() => compute(true)} disabled={saving || computing}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Return
                        </Button>
                    </div>

                    {preview && (
                        <div className="rounded-lg border p-4 text-sm space-y-2">
                            <div className="flex justify-between"><span className="text-muted-foreground">Output VAT</span><span>{fmt(preview.outputVat)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Input VAT</span><span>{fmt(preview.inputVat)}</span></div>
                            <div className="flex justify-between font-semibold"><span>Net VAT</span><span>{fmt(preview.netVat)}</span></div>
                            <div className="text-xs text-muted-foreground">Due date: {new Date(preview.dueDate).toLocaleDateString("en-AE")}</div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-base">Saved Returns</CardTitle></CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No returns saved yet.</p>
                    ) : (
                        <div className="space-y-2 text-sm">
                            {rows.map((r) => (
                                <div key={r.id} className="grid grid-cols-5 gap-2 rounded border p-3">
                                    <div>{new Date(r.periodStart).toLocaleDateString("en-AE")} - {new Date(r.periodEnd).toLocaleDateString("en-AE")}</div>
                                    <div>{fmt(Number(r.outputVat))}</div>
                                    <div>{fmt(Number(r.inputVat))}</div>
                                    <div className="font-medium">{fmt(Number(r.netVat))}</div>
                                    <div>{r.status}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
