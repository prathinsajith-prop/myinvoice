import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError } from "@/lib/errors";

const updateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    displayName: z.string().optional().nullable(),
    type: z.enum(["BUSINESS", "INDIVIDUAL"]).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    mobile: z.string().optional().nullable(),
    contactPerson: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
    trn: z.string().optional().nullable(),
    isVatRegistered: z.boolean().optional(),
    addressLine1: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    emirate: z.string().optional().nullable(),
    country: z.string().optional(),
    bankName: z.string().optional().nullable(),
    bankAccountName: z.string().optional().nullable(),
    bankAccountNumber: z.string().optional().nullable(),
    bankIban: z.string().optional().nullable(),
    bankSwift: z.string().optional().nullable(),
    defaultPaymentTerms: z.number().int().min(0).optional(),
    currency: z.string().optional(),
    notes: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const supplier = await prisma.supplier.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
            include: {
                bills: {
                    where: { deletedAt: null },
                    orderBy: { issueDate: "desc" },
                    take: 10,
                    select: {
                        id: true,
                        billNumber: true,
                        status: true,
                        total: true,
                        outstanding: true,
                        issueDate: true,
                        dueDate: true,
                    },
                },
            },
        });
        if (!supplier) throw new NotFoundError("Supplier");
        return NextResponse.json(supplier);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const body = await req.json();
        const existing = await prisma.supplier.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!existing) throw new NotFoundError("Supplier");
        const result = updateSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }
        const supplier = await prisma.supplier.update({ where: { id }, data: result.data });
        return NextResponse.json(supplier);
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveApiContext(req);
        const { id } = await params;
        const existing = await prisma.supplier.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!existing) throw new NotFoundError("Supplier");
        await prisma.supplier.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error);
    }
}
