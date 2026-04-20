import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContextWithPermission } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

const markPaidSchema = z.object({
    amount: z.number().positive(),
    paymentDate: z.string().datetime(),
    method: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "STRIPE", "PAYBY", "TABBY", "TAMARA", "OTHER"]),
    reference: z.string().optional(),
    notes: z.string().optional(),
    currencyCode: z.string().optional(),
    exchangeRate: z.number().positive().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "edit");
        const { id } = await params;
        const body = await req.json();

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!invoice) throw new NotFoundError("Invoice");
        if (!invoice.customerId) throw new ForbiddenError("Cannot record payment for an invoice without a customer");
        if (invoice.status === "VOID") throw new ForbiddenError("Cannot pay a voided invoice");
        if (invoice.status === "PAID") throw new ForbiddenError("Invoice is already fully paid");
        if (invoice.status === "DRAFT") throw new ForbiddenError("Cannot pay a draft invoice");
        if (invoice.status === "PENDING_APPROVAL") throw new ForbiddenError("Invoice is pending approval");
        if (invoice.status === "CREDITED") throw new ForbiddenError("Invoice has been credited");

        const result = markPaidSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const { amount, paymentDate, method, reference, notes, currencyCode, exchangeRate } =
            result.data;
        const normalizedReference = reference?.trim() ? reference.trim() : null;
        const normalizedNotes = notes?.trim() ? notes.trim() : null;
        const paymentCurrency = currencyCode ?? invoice.currency;
        const paymentExchangeRate = exchangeRate ?? 1;

        const outstanding = Number(invoice.outstanding ?? invoice.total);
        if (amount > outstanding + 0.01) {
            return NextResponse.json(
                { error: `Payment amount exceeds outstanding balance of ${outstanding}` },
                { status: 400 }
            );
        }

        // Generate payment number
        const lastPayment = await prisma.payment.findFirst({
            where: { organizationId: ctx.organizationId },
            orderBy: { createdAt: "desc" },
            select: { paymentNumber: true },
        });
        const nextNum = lastPayment
            ? String(Number(lastPayment.paymentNumber.replace(/[^0-9]/g, "")) + 1).padStart(4, "0")
            : "0001";
        const paymentNumber = `PAY-${nextNum}`;

        const newOutstanding = Math.max(0, outstanding - amount);
        const newStatus =
            newOutstanding <= 0.01
                ? "PAID"
                : newOutstanding < outstanding
                    ? "PARTIALLY_PAID"
                    : invoice.status;

        const [payment] = await prisma.$transaction([
            prisma.payment.create({
                data: {
                    paymentNumber,
                    organizationId: ctx.organizationId,
                    customerId: invoice.customerId,
                    amount,
                    bankCharge: 0,
                    amountNet: amount,
                    currency: paymentCurrency,
                    exchangeRate: paymentExchangeRate,
                    paymentDate: new Date(paymentDate),
                    method,
                    reference: normalizedReference,
                    notes: normalizedNotes,
                    status: "COMPLETED",
                    allocations: {
                        create: {
                            invoiceId: id,
                            amount,
                        },
                    },
                },
            }),
            prisma.invoice.update({
                where: { id },
                data: {
                    amountPaid: { increment: amount },
                    outstanding: newOutstanding,
                    status: newStatus,
                },
            }),
        ]);

        return NextResponse.json(payment, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
