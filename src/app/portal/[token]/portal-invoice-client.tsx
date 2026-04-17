"use client";

import Link from "next/link";
import { MessageCircle, Loader2, CheckCircle2, Mail, Phone, Globe } from "lucide-react";
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
    discount: number;
    totalVat: number;
    total: number;
    amountPaid: number;
    outstanding: number;
    notes: string | null;
    terms: string | null;
    publicToken: string;
    customer: { name: string; email: string | null };
    organization: {
        legalName?: string;
        name: string;
        email?: string | null;
        phone?: string | null;
        website?: string | null;
    };
    lineItems: Array<{
        id: string;
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
    }>;
    payments: Array<{
        paymentNumber: string;
        paymentDate: Date;
        amount: number;
        method: string;
    }>;
}

export function PortalInvoiceClient({ invoice, waText }: { invoice: InvoiceData; waText: string }) {
    const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
    const [usePartialPayment, setUsePartialPayment] = useState(false);
    const [partialAmount, setPartialAmount] = useState<string>(Number(invoice.outstanding).toFixed(2));

    async function createStripeLink(amount?: number) {
        setCreatingPaymentLink(true);
        try {
            const paymentAmount = amount ?? Number(invoice.outstanding);
            const params = new URLSearchParams({ token: invoice.publicToken, amount: String(paymentAmount) });
            const res = await fetch(`/api/invoices/${invoice.id}/payment-link?${params}`, {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create payment link");
            if (!data.url) throw new Error("No payment URL returned");

            window.open(data.url, "_blank", "noopener,noreferrer");
            setUsePartialPayment(false);
            setPartialAmount(Number(invoice.outstanding).toFixed(2));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create payment link");
        } finally {
            setCreatingPaymentLink(false);
        }
    }

    function handlePartialAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value;
        setPartialAmount(value);
    }

    function isValidPartialAmount(): boolean {
        const amount = parseFloat(partialAmount);
        return !isNaN(amount) && amount >= 0.01 && amount <= Number(invoice.outstanding);
    }

    return (
        <div className="min-h-screen bg-muted/30 py-8">
            <div className="mx-auto max-w-4xl px-4 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{invoice.invoiceNumber}</h1>
                        <p className="text-muted-foreground text-sm font-medium">{invoice.organization.legalName || invoice.organization.name}</p>
                        <div className="flex flex-wrap gap-3 mt-1">
                            {invoice.organization.email && (
                                <a href={`mailto:${invoice.organization.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                    <Mail className="h-3 w-3" />{invoice.organization.email}
                                </a>
                            )}
                            {invoice.organization.phone && (
                                <a href={`tel:${invoice.organization.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                    <Phone className="h-3 w-3" />{invoice.organization.phone}
                                </a>
                            )}
                            {invoice.organization.website && (
                                <a href={invoice.organization.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                    <Globe className="h-3 w-3" />{invoice.organization.website.replace(/^https?:\/\//, "")}
                                </a>
                            )}
                        </div>
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
                        {Number(invoice.discount) > 0 && (
                            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-green-600">− {invoice.currency} {Number(invoice.discount).toFixed(2)}</span></div>
                        )}
                        <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{invoice.currency} {Number(invoice.totalVat).toFixed(2)}</span></div>
                        <Separator />
                        <div className="flex justify-between font-semibold"><span>Total</span><span>{invoice.currency} {Number(invoice.total).toFixed(2)}</span></div>
                        {Number(invoice.amountPaid) > 0 && (
                            <div className="flex justify-between text-green-600"><span>Amount Paid</span><span>− {invoice.currency} {Number(invoice.amountPaid).toFixed(2)}</span></div>
                        )}
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
                        <>
                            <Button onClick={() => createStripeLink()} disabled={creatingPaymentLink}>
                                {creatingPaymentLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Pay Full Amount
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setUsePartialPayment(!usePartialPayment)}
                            >
                                Pay Partial
                            </Button>
                        </>
                    )}
                    {Number(invoice.outstanding) <= 0 && (
                        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm font-medium text-green-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Paid in Full — Thank you!
                        </div>
                    )}
                    <Button variant="outline" asChild>
                        <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer">
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Share via WhatsApp
                        </a>
                    </Button>
                </div>

                {invoice.payments.length > 0 && (
                    <Card>
                        <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            {invoice.payments.map((p) => (
                                <div key={p.paymentNumber} className="flex items-center justify-between text-sm border-b pb-2 last:border-b-0 last:pb-0">
                                    <div>
                                        <p className="font-medium">{p.paymentNumber}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(p.paymentDate).toLocaleDateString("en-AE")} · {p.method.replace(/_/g, " ")}</p>
                                    </div>
                                    <span className="font-semibold text-green-700">{invoice.currency} {Number(p.amount).toFixed(2)}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {(invoice.notes || invoice.terms) && (
                    <Card>
                        <CardHeader><CardTitle className="text-base">Notes & Terms</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            {invoice.notes && (
                                <div>
                                    <p className="font-medium mb-1">Notes</p>
                                    <p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                                </div>
                            )}
                            {invoice.terms && (
                                <div>
                                    <p className="font-medium mb-1">Terms & Conditions</p>
                                    <p className="text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {usePartialPayment && Number(invoice.outstanding) > 0 && (
                    <Card className="border-amber-200 bg-amber-50">
                        <CardHeader>
                            <CardTitle className="text-base">Pay Partial Amount</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                You can pay any amount between {invoice.currency} 0.01 and {invoice.currency} {Number(invoice.outstanding).toFixed(2)}
                            </p>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Amount to Pay</label>
                                <div className="flex gap-2">
                                    <div className="flex items-center">
                                        <span className="text-sm font-medium mr-2">{invoice.currency}</span>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max={Number(invoice.outstanding).toFixed(2)}
                                        value={partialAmount}
                                        onChange={handlePartialAmountChange}
                                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        placeholder="Enter amount"
                                    />
                                </div>
                                {!isValidPartialAmount() && partialAmount && (
                                    <p className="text-xs text-red-600">
                                        Amount must be between {invoice.currency} 0.01 and {invoice.currency} {Number(invoice.outstanding).toFixed(2)}
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Remaining after payment: {invoice.currency} {(Number(invoice.outstanding) - (parseFloat(partialAmount) || 0)).toFixed(2)}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => createStripeLink(parseFloat(partialAmount))}
                                    disabled={creatingPaymentLink || !isValidPartialAmount()}
                                >
                                    {creatingPaymentLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Pay {invoice.currency} {partialAmount}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setUsePartialPayment(false);
                                        setPartialAmount(Number(invoice.outstanding).toFixed(2));
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
