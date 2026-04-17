"use client";

import Link from "next/link";
import { MessageCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface InvoiceData {
    id: string;
    invoiceNumber: string;
    status: string;
    issueDate: Date;
    dueDate: Date;
    currency: string;
    subtotal: number;
    totalVat: number;
    total: number;
    outstanding: number;
    publicToken: string;
    customer: { name: string; email: string | null };
    organization: { legalName?: string; name: string };
    lineItems: Array<{
        id: string;
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
    }>;
}

export function PortalInvoiceClient({ invoice, waText }: { invoice: InvoiceData; waText: string }) {
    const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);

    async function createStripeLink() {
        setCreatingPaymentLink(true);
        try {
            const res = await fetch(`/api/invoices/${invoice.id}/payment-link`, {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create payment link");
            if (!data.url) throw new Error("No payment URL returned");

            window.open(data.url, "_blank", "noopener,noreferrer");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create payment link");
        } finally {
            setCreatingPaymentLink(false);
        }
    }

    return (
        <div className="min-h-screen bg-muted/30 py-8">
            <div className="mx-auto max-w-4xl px-4 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{invoice.invoiceNumber}</h1>
                        <p className="text-muted-foreground text-sm">{invoice.organization.legalName || invoice.organization.name}</p>
                    </div>
                    <Badge>{invoice.status.replaceAll("_", " ")}</Badge>
                </div>

                <Card>
                    <CardHeader><CardTitle className="text-base">Invoice Summary</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{invoice.customer.name}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Issue date</span><span>{new Date(invoice.issueDate).toLocaleDateString("en-AE")}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Due date</span><span>{new Date(invoice.dueDate).toLocaleDateString("en-AE")}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{invoice.currency} {Number(invoice.subtotal).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{invoice.currency} {Number(invoice.totalVat).toFixed(2)}</span></div>
                        <Separator />
                        <div className="flex justify-between font-semibold"><span>Total</span><span>{invoice.currency} {Number(invoice.total).toFixed(2)}</span></div>
                        <div className="flex justify-between text-amber-600 font-medium"><span>Outstanding</span><span>{invoice.currency} {Number(invoice.outstanding).toFixed(2)}</span></div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {invoice.lineItems.map((item) => (
                            <div key={item.id} className="grid grid-cols-12 gap-2 text-sm border-b pb-2">
                                <div className="col-span-6">{item.description}</div>
                                <div className="col-span-2 text-right">{Number(item.quantity)}</div>
                                <div className="col-span-2 text-right">{Number(item.unitPrice).toFixed(2)}</div>
                                <div className="col-span-2 text-right font-medium">{Number(item.total).toFixed(2)}</div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <div className="flex gap-3 flex-wrap">
                    <Button asChild>
                        <Link href={`/api/invoices/${invoice.id}/pdf`}>Download PDF</Link>
                    </Button>
                    {Number(invoice.outstanding) > 0 && (
                        <Button onClick={createStripeLink} disabled={creatingPaymentLink}>
                            {creatingPaymentLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Pay Now
                        </Button>
                    )}
                    <Button variant="outline" asChild>
                        <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer">
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Share via WhatsApp
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    );
}
