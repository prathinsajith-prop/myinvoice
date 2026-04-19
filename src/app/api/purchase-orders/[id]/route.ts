import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext, resolveApiContextWithPermission } from "@/lib/api/auth";
import { normalizeDocumentBody } from "@/lib/api/normalize";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/services/vat";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
    supplierId: z.string().optional(),
    reference: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    issueDate: z.string().optional(),
    expectedDate: z.string().optional().nullable(),
    currency: z.string().optional(),
    exchangeRate: z.coerce.number().positive().optional(),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    shippingAddress: z.string().optional().nullable(),
    status: z.enum(["DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"]).optional(),
    lineItems: z.array(z.object({
        productId: z.string().optional().nullable(),
        description: z.string().min(1),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().min(0),
        unitOfMeasure: z.string().default("unit"),
        discount: z.coerce.number().min(0).max(100).default(0),
        vatTreatment: z.enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE", "REVERSE_CHARGE"]).default("STANDARD_RATED"),
        vatRate: z.coerce.number().min(0).max(100).default(5),
        sortOrder: z.coerce.number().int().default(0),
    })).optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const po = await prisma.purchaseOrder.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                supplier: { select: { id: true, name: true, email: true, phone: true } },
                lineItems: { orderBy: { sortOrder: "asc" } },
            },
        });

        if (!po) throw new NotFoundError("Purchase Order");

        return NextResponse.json(po);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "edit");
        const { id } = await params;

        const po = await prisma.purchaseOrder.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!po) throw new NotFoundError("Purchase Order");
        if (po.status === "CANCELLED") throw new ForbiddenError("Cannot edit a cancelled purchase order");

        const rawBody = await req.json();
        const body = normalizeDocumentBody(rawBody);
        const parsed = updateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: parsed.error.flatten() },
                { status: 400 },
            );
        }

        const data = parsed.data;
        const previousData = { status: po.status, total: po.total };

        // Recalculate totals if line items provided
        let totalsUpdate = {};
        let lineItemOps = {};

        if (data.lineItems) {
            const processedLineItems = data.lineItems.map((item, idx) => {
                const calc = calculateLineItem({
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    vatTreatment: item.vatTreatment as never,
                    vatRate: item.vatRate,
                });
                return { ...item, ...calc, sortOrder: item.sortOrder ?? idx };
            });

            const totals = calculateDocumentTotals(processedLineItems);
            totalsUpdate = {
                subtotal: totals.subtotal,
                totalVat: totals.totalVat,
                discount: totals.discount,
                total: totals.total,
            };

            lineItemOps = {
                lineItems: {
                    deleteMany: {},
                    create: processedLineItems.map((item) => ({
                        productId: item.productId ?? null,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        unitOfMeasure: item.unitOfMeasure,
                        discount: item.discount,
                        vatTreatment: item.vatTreatment as never,
                        vatRate: item.vatRate,
                        subtotal: item.subtotal,
                        vatAmount: item.vatAmount,
                        total: item.total,
                        sortOrder: item.sortOrder,
                    })),
                },
            };
        }

        const updated = await prisma.purchaseOrder.update({
            where: { id },
            data: {
                ...(data.supplierId ? { supplierId: data.supplierId } : {}),
                reference: data.reference,
                description: data.description,
                issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
                expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
                currency: data.currency,
                exchangeRate: data.exchangeRate,
                notes: data.notes,
                terms: data.terms,
                internalNotes: data.internalNotes,
                shippingAddress: data.shippingAddress,
                ...(data.status ? { status: data.status } : {}),
                ...totalsUpdate,
                ...lineItemOps,
            },
            include: {
                supplier: { select: { id: true, name: true } },
                lineItems: { orderBy: { sortOrder: "asc" } },
            },
        });

        logApiAudit({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            action: "UPDATE",
            entityType: "purchaseOrder",
            entityId: id,
            entityRef: po.poNumber,
            previousData,
            newData: { status: updated.status, total: updated.total },
        });

        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "delete");
        const { id } = await params;

        const po = await prisma.purchaseOrder.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!po) throw new NotFoundError("Purchase Order");
        if (po.status !== "DRAFT") {
            throw new ForbiddenError("Only DRAFT purchase orders can be deleted. Cancel sent/confirmed orders.");
        }

        await prisma.purchaseOrder.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        logApiAudit({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            action: "SOFT_DELETE",
            entityType: "purchaseOrder",
            entityId: id,
            entityRef: po.poNumber,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
