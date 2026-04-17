import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";

const updateSchema = z.object({
    templateName: z.string().optional(),
    frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUALLY", "ANNUALLY"]).optional(),
    endDate: z.string().optional().nullable(),
    occurrencesLeft: z.coerce.number().int().positive().optional().nullable(),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    autoSend: z.boolean().optional(),
    status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELED"]).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const recurring = await prisma.recurringInvoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                customer: { select: { id: true, name: true, email: true } },
                lineItems: { orderBy: { sortOrder: "asc" } },
                generatedInvoices: {
                    select: { id: true, invoiceNumber: true, status: true, total: true, issueDate: true },
                    orderBy: { issueDate: "desc" },
                    take: 10,
                },
            },
        });

        if (!recurring) throw new NotFoundError("Recurring Invoice");
        return NextResponse.json(recurring);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;
        const body = await req.json();

        const existing = await prisma.recurringInvoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!existing) throw new NotFoundError("Recurring Invoice");

        const result = updateSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const data: Record<string, unknown> = { ...result.data };
        if (result.data.endDate) data.endDate = new Date(result.data.endDate);
        if (result.data.endDate === null) data.endDate = null;

        const recurring = await prisma.recurringInvoice.update({
            where: { id },
            data,
            include: {
                customer: { select: { id: true, name: true } },
                lineItems: { orderBy: { sortOrder: "asc" } },
            },
        });

        return NextResponse.json(recurring);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const existing = await prisma.recurringInvoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!existing) throw new NotFoundError("Recurring Invoice");

        await prisma.recurringInvoice.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
