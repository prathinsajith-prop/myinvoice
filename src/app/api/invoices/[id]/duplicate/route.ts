import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveApiContextWithPermission } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";
import { getNextDocumentNumber } from "@/lib/services/numbering";
import { generatePublicToken } from "@/lib/crypto/token";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "create");
        const { id } = await params;

        const source = await prisma.invoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        });

        if (!source) throw new NotFoundError("Invoice");

        const invoiceNumber = await getNextDocumentNumber(
            ctx.organizationId,
            source.invoiceType === "PROFORMA" ? "PROFORMA" : "INVOICE"
        );

        const duplicate = await prisma.invoice.create({
            data: {
                organizationId: ctx.organizationId,
                customerId: source.customerId,
                invoiceNumber,
                invoiceType: source.invoiceType,
                reference: source.reference,
                poNumber: source.poNumber,
                issueDate: new Date(),
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                currency: source.currency,
                exchangeRate: source.exchangeRate,
                notes: source.notes,
                terms: source.terms,
                internalNotes: source.internalNotes,
                publicToken: generatePublicToken(),
                status: "DRAFT",
                subtotal: source.subtotal,
                totalVat: source.totalVat,
                discount: source.discount,
                total: source.total,
                outstanding: source.total,
                sellerTrn: source.sellerTrn,
                buyerTrn: source.buyerTrn,
                qrCodeData: source.qrCodeData,
                ftaCompliant: source.ftaCompliant,
                lineItems: {
                    create: source.lineItems.map((item) => ({
                        productId: item.productId,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        unitOfMeasure: item.unitOfMeasure,
                        discount: item.discount,
                        vatTreatment: item.vatTreatment,
                        vatRate: item.vatRate,
                        subtotal: item.subtotal,
                        vatAmount: item.vatAmount,
                        total: item.total,
                        sortOrder: item.sortOrder,
                    })),
                },
            },
            include: {
                lineItems: true,
                customer: { select: { id: true, name: true, email: true } },
            },
        });

        return NextResponse.json(duplicate, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
