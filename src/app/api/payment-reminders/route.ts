import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

const createSchema = z.object({
    invoiceId: z.string().min(1),
    type: z.enum(["BEFORE_DUE", "ON_DUE", "AFTER_DUE"]),
    channel: z.enum(["EMAIL", "WHATSAPP", "SMS"]).default("EMAIL"),
    scheduledAt: z.string().min(1),
    subject: z.string().optional().nullable(),
    body: z.string().optional().nullable(),
    recipient: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
        const status = searchParams.get("status");
        const invoiceId = searchParams.get("invoiceId");

        const where: Record<string, unknown> = { organizationId: ctx.organizationId };
        if (status) where.status = status;
        if (invoiceId) where.invoiceId = invoiceId;

        const [data, total] = await Promise.all([
            prisma.paymentReminder.findMany({
                where,
                include: {
                    invoice: {
                        select: {
                            id: true,
                            invoiceNumber: true,
                            total: true,
                            outstanding: true,
                            dueDate: true,
                            customer: { select: { id: true, name: true } },
                        },
                    },
                },
                orderBy: { scheduledAt: "asc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.paymentReminder.count({ where }),
        ]);

        return NextResponse.json({
            data,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const body = await req.json();
        const result = createSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        // Verify invoice belongs to org
        const invoice = await prisma.invoice.findFirst({
            where: { id: result.data.invoiceId, organizationId: ctx.organizationId, deletedAt: null },
            include: { customer: { select: { email: true, name: true } } },
        });

        if (!invoice) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }

        const reminder = await prisma.paymentReminder.create({
            data: {
                organizationId: ctx.organizationId,
                invoiceId: result.data.invoiceId,
                type: result.data.type,
                channel: result.data.channel,
                scheduledAt: new Date(result.data.scheduledAt),
                subject: result.data.subject ?? null,
                body: result.data.body ?? null,
                recipient: result.data.recipient ?? invoice.customer?.email ?? null,
            },
            include: {
                invoice: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        customer: { select: { id: true, name: true } },
                    },
                },
            },
        });

        return NextResponse.json(reminder, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
