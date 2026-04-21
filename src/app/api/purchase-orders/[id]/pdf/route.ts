import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";
import { generateDocumentPdf } from "@/lib/pdf";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const po = await prisma.purchaseOrder.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                organization: {
                    select: {
                        name: true, legalName: true, trn: true, logo: true,
                        primaryColor: true, secondaryColor: true, pdfTemplate: true,
                        phone: true, website: true,
                        addressLine1: true, addressLine2: true, city: true, emirate: true, postalCode: true,
                    },
                },
                supplier: { select: { name: true, email: true } },
                lineItems: { orderBy: { sortOrder: "asc" } },
            },
        });

        if (!po) throw new NotFoundError("Purchase Order");

        const orgAddress = [
            po.organization.addressLine1,
            po.organization.addressLine2,
            po.organization.city,
            po.organization.emirate,
            po.organization.postalCode,
        ].filter(Boolean).join(", ");

        const bytes = await generateDocumentPdf({
            docType: "PURCHASE_ORDER",
            docNumber: po.poNumber,
            status: po.status,
            currency: po.currency,
            issueDate: po.issueDate,
            expectedDate: po.expectedDate,
            subtotal: Number(po.subtotal),
            totalVat: Number(po.totalVat),
            totalDiscount: Number(po.discount),
            total: Number(po.total),
            partyName: po.supplier.name,
            partyEmail: po.supplier.email,
            partyType: "supplier",
            reference: po.reference,
            shippingAddress: po.shippingAddress,
            organizationName: po.organization.legalName || po.organization.name,
            organizationTrn: po.organization.trn,
            organizationLogo: po.organization.logo,
            organizationPhone: po.organization.phone,
            organizationWebsite: po.organization.website,
            organizationAddress: orgAddress,
            primaryColor: po.organization.primaryColor,
            accentColor: po.organization.secondaryColor,
            notes: po.notes,
            terms: po.terms,
            lineItems: po.lineItems.map((item) => ({
                description: item.description,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                discount: Number(item.discount),
                vatAmount: Number(item.vatAmount),
                total: Number(item.total),
            })),
        }, po.organization.pdfTemplate);

        return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${po.poNumber}.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        return toErrorResponse(err);
    }
}
