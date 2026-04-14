import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const payment = await prisma.payment.findFirst({
            where: { id, organizationId: ctx.organizationId },
            include: {
                customer: true,
                allocations: {
                    include: {
                        invoice: { select: { id: true, invoiceNumber: true, total: true, status: true } },
                    },
                },
            },
        });

        if (!payment) throw new NotFoundError("Payment");
        return NextResponse.json(payment);
    } catch (error) {
        return toErrorResponse(error);
    }
}
