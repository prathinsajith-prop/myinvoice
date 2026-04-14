import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/services/vat";

const lineItemSchema = z.object({
    productId: z.string().optional().nullable(),
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    unitOfMeasure: z.string().default("unit"),
    vatTreatment: z
        .enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE", "REVERSE_CHARGE"])
        .default("STANDARD_RATED"),
    vatRate: z.number().min(0).max(100).default(5),
    sortOrder: z.number().int().default(0),
});

const createCreditNoteSchema = z.object({
    customerId: z.string().min(1),
    invoiceId: z.string().min(1),
    reason: z.string().min(1),
    issueDate: z.string().datetime().optional(),
    currency: z.string().default("AED"),
    exchangeRate: z.number().positive().default(1),
    sellerTrn: z.string().optional().nullable(),
    buyerTrn: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    lineItems: z.array(lineItemSchema).min(1),
});

function genNumber(last: string | null, prefix: string): string {
    const next = last ? String(Number(last.replace(/[^0-9]/g, "")) + 1).padStart(4, "0") : "0001";
    return `${prefix}-${next}`;
}

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveApiContext(req);
        const { searchParams } = new URL(req.url);

        const status = searchParams.get("status");
        const search = searchParams.get("search") ?? "";
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
        const skip = (page - 1) * limit;

        const where = {
            organizationId: ctx.organizationId,
            deletedAt: null,
            ...(status ? { status: status as any } : {}),
            ...(search
                ? {
                    OR: [
                        { creditNoteNumber: { contains: search, mode: "insensitive" as const } },
                        { customer: { name: { contains: search, mode: "insensitive" as const } } },
                    ],
                }
                : {}),
        };

        const [records, total] = await Promise.all([
            prisma.creditNote.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, email: true } },
                    invoice: { select: { id: true, invoiceNumber: true } },
                },
                orderBy: { issueDate: "desc" },
                skip,
                take: limit,
            }),
            prisma.creditNote.count({ where }),
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
        const ctx = await resolveApiContext(req);
        const body = await req.json();

        const result = createCreditNoteSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const { lineItems, ...data } = result.data;

        const calculatedItems = lineItems.map((item) => ({
            ...item,
            ...calculateLineItem({
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: 0,
                vatTreatment: item.vatTreatment,
                vatRate: item.vatRate,
            }),
        }));

        const totals = calculateDocumentTotals(calculatedItems);

        const last = await prisma.creditNote.findFirst({
            where: { organizationId: ctx.organizationId },
            orderBy: { createdAt: "desc" },
            select: { creditNoteNumber: true },
        });
        const creditNoteNumber = genNumber(last?.creditNoteNumber ?? null, "CN");

        const creditNote = await prisma.creditNote.create({
            data: {
                organizationId: ctx.organizationId,
                customerId: data.customerId,
                invoiceId: data.invoiceId,
                creditNoteNumber,
                reason: data.reason,
                issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
                currency: data.currency,
                exchangeRate: data.exchangeRate,
                sellerTrn: data.sellerTrn ?? null,
                buyerTrn: data.buyerTrn ?? null,
                notes: data.notes ?? null,
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
                        vatTreatment: item.vatTreatment,
                        vatRate: item.vatRate,
                        subtotal: item.subtotal,
                        vatAmount: item.vatAmount,
                        total: item.total,
                        sortOrder: index,
                    })),
                },
            },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                customer: { select: { id: true, name: true } },
                invoice: { select: { id: true, invoiceNumber: true } },
            },
        });

        return NextResponse.json(creditNote, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
