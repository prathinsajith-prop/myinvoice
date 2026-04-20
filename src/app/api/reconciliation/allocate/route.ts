import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContextWithPermission } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";

const allocateSchema = z.object({
    paymentId: z.string().min(1),
    invoiceId: z.string().min(1),
    amount: z.number().positive(),
});

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveApiContextWithPermission(req, "edit");
        const body = await req.json();

        const result = allocateSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const { paymentId, invoiceId, amount } = result.data;

        // Verify payment belongs to org
        const payment = await prisma.payment.findFirst({
            where: { id: paymentId, organizationId: ctx.organizationId },
            include: { allocations: true },
        });
        if (!payment) throw new NotFoundError("Payment");

        // Calculate unallocated portion of payment
        const allocatedTotal = payment.allocations.reduce(
            (sum, a) => sum + Number(a.amount),
            0
        );
        const unallocated = Number(payment.amount) - allocatedTotal;
        if (amount > unallocated + 0.01) {
            return NextResponse.json(
                { error: `Amount exceeds unallocated balance of ${unallocated.toFixed(2)}` },
                { status: 400 }
            );
        }

        // Verify invoice belongs to org
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!invoice) throw new NotFoundError("Invoice");
        if (["VOID", "PAID", "DRAFT", "CREDITED"].includes(invoice.status)) {
            throw new ForbiddenError(`Cannot allocate payment to invoice in ${invoice.status} status`);
        }

        const invoiceOutstanding = Number(invoice.outstanding ?? invoice.total);
        if (amount > invoiceOutstanding + 0.01) {
            return NextResponse.json(
                { error: `Amount exceeds invoice outstanding of ${invoiceOutstanding.toFixed(2)}` },
                { status: 400 }
            );
        }

        // Check for existing allocation between this payment and invoice
        const existingAllocation = await prisma.paymentAllocation.findUnique({
            where: { paymentId_invoiceId: { paymentId, invoiceId } },
        });

        const newInvoiceOutstanding = Math.max(0, invoiceOutstanding - amount);
        const newInvoiceStatus =
            newInvoiceOutstanding <= 0.01
                ? "PAID"
                : newInvoiceOutstanding < invoiceOutstanding
                    ? "PARTIALLY_PAID"
                    : invoice.status;

        await prisma.$transaction([
            existingAllocation
                ? prisma.paymentAllocation.update({
                    where: { paymentId_invoiceId: { paymentId, invoiceId } },
                    data: { amount: Number(existingAllocation.amount) + amount },
                })
                : prisma.paymentAllocation.create({
                    data: { paymentId, invoiceId, amount },
                }),
            prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    amountPaid: { increment: amount },
                    outstanding: newInvoiceOutstanding,
                    status: newInvoiceStatus,
                    ...(newInvoiceStatus === "PAID" ? { paidAt: new Date() } : {}),
                },
            }),
        ]);

        return NextResponse.json({ success: true, newStatus: newInvoiceStatus });
    } catch (error) {
        return toErrorResponse(error);
    }
}
