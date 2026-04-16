import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { getNextDocumentNumber } from "@/lib/services/numbering";
import { notifyOrgMembers } from "@/lib/notifications/create";
import { logApiAudit } from "@/lib/api/audit";

const lineItemSchema = z.object({
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitOfMeasure: z.string().default("unit"),
    notes: z.string().optional().nullable(),
    sortOrder: z.coerce.number().int().default(0),
});

const createSchema = z.object({
    customerId: z.string(),
    invoiceId: z.string().optional().nullable(),
    issueDate: z.string().optional(),
    deliveryDate: z.string().optional().nullable(),
    currency: z.string().default("AED"),
    exchangeRate: z.coerce.number().default(1),
    shippingAddress: z.string().optional().nullable(),
    trackingNumber: z.string().optional().nullable(),
    carrier: z.string().optional().nullable(),
    driverName: z.string().optional().nullable(),
    vehicleNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    lineItems: z.array(lineItemSchema).min(1),
});

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") ?? "";
        const status = searchParams.get("status");
        const customerId = searchParams.get("customerId");
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
        const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));
        const skip = (page - 1) * limit;

        const where = {
            organizationId: ctx.organizationId,
            deletedAt: null,
            ...(status ? { status: status as never } : {}),
            ...(customerId ? { customerId } : {}),
            ...(search
                ? {
                    OR: [
                        { deliveryNoteNumber: { contains: search, mode: "insensitive" as const } },
                        { trackingNumber: { contains: search, mode: "insensitive" as const } },
                        { customer: { name: { contains: search, mode: "insensitive" as const } } },
                    ],
                }
                : {}),
        };

        const [deliveryNotes, total] = await Promise.all([
            prisma.deliveryNote.findMany({
                where,
                orderBy: { issueDate: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    deliveryNoteNumber: true,
                    status: true,
                    issueDate: true,
                    deliveryDate: true,
                    currency: true,
                    trackingNumber: true,
                    carrier: true,
                    customer: { select: { id: true, name: true } },
                    invoice: { select: { id: true, invoiceNumber: true } },
                },
            }),
            prisma.deliveryNote.count({ where }),
        ]);

        return NextResponse.json({
            data: deliveryNotes,
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

        const { lineItems: lineItemsInput, issueDate, deliveryDate, ...dnData } = result.data;

        const deliveryNoteNumber = await getNextDocumentNumber(ctx.organizationId, "DELIVERY_NOTE");

        const deliveryNote = await prisma.deliveryNote.create({
            data: {
                ...dnData,
                organizationId: ctx.organizationId,
                deliveryNoteNumber,
                issueDate: issueDate ? new Date(issueDate) : new Date(),
                deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
                lineItems: {
                    create: lineItemsInput.map((item, i) => ({
                        description: item.description,
                        quantity: item.quantity,
                        unitOfMeasure: item.unitOfMeasure ?? "unit",
                        notes: item.notes ?? null,
                        sortOrder: item.sortOrder ?? i,
                    })),
                },
            },
            include: {
                lineItems: true,
                customer: { select: { id: true, name: true } },
            },
        });

        // Audit log
        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "CREATE", entityType: "DeliveryNote", entityId: deliveryNote.id, entityRef: deliveryNote.deliveryNoteNumber, newData: { deliveryNoteNumber: deliveryNote.deliveryNoteNumber }, req });

        notifyOrgMembers({
            organizationId: ctx.organizationId,
            excludeUserId: ctx.userId,
            title: "New Delivery Note",
            message: `Delivery Note ${deliveryNote.deliveryNoteNumber} has been created`,
            type: "DELIVERY_NOTE_CREATED",
            entityType: "DeliveryNote",
            entityId: deliveryNote.id,
            actionUrl: `/delivery-notes`,
        }).catch(() => { });

        return NextResponse.json(deliveryNote, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
