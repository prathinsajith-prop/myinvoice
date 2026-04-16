import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";

const updateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    unitPrice: z.number().min(0).optional(),
    currency: z.string().optional(),
    vatTreatment: z
        .enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "REVERSE_CHARGE", "OUT_OF_SCOPE"])
        .optional(),
    vatRate: z.number().min(0).max(100).optional(),
    type: z.enum(["PRODUCT", "SERVICE"]).optional(),
    unitOfMeasure: z.string().optional(),
    category: z.string().optional().nullable(),
    trackInventory: z.boolean().optional(),
    stockQuantity: z.number().optional().nullable(),
    lowStockAlert: z.number().optional().nullable(),
    isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;
        const product = await prisma.product.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!product) throw new NotFoundError("Product");
        return NextResponse.json(product);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;
        const body = await req.json();
        const existing = await prisma.product.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!existing) throw new NotFoundError("Product");
        const result = updateSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }
        const product = await prisma.product.update({ where: { id }, data: result.data });
        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "UPDATE", entityType: "Product", entityId: id, entityRef: product.name, previousData: existing, newData: result.data, req });
        return NextResponse.json(product);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;
        const existing = await prisma.product.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!existing) throw new NotFoundError("Product");
        await prisma.product.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "DELETE", entityType: "Product", entityId: id, entityRef: existing.name, req });
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
