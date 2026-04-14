import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";
import { getNextDocumentNumber } from "@/lib/services/numbering";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/quotations/[id]/convert
 * Convert an accepted quotation into a draft invoice.
 */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const quotation = await prisma.quotation.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: { lineItems: true, invoice: { select: { id: true } } },
        });

        if (!quotation) throw new NotFoundError("Quotation");
        if (quotation.invoice) throw new ForbiddenError("Quotation has already been converted");
        if (!["DRAFT", "SENT", "VIEWED", "ACCEPTED"].includes(quotation.status as string)) {
            throw new ForbiddenError("Only open quotations can be converted to an invoice");
        }

        const invoiceNumber = await getNextDocumentNumber(ctx.organizationId, "INVOICE");

        const invoice = await prisma.$transaction(async (tx) => {
            const inv = await tx.invoice.create({
                data: {
                    organizationId: ctx.organizationId,
                    customerId: quotation.customerId,
                    quotationId: quotation.id,
                    invoiceNumber,
                    invoiceType: "TAX_INVOICE",
                    issueDate: new Date(),
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
                    currency: quotation.currency,
                    exchangeRate: quotation.exchangeRate,
                    subtotal: quotation.subtotal,
                    totalVat: quotation.totalVat,
                    discount: quotation.discount,
                    total: quotation.total,
                    outstanding: quotation.total,
                    amountPaid: 0,
                    status: "DRAFT",
                    lineItems: {
                        create: quotation.lineItems.map((item) => ({
                            productId: item.productId ?? null,
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
                    lineItems: { orderBy: { sortOrder: "asc" } },
                    customer: { select: { id: true, name: true, email: true } },
                },
            });

            await tx.quotation.update({
                where: { id },
                data: { status: "CONVERTED", convertedAt: new Date() },
            });

            return inv;
        });

        return NextResponse.json(invoice, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
