import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";
import { generateDocumentPdf } from "@/lib/services/document-pdf";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const quotation = await prisma.quotation.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                organization: {
                    select: {
                        name: true, legalName: true, trn: true, logo: true,
                        primaryColor: true, secondaryColor: true,
                        phone: true, website: true,
                        addressLine1: true, addressLine2: true, city: true, emirate: true, postalCode: true,
                    },
                },
                customer: { select: { name: true, email: true } },
                lineItems: { orderBy: { sortOrder: "asc" } },
            },
        });

        if (!quotation) throw new NotFoundError("Quotation");

        const orgAddress = [
            quotation.organization.addressLine1,
            quotation.organization.addressLine2,
            quotation.organization.city,
            quotation.organization.emirate,
            quotation.organization.postalCode,
        ].filter(Boolean).join(", ");

        const bytes = await generateDocumentPdf({
            docType: "QUOTATION",
            docNumber: quotation.quoteNumber,
            status: quotation.status,
            currency: quotation.currency,
            issueDate: quotation.issueDate,
            expiryDate: quotation.validUntil,
            subtotal: Number(quotation.subtotal),
            totalVat: Number(quotation.totalVat),
            totalDiscount: Number(quotation.discount),
            total: Number(quotation.total),
            partyName: quotation.customer.name,
            partyEmail: quotation.customer.email,
            partyType: "customer",
            reference: quotation.reference,
            organizationName: quotation.organization.legalName || quotation.organization.name,
            organizationTrn: quotation.organization.trn,
            organizationLogo: quotation.organization.logo,
            organizationPhone: quotation.organization.phone,
            organizationWebsite: quotation.organization.website,
            organizationAddress: orgAddress,
            primaryColor: quotation.organization.primaryColor,
            accentColor: quotation.organization.secondaryColor,
            notes: quotation.notes,
            terms: quotation.terms,
            lineItems: quotation.lineItems.map((item) => ({
                description: item.description,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                vatAmount: Number(item.vatAmount),
                total: Number(item.total),
            })),
        });

        return new NextResponse(new Blob([bytes], { type: "application/pdf" }), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${quotation.quoteNumber}.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        return toErrorResponse(err);
    }
}
