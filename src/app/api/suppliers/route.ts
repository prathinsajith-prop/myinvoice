import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { notifyOrgMembers } from "@/lib/notifications/create";

const createSupplierSchema = z.object({
    name: z.string().min(1).max(255),
    displayName: z.string().optional(),
    type: z.enum(["BUSINESS", "INDIVIDUAL"]).default("BUSINESS"),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    mobile: z.string().optional().nullable(),
    contactPerson: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
    trn: z.string().optional().nullable(),
    isVatRegistered: z.boolean().default(false),
    addressLine1: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    emirate: z.string().optional().nullable(),
    country: z.string().default("AE"),
    bankName: z.string().optional().nullable(),
    bankAccountName: z.string().optional().nullable(),
    bankAccountNumber: z.string().optional().nullable(),
    bankIban: z.string().optional().nullable(),
    bankSwift: z.string().optional().nullable(),
    defaultPaymentTerms: z.number().int().min(0).max(365).default(30),
    currency: z.string().default("AED"),
    notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveApiContext(req);
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") ?? "";
        const type = searchParams.get("type") ?? "";
        const status = searchParams.get("status") ?? "";
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
        const limit = Math.min(100, parseInt(searchParams.get("limit") ?? searchParams.get("pageSize") ?? "20"));
        const skip = (page - 1) * limit;

        const where = {
            organizationId: ctx.organizationId,
            ...(status === "INACTIVE" ? { isActive: false } : status === "ACTIVE" ? { isActive: true } : {}),
            deletedAt: null,
            ...(type && type !== "ALL" ? { type } : {}),
            ...(search
                ? {
                    OR: [
                        { name: { contains: search, mode: "insensitive" as const } },
                        { email: { contains: search, mode: "insensitive" as const } },
                        { trn: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {}),
        };

        const [suppliers, total] = await Promise.all([
            prisma.supplier.findMany({
                where,
                orderBy: { name: "asc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    type: true,
                    email: true,
                    phone: true,
                    trn: true,
                    emirate: true,
                    currency: true,
                    totalBilled: true,
                    totalOutstanding: true,
                    billCount: true,
                    createdAt: true,
                },
            }),
            prisma.supplier.count({ where }),
        ]);

        return NextResponse.json({ data: suppliers, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (error) {
        return toErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveApiContext(req);
        const body = await req.json();

        const result = createSupplierSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const supplier = await prisma.supplier.create({
            data: { ...result.data, organizationId: ctx.organizationId },
        });

        // Notify org members about new supplier
        notifyOrgMembers({
            organizationId: ctx.organizationId,
            excludeUserId: ctx.userId,
            title: "New Supplier Added",
            message: `Supplier ${supplier.name} has been added`,
            type: "GENERAL",
            entityType: "Supplier",
            entityId: supplier.id,
            actionUrl: `/suppliers/${supplier.id}`,
        }).catch(() => { });

        return NextResponse.json(supplier, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
