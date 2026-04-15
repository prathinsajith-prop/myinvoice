import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";
import { generateInvoicePdf } from "@/lib/services/invoice-pdf";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                organization: { select: { name: true, legalName: true, trn: true } },
                customer: { select: { name: true, email: true } },
                lineItems: { orderBy: { sortOrder: "asc" } },
            },
        });

        if (!invoice) throw new NotFoundError("Invoice");

        const bytes = await generateInvoicePdf({
            invoiceNumber: invoice.invoiceNumber,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            currency: invoice.currency,
            subtotal: Number(invoice.subtotal),
            totalVat: Number(invoice.totalVat),
            total: Number(invoice.total),
            outstanding: Number(invoice.outstanding),
            customerName: invoice.customer.name,
            customerEmail: invoice.customer.email,
            organizationName: invoice.organization.legalName || invoice.organization.name,
            organizationTrn: invoice.organization.trn,
            notes: invoice.notes,
            qrCodeData: invoice.qrCodeData,
            lineItems: invoice.lineItems.map((item) => ({
                description: item.description,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                vatAmount: Number(item.vatAmount),
                total: Number(item.total),
            })),
        });

        const pdfBytes = new Uint8Array(bytes);
        const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

        return new NextResponse(pdfBlob, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename=\"${invoice.invoiceNumber}.pdf\"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}
