import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";

const lineItemSchema = z.object({
    productId: z.string().optional().nullable(),
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    unitOfMeasure: z.string().default("unit"),
    discount: z.coerce.number().min(0).max(100).default(0),
    vatTreatment: z.string().default("STANDARD_RATED"),
    vatRate: z.coerce.number().min(0).max(100).default(5),
    sortOrder: z.coerce.number().int().default(0),
});

const createSchema = z.object({
    customerId: z.string().min(1),
    templateName: z.string().optional(),
    frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUALLY", "ANNUALLY"]),
    startDate: z.string().min(1),
    endDate: z.string().optional().nullable(),
    occurrencesLeft: z.coerce.number().int().positive().optional().nullable(),
    invoiceType: z.string().default("TAX_INVOICE"),
    currency: z.string().default("AED"),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    autoSend: z.boolean().default(false),
    lineItems: z.array(lineItemSchema).min(1),
});

function computeNextRunDate(startDate: Date, frequency: string): Date {
    const d = new Date(startDate);
    switch (frequency) {
        case "WEEKLY": d.setDate(d.getDate() + 7); break;
        case "BIWEEKLY": d.setDate(d.getDate() + 14); break;
        case "MONTHLY": d.setMonth(d.getMonth() + 1); break;
        case "QUARTERLY": d.setMonth(d.getMonth() + 3); break;
        case "SEMI_ANNUALLY": d.setMonth(d.getMonth() + 6); break;
        case "ANNUALLY": d.setFullYear(d.getFullYear() + 1); break;
    }
    return d;
}

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
        const status = searchParams.get("status");
        const search = searchParams.get("search")?.trim();

        const where: Record<string, unknown> = {
            organizationId: ctx.organizationId,
            deletedAt: null,
        };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { templateName: { contains: search, mode: "insensitive" } },
                { customer: { name: { contains: search, mode: "insensitive" } } },
            ];
        }

        const [data, total] = await Promise.all([
            prisma.recurringInvoice.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true } },
                    _count: { select: { generatedInvoices: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.recurringInvoice.count({ where }),
        ]);

        return NextResponse.json({
            data,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const body = await req.json();
        const result = createSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const { lineItems, ...data } = result.data;

        // Verify customer belongs to this org
        const customer = await prisma.customer.findFirst({
            where: { id: data.customerId, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!customer) throw new NotFoundError("Customer");

        // Calculate totals
        let subtotal = 0;
        let totalVat = 0;
        let discount = 0;

        const processedItems = lineItems.map((item, i) => {
            const lineTotal = item.quantity * item.unitPrice;
            const lineDiscount = lineTotal * (item.discount / 100);
            const taxableAmount = lineTotal - lineDiscount;
            const lineVat = taxableAmount * (item.vatRate / 100);
            subtotal += lineTotal;
            discount += lineDiscount;
            totalVat += lineVat;
            return { ...item, sortOrder: item.sortOrder || i };
        });

        const total = subtotal - discount + totalVat;
        const startDate = new Date(data.startDate);
        const nextRunDate = startDate;

        const recurring = await prisma.recurringInvoice.create({
            data: {
                organizationId: ctx.organizationId,
                customerId: data.customerId,
                templateName: data.templateName ?? null,
                frequency: data.frequency,
                startDate,
                endDate: data.endDate ? new Date(data.endDate) : null,
                nextRunDate,
                occurrencesLeft: data.occurrencesLeft ?? null,
                invoiceType: data.invoiceType,
                currency: data.currency,
                notes: data.notes ?? null,
                terms: data.terms ?? null,
                autoSend: data.autoSend,
                subtotal,
                totalVat,
                discount,
                total,
                lineItems: {
                    create: processedItems,
                },
            },
            include: {
                customer: { select: { id: true, name: true } },
                lineItems: true,
            },
        });

        return NextResponse.json(recurring, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
