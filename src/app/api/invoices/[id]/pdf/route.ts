import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";
import { generateInvoicePdf } from "@/lib/services/invoice-pdf";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                organization: {
                    select: {
                        name: true,
                        legalName: true,
                        trn: true,
                        logo: true,
                        primaryColor: true,
                        secondaryColor: true,
                        phone: true,
                        website: true,
                        addressLine1: true,
                        addressLine2: true,
                        city: true,
                        emirate: true,
                        postalCode: true,
                    }
                },
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
            organizationLogo: invoice.organization.logo,
            organizationPhone: invoice.organization.phone,
            organizationWebsite: invoice.organization.website,
            organizationAddress: [
                invoice.organization.addressLine1,
                invoice.organization.addressLine2,
                invoice.organization.city,
                invoice.organization.emirate,
                invoice.organization.postalCode,
            ]
                .filter(Boolean)
                .join(", "),
            primaryColor: invoice.organization.primaryColor,
            accentColor: invoice.organization.secondaryColor,
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

        return new NextResponse(Buffer.from(pdfBytes) as unknown as BodyInit, {
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
