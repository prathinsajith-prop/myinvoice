import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";

const updateCustomerSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    displayName: z.string().optional().nullable(),
    type: z.enum(["BUSINESS", "INDIVIDUAL"]).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    mobile: z.string().optional().nullable(),
    contactPerson: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    trn: z.string().optional().nullable(),
    isVatRegistered: z.boolean().optional(),
    addressLine1: z.string().optional().nullable(),
    addressLine2: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    emirate: z.string().optional().nullable(),
    country: z.string().optional(),
    postalCode: z.string().optional().nullable(),
    defaultPaymentTerms: z.number().int().min(0).max(365).optional().nullable(),
    creditLimit: z.number().positive().optional().nullable(),
    currency: z.string().optional(),
    defaultVatTreatment: z
        .enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "REVERSE_CHARGE", "OUT_OF_SCOPE"])
        .optional(),
    notes: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

// GET /api/customers/[id]
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const customer = await prisma.customer.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                invoices: {
                    where: { deletedAt: null },
                    orderBy: { issueDate: "desc" },
                    take: 10,
                    select: {
                        id: true,
                        invoiceNumber: true,
                        status: true,
                        total: true,
                        outstanding: true,
                        issueDate: true,
                        dueDate: true,
                    },
                },
                quotations: {
                    where: { deletedAt: null },
                    orderBy: { issueDate: "desc" },
                    take: 5,
                    select: {
                        id: true,
                        quoteNumber: true,
                        status: true,
                        total: true,
                        issueDate: true,
                    },
                },
                payments: {
                    orderBy: { paymentDate: "desc" },
                    take: 5,
                    select: {
                        id: true,
                        paymentNumber: true,
                        amount: true,
                        paymentDate: true,
                        method: true,
                    },
                },
            },
        });

        if (!customer) throw new NotFoundError("Customer");
        return NextResponse.json(customer);
    } catch (error) {
        return toErrorResponse(error);
    }
}

// PATCH /api/customers/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const body = await req.json();

        const existing = await prisma.customer.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!existing) throw new NotFoundError("Customer");

        const result = updateCustomerSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const customer = await prisma.customer.update({
            where: { id },
            data: result.data,
        });

        return NextResponse.json(customer);
    } catch (error) {
        return toErrorResponse(error);
    }
}

// DELETE /api/customers/[id] — soft delete
export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;

        const existing = await prisma.customer.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!existing) throw new NotFoundError("Customer");

        await prisma.customer.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
