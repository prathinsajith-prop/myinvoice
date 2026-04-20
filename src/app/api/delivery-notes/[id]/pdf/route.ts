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

        const note = await prisma.deliveryNote.findFirst({
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

        if (!note) throw new NotFoundError("Delivery Note");

        const orgAddress = [
            note.organization.addressLine1,
            note.organization.addressLine2,
            note.organization.city,
            note.organization.emirate,
            note.organization.postalCode,
        ].filter(Boolean).join(", ");

        const bytes = await generateDocumentPdf({
            docType: "DELIVERY_NOTE",
            docNumber: note.deliveryNoteNumber,
            status: note.status,
            currency: note.currency,
            issueDate: note.issueDate,
            deliveryDate: note.deliveryDate,
            partyName: note.customer.name,
            partyEmail: note.customer.email,
            partyType: "customer",
            shippingAddress: note.shippingAddress,
            trackingNumber: note.trackingNumber,
            carrier: note.carrier,
            driverName: note.driverName,
            vehicleNumber: note.vehicleNumber,
            organizationName: note.organization.legalName || note.organization.name,
            organizationTrn: note.organization.trn,
            organizationLogo: note.organization.logo,
            organizationPhone: note.organization.phone,
            organizationWebsite: note.organization.website,
            organizationAddress: orgAddress,
            primaryColor: note.organization.primaryColor,
            accentColor: note.organization.secondaryColor,
            notes: note.notes,
            lineItems: note.lineItems.map((item) => ({
                description: item.description,
                quantity: Number(item.quantity),
                unitOfMeasure: item.unitOfMeasure,
                notes: item.notes ?? undefined,
            })),
        });

        return new NextResponse(new Blob([bytes], { type: "application/pdf" }), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${note.deliveryNoteNumber}.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        return toErrorResponse(err);
    }
}
