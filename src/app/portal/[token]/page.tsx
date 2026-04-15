import { notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { APP_URL } from "@/lib/constants/env";
import { PortalInvoiceClient } from "./portal-invoice-client";

interface PageProps {
    params: Promise<{ token: string }>;
}

async function PortalInvoiceContent({ token }: { token: string }) {
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
        `Invoice ${invoice.invoiceNumber} from ${invoice.organization.legalName || invoice.organization.name}\nAmount: ${invoice.currency} ${Number(invoice.total).toFixed(2)}\nView: ${APP_URL}/portal/${invoice.publicToken}`
    );

    return (
        <PortalInvoiceClient
            invoice={{
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                status: invoice.status as string,
                issueDate: invoice.issueDate,
                dueDate: invoice.dueDate,
                currency: invoice.currency,
                subtotal: Number(invoice.subtotal),
                totalVat: Number(invoice.totalVat),
                total: Number(invoice.total),
                outstanding: Number(invoice.outstanding),
                publicToken: invoice.publicToken ?? "",
                customer: invoice.customer,
                organization: {
                    name: invoice.organization.name,
                    legalName: invoice.organization.legalName ?? undefined,
                },
                lineItems: invoice.lineItems.map((li) => ({
                    id: li.id,
                    description: li.description,
                    quantity: Number(li.quantity),
                    unitPrice: Number(li.unitPrice),
                    total: Number(li.total),
                })),
            }}
            waText={waText}
        />
    );
}

export default async function PortalInvoicePage({ params }: PageProps) {
    const { token } = await params;
    return <PortalInvoiceContent token={token} />;
}
