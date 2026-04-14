import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { normalizeDocumentBody } from "@/lib/api/normalize";
import { toErrorResponse } from "@/lib/errors";
import { getNextDocumentNumber } from "@/lib/services/numbering";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/services/vat";

const lineItemSchema = z.object({
    productId: z.string().optional().nullable(),
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().min(0),
    unitOfMeasure: z.string().default("unit"),
    discount: z.coerce.number().min(0).max(100).default(0),
    vatTreatment: z
        .enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "REVERSE_CHARGE", "OUT_OF_SCOPE"])
        .default("STANDARD_RATED"),
    vatRate: z.coerce.number().min(0).max(100).default(5),
    sortOrder: z.coerce.number().int().default(0),
});

const createInvoiceSchema = z.object({
    customerId: z.string(),
    invoiceType: z.enum(["TAX_INVOICE", "SIMPLIFIED_TAX", "PROFORMA"]).default("TAX_INVOICE"),
    reference: z.string().optional().nullable(),
    poNumber: z.string().optional().nullable(),
    issueDate: z.string().optional(),
    dueDate: z.string(),
    currency: z.string().default("AED"),
    exchangeRate: z.coerce.number().default(1),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    lineItems: z.array(lineItemSchema).min(1),
});

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveApiContext(req);
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") ?? "";
        const status = searchParams.get("status");
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
        const limit = Math.min(100, parseInt(searchParams.get("limit") ?? searchParams.get("pageSize") ?? "20"));
        const skip = (page - 1) * limit;

        const where = {
            organizationId: ctx.organizationId,
            deletedAt: null,
            ...(status ? { status: status as never } : {}),
            ...(search
                ? {
                    OR: [
                        { invoiceNumber: { contains: search, mode: "insensitive" as const } },
                        { reference: { contains: search, mode: "insensitive" as const } },
                        { customer: { name: { contains: search, mode: "insensitive" as const } } },
                    ],
                }
                : {}),
        };

        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                orderBy: { issueDate: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    invoiceNumber: true,
                    invoiceType: true,
                    status: true,
                    issueDate: true,
                    dueDate: true,
                    currency: true,
                    subtotal: true,
                    totalVat: true,
                    total: true,
                    outstanding: true,
                    amountPaid: true,
                    customer: { select: { id: true, name: true, email: true } },
                },
            }),
            prisma.invoice.count({ where }),
        ]);

        return NextResponse.json({ data: invoices, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveApiContext(req);
        const raw = await req.json();
        const body = normalizeDocumentBody(raw);

        const result = createInvoiceSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const { lineItems: lineItemsInput, issueDate, dueDate, ...invoiceData } = result.data;

        // Calculate line items
        const calculatedItems = lineItemsInput.map((item) => {
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

        const documentType =
            invoiceData.invoiceType === "PROFORMA" ? "PROFORMA" : "INVOICE";

        const invoiceNumber = await getNextDocumentNumber(ctx.organizationId, documentType);

        const invoice = await prisma.invoice.create({
            data: {
                ...invoiceData,
                organizationId: ctx.organizationId,
                invoiceNumber,
                issueDate: issueDate ? new Date(issueDate) : new Date(),
                dueDate: new Date(dueDate),
                subtotal: totals.subtotal,
                totalVat: totals.totalVat,
                discount: totals.discount,
                total: totals.total,
                outstanding: totals.total,
                lineItems: {
                    create: calculatedItems.map((item, i) => ({
                        productId: item.productId ?? null,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        unitOfMeasure: item.unitOfMeasure ?? "unit",
                        discount: item.discount ?? 0,
                        vatTreatment: item.vatTreatment ?? "STANDARD_RATED",
                        vatRate: item.effectiveVatRate,
                        subtotal: item.subtotal,
                        vatAmount: item.vatAmount,
                        total: item.total,
                        sortOrder: item.sortOrder ?? i,
                    })),
                },
            },
            include: {
                lineItems: true,
                customer: { select: { id: true, name: true, email: true, trn: true } },
            },
        });

        return NextResponse.json(invoice, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
