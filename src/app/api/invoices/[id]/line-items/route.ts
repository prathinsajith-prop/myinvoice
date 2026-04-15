import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/services/vat";

type Params = { params: Promise<{ id: string }> };

const lineItemSchema = z.object({
    productId: z.string().optional().nullable(),
    description: z.string().min(1, "Description required"),
    quantity: z.coerce.number().positive("Must be > 0"),
    unitPrice: z.coerce.number().min(0),
    unitOfMeasure: z.string().default("unit"),
    discount: z.coerce.number().min(0).max(100).default(0),
    vatTreatment: z
        .enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "REVERSE_CHARGE", "OUT_OF_SCOPE"])
        .default("STANDARD_RATED"),
    vatRate: z.coerce.number().min(0).max(100).default(5),
    sortOrder: z.coerce.number().int().optional(),
});

const updateLineItemSchema = lineItemSchema.extend({
    id: z.string(),
});

async function getInvoiceOrThrow(invoiceId: string, organizationId: string) {
    const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId, deletedAt: null },
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    if (!invoice) throw new NotFoundError("Invoice");
    if (invoice.status === "VOID") throw new ForbiddenError("Cannot edit a voided invoice");
    return invoice;
}

async function recalculateInvoiceTotals(invoiceId: string) {
    const lineItems = await prisma.invoiceLineItem.findMany({
        where: { invoiceId },
        orderBy: { sortOrder: "asc" },
    });

    const calculated = lineItems.map((item) =>
        calculateLineItem({
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
            vatTreatment: item.vatTreatment as "STANDARD_RATED",
            vatRate: Number(item.vatRate),
        })
    );

    const totals = calculateDocumentTotals(calculated);

    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { amountPaid: true },
    });

    const amountPaid = Number(invoice?.amountPaid ?? 0);
    const outstanding = Math.max(0, totals.total - amountPaid);

    return prisma.invoice.update({
        where: { id: invoiceId },
        data: {
            subtotal: totals.subtotal,
            totalVat: totals.totalVat,
            discount: totals.discount,
            total: totals.total,
            outstanding,
        },
        include: {
            lineItems: { orderBy: { sortOrder: "asc" } },
            customer: true,
            payments: {
                include: {
                    payment: {
                        select: {
                            id: true,
                            paymentNumber: true,
                            amount: true,
                            paymentDate: true,
                            method: true,
                        },
                    },
                },
            },
        },
    });
}

// POST — Add a new line item
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const body = await req.json();

        await getInvoiceOrThrow(id, ctx.organizationId);

        const result = lineItemSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const calc = calculateLineItem({
            quantity: result.data.quantity,
            unitPrice: result.data.unitPrice,
            discount: result.data.discount,
            vatTreatment: result.data.vatTreatment,
            vatRate: result.data.vatRate,
        });

        // Get max sort order
        const maxSort = await prisma.invoiceLineItem.aggregate({
            where: { invoiceId: id },
            _max: { sortOrder: true },
        });

        await prisma.invoiceLineItem.create({
            data: {
                invoiceId: id,
                productId: result.data.productId ?? null,
                description: result.data.description,
                quantity: result.data.quantity,
                unitPrice: result.data.unitPrice,
                unitOfMeasure: result.data.unitOfMeasure,
                discount: result.data.discount,
                vatTreatment: result.data.vatTreatment,
                vatRate: calc.effectiveVatRate,
                subtotal: calc.subtotal,
                vatAmount: calc.vatAmount,
                total: calc.total,
                sortOrder: result.data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
            },
        });

        const updated = await recalculateInvoiceTotals(id);
        return NextResponse.json(updated, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}

// PATCH — Update an existing line item
export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const body = await req.json();

        await getInvoiceOrThrow(id, ctx.organizationId);

        const result = updateLineItemSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        // Verify line item belongs to this invoice
        const existing = await prisma.invoiceLineItem.findFirst({
            where: { id: result.data.id, invoiceId: id },
        });
        if (!existing) throw new NotFoundError("Line item");

        const calc = calculateLineItem({
            quantity: result.data.quantity,
            unitPrice: result.data.unitPrice,
            discount: result.data.discount,
            vatTreatment: result.data.vatTreatment,
            vatRate: result.data.vatRate,
        });

        await prisma.invoiceLineItem.update({
            where: { id: result.data.id },
            data: {
                productId: result.data.productId ?? null,
                description: result.data.description,
                quantity: result.data.quantity,
                unitPrice: result.data.unitPrice,
                unitOfMeasure: result.data.unitOfMeasure,
                discount: result.data.discount,
                vatTreatment: result.data.vatTreatment,
                vatRate: calc.effectiveVatRate,
                subtotal: calc.subtotal,
                vatAmount: calc.vatAmount,
                total: calc.total,
                sortOrder: result.data.sortOrder ?? existing.sortOrder,
            },
        });

        const updated = await recalculateInvoiceTotals(id);
        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}

// DELETE — Remove a line item
export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const lineItemId = searchParams.get("lineItemId");

        if (!lineItemId) {
            return NextResponse.json({ error: "lineItemId is required" }, { status: 400 });
        }

        const invoice = await getInvoiceOrThrow(id, ctx.organizationId);

        // Verify line item belongs to this invoice
        const existing = await prisma.invoiceLineItem.findFirst({
            where: { id: lineItemId, invoiceId: id },
        });
        if (!existing) throw new NotFoundError("Line item");

        // Prevent deleting the last line item
        if (invoice.lineItems.length <= 1) {
            return NextResponse.json(
                { error: "Cannot delete the last line item" },
                { status: 400 }
            );
        }

        await prisma.invoiceLineItem.delete({ where: { id: lineItemId } });

        const updated = await recalculateInvoiceTotals(id);
        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}
