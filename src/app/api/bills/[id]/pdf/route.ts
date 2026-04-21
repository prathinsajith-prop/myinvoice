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

        const bill = await prisma.bill.findFirst({
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

        if (!bill) throw new NotFoundError("Bill");

        const orgAddress = [
            bill.organization.addressLine1,
            bill.organization.addressLine2,
            bill.organization.city,
            bill.organization.emirate,
            bill.organization.postalCode,
        ].filter(Boolean).join(", ");

        const bytes = await generateDocumentPdf({
            docType: "BILL",
            docNumber: bill.billNumber,
            status: bill.status,
            currency: bill.currency,
            issueDate: bill.issueDate,
            dueDate: bill.dueDate,
            subtotal: Number(bill.subtotal),
            totalVat: Number(bill.totalVat),
            total: Number(bill.total),
            outstanding: Number(bill.outstanding),
            partyName: bill.supplier.name,
            partyEmail: bill.supplier.email,
            partyType: "supplier",
            reference: bill.supplierInvoiceNumber,
            organizationName: bill.organization.legalName || bill.organization.name,
            organizationTrn: bill.organization.trn,
            organizationLogo: bill.organization.logo,
            organizationPhone: bill.organization.phone,
            organizationWebsite: bill.organization.website,
            organizationAddress: orgAddress,
            primaryColor: bill.organization.primaryColor,
            accentColor: bill.organization.secondaryColor,
            notes: bill.notes,
            lineItems: bill.lineItems.map((item) => ({
                description: item.description,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                vatAmount: Number(item.vatAmount),
                total: Number(item.total),
            })),
        }, bill.organization.pdfTemplate);

        return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${bill.billNumber}.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        return toErrorResponse(err);
    }
}
