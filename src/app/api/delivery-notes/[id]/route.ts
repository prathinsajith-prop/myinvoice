import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";

const updateSchema = z.object({
    customerId: z.string().optional(),
    invoiceId: z.string().optional().nullable(),
    issueDate: z.string().optional(),
    deliveryDate: z.string().optional().nullable(),
    status: z.enum(["DRAFT", "DISPATCHED", "DELIVERED", "VOID"]).optional(),
    voidReason: z.string().optional().nullable(),
    currency: z.string().optional(),
    shippingAddress: z.string().optional().nullable(),
    trackingNumber: z.string().optional().nullable(),
    carrier: z.string().optional().nullable(),
    driverName: z.string().optional().nullable(),
    vehicleNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const deliveryNote = await prisma.deliveryNote.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                customer: { select: { id: true, name: true, email: true } },
                invoice: { select: { id: true, invoiceNumber: true } },
            },
        });

        if (!deliveryNote) throw new NotFoundError("Delivery Note");
        return NextResponse.json(deliveryNote);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;
        const body = await req.json();

        const existing = await prisma.deliveryNote.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!existing) throw new NotFoundError("Delivery Note");

        const result = updateSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const data: Record<string, unknown> = { ...result.data };
        if (result.data.issueDate) data.issueDate = new Date(result.data.issueDate);
        if (result.data.deliveryDate) data.deliveryDate = new Date(result.data.deliveryDate);
        if (result.data.status === "DISPATCHED") data.dispatchedAt = new Date();
        if (result.data.status === "DELIVERED") data.deliveredAt = new Date();
        if (result.data.status === "VOID") data.voidedAt = new Date();

        const deliveryNote = await prisma.deliveryNote.update({
            where: { id },
            data,
            include: {
                lineItems: { orderBy: { sortOrder: "asc" } },
                customer: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json(deliveryNote);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const existing = await prisma.deliveryNote.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!existing) throw new NotFoundError("Delivery Note");

        await prisma.deliveryNote.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
