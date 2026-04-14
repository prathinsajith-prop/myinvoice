import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";

const createCustomerSchema = z.object({
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
    addressLine2: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    emirate: z.string().optional().nullable(),
    country: z.string().default("AE"),
    postalCode: z.string().optional().nullable(),
    defaultPaymentTerms: z.number().int().min(0).max(365).optional().nullable(),
    creditLimit: z.number().positive().optional().nullable(),
    currency: z.string().default("AED"),
    defaultVatTreatment: z
        .enum(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "REVERSE_CHARGE", "OUT_OF_SCOPE"])
        .default("STANDARD_RATED"),
    notes: z.string().optional().nullable(),
});

// GET /api/customers — list with search + pagination
export async function GET(req: NextRequest) {
    try {
        const ctx = await resolveApiContext(req);
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") ?? "";
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
        const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") ?? "20"));
        const skip = (page - 1) * pageSize;

        const where = {
            organizationId: ctx.organizationId,
            isActive: true,
            deletedAt: null,
            ...(search
                ? {
                    OR: [
                        { name: { contains: search, mode: "insensitive" as const } },
                        { email: { contains: search, mode: "insensitive" as const } },
                        { trn: { contains: search, mode: "insensitive" as const } },
                        { phone: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {}),
        };

        const [customers, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                orderBy: { name: "asc" },
                skip,
                take: pageSize,
                select: {
                    id: true,
                    name: true,
                    displayName: true,
                    type: true,
                    email: true,
                    phone: true,
                    trn: true,
                    isVatRegistered: true,
                    emirate: true,
                    country: true,
                    currency: true,
                    totalInvoiced: true,
                    totalOutstanding: true,
                    invoiceCount: true,
                    lastInvoiceDate: true,
                    isActive: true,
                    createdAt: true,
                },
            }),
            prisma.customer.count({ where }),
        ]);

        return NextResponse.json({ customers, total, page, pageSize });
    } catch (error) {
        return toErrorResponse(error);
    }
}

// POST /api/customers — create
export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveApiContext(req);
        const body = await req.json();

        const result = createCustomerSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const customer = await prisma.customer.create({
            data: {
                ...result.data,
                organizationId: ctx.organizationId,
            },
        });

        return NextResponse.json(customer, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
