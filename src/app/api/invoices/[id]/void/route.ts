import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

const voidSchema = z.object({
    reason: z.string().min(1, "Void reason is required"),
});

export async function POST(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const body = await req.json();

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!invoice) throw new NotFoundError("Invoice");
        if (invoice.status === "VOID") throw new ForbiddenError("Invoice is already voided");
        if (["PAID", "PARTIALLY_PAID"].includes(invoice.status as string)) {
            throw new ForbiddenError("Cannot void a paid invoice. Issue a credit note instead.");
        }

        const result = voidSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const updated = await prisma.invoice.update({
            where: { id },
            data: {
                status: "VOID",
                voidedAt: new Date(),
                voidReason: result.data.reason,
                outstandingAmount: 0,
            },
        });

        // Decrement customer denormalized stats
        prisma.customer.update({
            where: { id: invoice.customerId },
            data: {
                invoiceCount: { decrement: 1 },
                totalInvoiced: { decrement: Number(invoice.total) },
                totalOutstanding: { decrement: Number(invoice.outstanding) },
            },
        }).catch(() => { });

        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}
