import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { getNextDocumentNumber } from "@/lib/services/numbering";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/services/vat";

const lineItemSchema = z.object({
    productId: z.string().optional().nullable(),
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    unitOfMeasure: z.string().default("unit"),
    discount: z.number().min(0).max(100).default(0),
    vatTreatment: z
        .enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE", "REVERSE_CHARGE"])
        .default("STANDARD_RATED"),
    vatRate: z.number().min(0).max(100).default(5),
    sortOrder: z.number().int().default(0),
    isReclaimable: z.boolean().default(true),
});

const createBillSchema = z.object({
    supplierId: z.string().min(1),
    supplierInvoiceNumber: z.string().optional().nullable(),
    reference: z.string().optional().nullable(),
    issueDate: z.string().datetime().optional(),
    dueDate: z.string().datetime(),
    receivedDate: z.string().datetime().optional().nullable(),
    currency: z.string().default("AED"),
    exchangeRate: z.number().positive().default(1),
    supplierTrn: z.string().optional().nullable(),
    vatReclaimable: z.boolean().default(true),
    notes: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    lineItems: z.array(lineItemSchema).min(1),
});

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
                        { billNumber: { contains: search, mode: "insensitive" as const } },
                        { supplierInvoiceNumber: { contains: search, mode: "insensitive" as const } },
                        { reference: { contains: search, mode: "insensitive" as const } },
                        { supplier: { name: { contains: search, mode: "insensitive" as const } } },
                    ],
                }
                : {}),
        };

        const [records, total] = await Promise.all([
            prisma.bill.findMany({
                where,
                include: {
                    supplier: { select: { id: true, name: true, email: true } },
                    _count: { select: { lineItems: true } },
                },
                orderBy: { issueDate: "desc" },
                skip,
                take: limit,
            }),
            prisma.bill.count({ where }),
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

        const result = createBillSchema.safeParse(body);
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
        const billNumber = await getNextDocumentNumber(ctx.organizationId, "BILL");
        const inputVatAmount = data.vatReclaimable ? Number(totals.totalVat) : 0;

        const bill = await prisma.bill.create({
            data: {
                organizationId: ctx.organizationId,
                supplierId: data.supplierId,
                billNumber,
                supplierInvoiceNumber: data.supplierInvoiceNumber ?? null,
                reference: data.reference ?? null,
                issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
                dueDate: new Date(data.dueDate),
                receivedDate: data.receivedDate ? new Date(data.receivedDate) : null,
                currency: data.currency,
                exchangeRate: data.exchangeRate,
                supplierTrn: data.supplierTrn ?? null,
                vatReclaimable: data.vatReclaimable,
                inputVatAmount,
                notes: data.notes ?? null,
                internalNotes: data.internalNotes ?? null,
                subtotal: totals.subtotal,
                totalVat: totals.totalVat,
                discount: totals.discount,
                total: totals.total,
                outstanding: totals.total,
                amountPaid: 0,
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
                        isReclaimable: item.isReclaimable,
                        sortOrder: item.sortOrder ?? index,
                    })),
                },
            },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                supplier: { select: { id: true, name: true, email: true } },
            },
        });

        return NextResponse.json(bill, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
