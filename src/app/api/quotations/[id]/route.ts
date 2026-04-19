import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";
import { normalizeDocumentBody } from "@/lib/api/normalize";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/services/vat";

type Params = { params: Promise<{ id: string }> };

const lineItemSchema = z.object({
    productId: z.string().optional().nullable(),
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().min(0),
    unitOfMeasure: z.string().default("unit"),
    discount: z.coerce.number().min(0).max(100).default(0),
    vatTreatment: z
        .enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE", "REVERSE_CHARGE"])
        .default("STANDARD_RATED"),
    vatRate: z.coerce.number().min(0).max(100).default(5),
    sortOrder: z.coerce.number().int().default(0),
});

const updateQuotationSchema = z.object({
    customerId: z.string().min(1).optional(),
    reference: z.string().optional().nullable(),
    issueDate: z.string().optional(),
    validUntil: z.string().optional(),
    currency: z.string().optional(),
    exchangeRate: z.coerce.number().positive().optional(),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    termsAndConditions: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"]).optional(),
    lineItems: z.array(lineItemSchema).optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const quotation = await prisma.quotation.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                customer: true,
                invoice: { select: { id: true, invoiceNumber: true, status: true } },
                versions: { orderBy: { version: "desc" } },
                attachments: true,
            },
        });

        if (!quotation) throw new NotFoundError("Quotation");
        return NextResponse.json(quotation);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;
        const raw = await req.json();
        const body = normalizeDocumentBody(raw);

        const quotation = await prisma.quotation.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: { lineItems: true },
        });
        if (!quotation) throw new NotFoundError("Quotation");
        if (quotation.status === "CONVERTED") {
            throw new ForbiddenError("Cannot edit a converted quotation");
        }

        const result = updateQuotationSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const { lineItems, ...data } = result.data;

        let updateData: Record<string, unknown> = {
            ...(data.customerId ? { customerId: data.customerId } : {}),
            ...(data.reference !== undefined ? { reference: data.reference ?? null } : {}),
            ...(data.issueDate ? { issueDate: new Date(data.issueDate) } : {}),
            ...(data.validUntil ? { validUntil: new Date(data.validUntil) } : {}),
            ...(data.currency ? { currency: data.currency } : {}),
            ...(data.exchangeRate ? { exchangeRate: data.exchangeRate } : {}),
            ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
            ...(data.terms !== undefined ? { terms: data.terms ?? null } : {}),
            ...(data.termsAndConditions ? { terms: data.termsAndConditions } : {}),
            ...(data.internalNotes !== undefined ? { internalNotes: data.internalNotes ?? null } : {}),
            ...(data.status ? { status: data.status } : {}),
        };

        // Handle line items update
        if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
            const calculatedItems = lineItems.map((item) => {
                const calc = calculateLineItem({
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    vatTreatment: item.vatTreatment,
                    vatRate: item.vatRate,
                });
                return { ...item, ...calc };
            });

            const totals = calculateDocumentTotals(calculatedItems);
            updateData = {
                ...updateData,
                subtotal: totals.subtotal,
                totalVat: totals.totalVat,
                discount: totals.discount,
                total: totals.total,
            };

            // Delete old line items and create new ones
            await prisma.quotationLineItem.deleteMany({ where: { quotationId: id } });

            updateData.lineItems = {
                create: calculatedItems.map((item, index) => ({
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
                    sortOrder: item.sortOrder ?? index,
                })),
            };
        }

        const updated = await prisma.quotation.update({
            where: { id },
            data: updateData,
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                customer: { select: { id: true, name: true, email: true } },
            },
        });

        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "UPDATE", entityType: "Quotation", entityId: id, entityRef: updated.quoteNumber ?? id, previousData: quotation, newData: result.data, req });

        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const quotation = await prisma.quotation.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!quotation) throw new NotFoundError("Quotation");
        if (!["DRAFT", "REJECTED", "EXPIRED"].includes(quotation.status as string)) {
            throw new ForbiddenError("Only DRAFT, REJECTED, or EXPIRED quotations can be deleted");
        }

        await prisma.quotation.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "DELETE", entityType: "Quotation", entityId: id, entityRef: quotation.quoteNumber ?? id, req });

        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
