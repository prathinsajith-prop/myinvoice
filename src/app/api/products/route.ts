import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";

const createProductSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    unitPrice: z.number().min(0),
    currency: z.string().default("AED"),
    vatTreatment: z
        .enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "REVERSE_CHARGE", "OUT_OF_SCOPE"])
        .default("STANDARD_RATED"),
    vatRate: z.number().min(0).max(100).default(5),
    type: z.enum(["PRODUCT", "SERVICE"]).default("SERVICE"),
    unitOfMeasure: z.string().default("unit"),
    category: z.string().optional().nullable(),
    trackInventory: z.boolean().default(false),
    stockQuantity: z.number().optional().nullable(),
    lowStockAlert: z.number().optional().nullable(),
});

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") ?? "";
        const type = searchParams.get("type");
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
        const limit = Math.min(100, parseInt(searchParams.get("limit") ?? searchParams.get("pageSize") ?? "20"));
        const skip = (page - 1) * limit;

        const where = {
            organizationId: ctx.organizationId,
            isActive: true,
            deletedAt: null,
            ...(type ? { type: type as "PRODUCT" | "SERVICE" } : {}),
            ...(search
                ? {
                    OR: [
                        { name: { contains: search, mode: "insensitive" as const } },
                        { sku: { contains: search, mode: "insensitive" as const } },
                        { description: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {}),
        };

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                select: {
                    id: true, name: true, sku: true, type: true, unitPrice: true,
                    currency: true, vatTreatment: true, vatRate: true, unitOfMeasure: true,
                    category: true, stockQuantity: true, isActive: true,
                },
                orderBy: { name: "asc" },
                skip,
                take: limit,
            }),
            prisma.product.count({ where }),
        ]);

        return NextResponse.json({ data: products, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const body = await req.json();

        const result = createProductSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        // Check for duplicate SKU within org
        if (result.data.sku) {
            const existing = await prisma.product.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    sku: result.data.sku,
                    deletedAt: null,
                },
            });
            if (existing) {
                return NextResponse.json(
                    { error: "A product with this SKU already exists" },
                    { status: 409 }
                );
            }
        }

        const product = await prisma.product.create({
            data: { ...result.data, organizationId: ctx.organizationId },
        });

        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "CREATE", entityType: "Product", entityId: product.id, entityRef: product.name, newData: result.data, req });

        return NextResponse.json(product, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
