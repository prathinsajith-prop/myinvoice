import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";
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

const updateBillSchema = z.object({
    supplierId: z.string().optional(),
    supplierInvoiceNumber: z.string().optional().nullable(),
    reference: z.string().optional().nullable(),
    supplierReference: z.string().optional().nullable(),
    issueDate: z.string().optional(),
    billDate: z.string().optional(),
    dueDate: z.string().optional(),
    currency: z.string().optional(),
    exchangeRate: z.coerce.number().positive().optional(),
    notes: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    status: z.enum(["DRAFT", "RECEIVED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"]).optional(),
    lineItems: z.array(lineItemSchema).optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const bill = await prisma.bill.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                supplier: true,
                paymentsOut: {
                    include: {
                        paymentOut: {
                            select: { id: true, paymentNumber: true, amount: true, paymentDate: true, method: true },
                        },
                    },
                },
                attachments: true,
            },
        });

        if (!bill) throw new NotFoundError("Bill");
        return NextResponse.json(bill);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const raw = await req.json();
        const body = normalizeDocumentBody(raw);

        const bill = await prisma.bill.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: { lineItems: true },
        });
        if (!bill) throw new NotFoundError("Bill");
        if (bill.status === "VOID") throw new ForbiddenError("Cannot edit a voided bill");

        const result = updateBillSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        if (result.data.status === "RECEIVED" && bill.status !== "DRAFT") {
            throw new ForbiddenError("Only draft bills can be marked as received");
        }

        if (result.data.status === "VOID" && (bill.status === "PAID" || Number(bill.amountPaid) > 0.01)) {
            throw new ForbiddenError("Cannot void a paid or partially paid bill");
        }

        const { lineItems, ...data } = result.data;

        let updateData: any = {
            ...(data.supplierId ? { supplierId: data.supplierId } : {}),
            ...(data.supplierInvoiceNumber !== undefined ? { supplierInvoiceNumber: data.supplierInvoiceNumber ?? null } : {}),
            ...(data.reference !== undefined ? { reference: data.reference ?? null } : {}),
            ...(data.supplierReference !== undefined ? { supplierReference: data.supplierReference ?? null } : {}),
            ...(data.issueDate ? { issueDate: new Date(data.issueDate) } : {}),
            ...(data.billDate ? { issueDate: new Date(data.billDate) } : {}),
            ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {}),
            ...(data.currency ? { currency: data.currency } : {}),
            ...(data.exchangeRate ? { exchangeRate: data.exchangeRate } : {}),
            ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
            ...(data.internalNotes !== undefined ? { internalNotes: data.internalNotes ?? null } : {}),
            ...(data.status ? { status: data.status } : {}),
            ...(data.status === "PAID" ? { amountPaid: bill.total, outstanding: 0 } : {}),
            ...(data.status === "VOID" ? { outstanding: 0, voidedAt: new Date() } : {}),
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
            await prisma.billLineItem.deleteMany({ where: { billId: id } });

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

        const updated = await prisma.bill.update({
            where: { id },
            data: updateData,
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                supplier: { select: { id: true, name: true, email: true } },
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const bill = await prisma.bill.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!bill) throw new NotFoundError("Bill");
        if (bill.status !== "DRAFT") throw new ForbiddenError("Only DRAFT bills can be deleted");

        await prisma.bill.update({ where: { id }, data: { deletedAt: new Date() } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
