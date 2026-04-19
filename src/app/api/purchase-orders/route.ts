import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { normalizeDocumentBody } from "@/lib/api/normalize";
import { toErrorResponse } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/services/vat";
import { parsePagination } from "@/lib/utils";

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

const createPOSchema = z.object({
    supplierId: z.string().min(1),
    reference: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    issueDate: z.string().optional(),
    expectedDate: z.string().optional().nullable(),
    currency: z.string().default("AED"),
    exchangeRate: z.coerce.number().positive().default(1),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    shippingAddress: z.string().optional().nullable(),
    lineItems: z.array(lineItemSchema).min(1),
});

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const { searchParams } = new URL(req.url);

        const status = searchParams.get("status");
        const supplierId = searchParams.get("supplierId");
        const search = searchParams.get("search") ?? "";
        const { page, limit, skip } = parsePagination(searchParams);

        const where = {
            organizationId: ctx.organizationId,
            deletedAt: null,
            ...(status ? { status: status as never } : {}),
            ...(supplierId ? { supplierId } : {}),
            ...(search
                ? {
                    OR: [
                        { poNumber: { contains: search, mode: "insensitive" as const } },
                        { reference: { contains: search, mode: "insensitive" as const } },
                        { supplier: { name: { contains: search, mode: "insensitive" as const } } },
                    ],
                }
                : {}),
        };

        const [purchaseOrders, total] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where,
                orderBy: { issueDate: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    poNumber: true,
                    status: true,
                    currency: true,
                    total: true,
                    issueDate: true,
                    expectedDate: true,
                    supplier: { select: { id: true, name: true } },
                },
            }),
            prisma.purchaseOrder.count({ where }),
        ]);

        return NextResponse.json({
            data: purchaseOrders,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const rawBody = await req.json();
        const body = normalizeDocumentBody(rawBody);

        const parsed = createPOSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: parsed.error.flatten() },
                { status: 400 },
            );
        }

        const data = parsed.data;

        // Verify supplier belongs to org
        const supplier = await prisma.supplier.findFirst({
            where: { id: data.supplierId, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!supplier) {
            return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
        }

        // Generate PO number
        const org = await prisma.organization.findUnique({
            where: { id: ctx.organizationId },
            select: { id: true },
        });
        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        // Use a simple sequential number since PO isn't a DocumentType enum value
        const lastPO = await prisma.purchaseOrder.findFirst({
            where: { organizationId: ctx.organizationId },
            orderBy: { createdAt: "desc" },
            select: { poNumber: true },
        });
        const nextSeq = lastPO
            ? (parseInt(lastPO.poNumber.replace(/\D/g, ""), 10) || 0) + 1
            : 1;
        const poNumber = `PO-${String(nextSeq).padStart(4, "0")}`;

        // Calculate line items
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

        const totals = calculateDocumentTotals(
            processedLineItems,
        );

        const po = await prisma.purchaseOrder.create({
            data: {
                organizationId: ctx.organizationId,
                supplierId: data.supplierId,
                poNumber,
                reference: data.reference,
                description: data.description,
                issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
                expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
                currency: data.currency,
                exchangeRate: data.exchangeRate,
                subtotal: totals.subtotal,
                totalVat: totals.totalVat,
                discount: totals.discount,
                total: totals.total,
                notes: data.notes,
                terms: data.terms,
                internalNotes: data.internalNotes,
                shippingAddress: data.shippingAddress,
                lineItems: {
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
            },
            include: {
                supplier: { select: { id: true, name: true } },
                lineItems: true,
            },
        });

        logApiAudit({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            action: "CREATE",
            entityType: "purchaseOrder",
            entityId: po.id,
            entityRef: po.poNumber,
        });

        return NextResponse.json(po, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
