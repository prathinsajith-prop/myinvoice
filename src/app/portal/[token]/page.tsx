import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PageProps {
    params: Promise<{ token: string }>;
}

export default async function PortalInvoicePage({ params }: PageProps) {
    const { token } = await params;

    const invoice = await prisma.invoice.findFirst({
        where: { publicToken: token, deletedAt: null },
        include: {
            organization: { select: { name: true, legalName: true, email: true, phone: true, website: true } },
            customer: { select: { name: true, email: true } },
            lineItems: { orderBy: { sortOrder: "asc" } },
        },
    });

    if (!invoice) notFound();

    await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
            viewCount: { increment: 1 },
            viewedAt: new Date(),
            status: invoice.status === "SENT" ? "VIEWED" : invoice.status,
        },
    });

    const waText = encodeURIComponent(
        `Invoice ${invoice.invoiceNumber} from ${invoice.organization.legalName || invoice.organization.name}\nAmount: ${invoice.currency} ${Number(invoice.total).toFixed(2)}\nView: ${process.env.NEXT_PUBLIC_APP_URL || ""}/portal/${invoice.publicToken}`
    );

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
                    <Button variant="outline" asChild>
                        <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer">Share via WhatsApp</a>
                    </Button>
                </div>
            </div>
        </div>
    );
}
