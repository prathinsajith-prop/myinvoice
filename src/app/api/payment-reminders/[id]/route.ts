import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;
        const body = await req.json();

        const existing = await prisma.paymentReminder.findFirst({
            where: { id, organizationId: ctx.organizationId },
        });
        if (!existing) throw new NotFoundError("Reminder not found");

        const updated = await prisma.paymentReminder.update({
            where: { id },
            data: {
                ...(body.status ? { status: body.status } : {}),
                ...(body.scheduledAt ? { scheduledAt: new Date(body.scheduledAt) } : {}),
                ...(body.subject !== undefined ? { subject: body.subject } : {}),
                ...(body.body !== undefined ? { body: body.body } : {}),
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const existing = await prisma.paymentReminder.findFirst({
            where: { id, organizationId: ctx.organizationId },
        });
        if (!existing) throw new NotFoundError("Reminder not found");

        await prisma.paymentReminder.delete({ where: { id } });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
