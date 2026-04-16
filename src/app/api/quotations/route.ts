import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { normalizeDocumentBody } from "@/lib/api/normalize";
import { toErrorResponse } from "@/lib/errors";
import { getNextDocumentNumber } from "@/lib/services/numbering";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/services/vat";
import { notifyOrgMembers } from "@/lib/notifications/create";

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

const createQuotationSchema = z.object({
    customerId: z.string().min(1),
    reference: z.string().optional().nullable(),
    issueDate: z.string().optional(),
    validUntil: z.string(),
    currency: z.string().default("AED"),
    exchangeRate: z.coerce.number().positive().default(1),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    lineItems: z.array(lineItemSchema).min(1),
});

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const { searchParams } = new URL(req.url);

        const status = searchParams.get("status");
        const search = searchParams.get("search") ?? "";
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
        const skip = (page - 1) * limit;

        const where = {
            organizationId: ctx.organizationId,
            deletedAt: null,
            ...(status ? { status: status as unknown as never } : {}),
            ...(search
                ? {
                    OR: [
                        { quoteNumber: { contains: search, mode: "insensitive" as const } },
                        { reference: { contains: search, mode: "insensitive" as const } },
                        { customer: { name: { contains: search, mode: "insensitive" as const } } },
                    ],
                }
                : {}),
        };

        const [records, total] = await Promise.all([
            prisma.quotation.findMany({
                where: where as never,
                include: {
                    customer: { select: { id: true, name: true, email: true } },
                    _count: { select: { lineItems: true } },
                },
                orderBy: { issueDate: "desc" },
                skip,
                take: limit,
            }),
            prisma.quotation.count({ where: where as never }),
        ]);

        return NextResponse.json({
            data: records,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const raw = await req.json();
        const body = normalizeDocumentBody(raw);

        const result = createQuotationSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const { lineItems, ...data } = result.data;

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
        const quoteNumber = await getNextDocumentNumber(ctx.organizationId, "QUOTATION");

        const quotation = await prisma.quotation.create({
            data: {
                organizationId: ctx.organizationId,
                customerId: data.customerId,
                quoteNumber,
                reference: data.reference ?? null,
                issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
                validUntil: new Date(data.validUntil),
                currency: data.currency,
                exchangeRate: data.exchangeRate,
                notes: data.notes ?? null,
                terms: data.terms ?? null,
                internalNotes: data.internalNotes ?? null,
                subtotal: totals.subtotal,
                totalVat: totals.totalVat,
                discount: totals.discount,
                total: totals.total,
                lineItems: {
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
                },
            },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                customer: { select: { id: true, name: true, email: true } },
            },
        });

        // Notify org members about new quotation
        notifyOrgMembers({
            organizationId: ctx.organizationId,
            excludeUserId: ctx.userId,
            title: "New Quotation Created",
            message: `Quotation ${quotation.quoteNumber} has been created`,
            type: "GENERAL",
            entityType: "Quotation",
            entityId: quotation.id,
            actionUrl: `/quotations/${quotation.id}`,
        }).catch(() => { });

        return NextResponse.json(quotation, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
