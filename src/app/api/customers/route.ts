import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { notifyOrgMembers } from "@/lib/notifications/create";
import { logApiAudit } from "@/lib/api/audit";
import { parsePagination } from "@/lib/utils";

const createCustomerSchema = z.object({
    name: z.string().min(1).max(255),
    displayName: z.string().optional(),
    type: z.enum(["BUSINESS", "INDIVIDUAL"]).default("BUSINESS"),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    mobile: z.string().optional().nullable(),
    contactPerson: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    trn: z.string().optional().nullable(),
    isVatRegistered: z.boolean().default(false),
    unitNumber: z.string().optional().nullable(),
    buildingName: z.string().optional().nullable(),
    street: z.string().optional().nullable(),
    area: z.string().optional().nullable(),
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
        const ctx = await resolveRouteContext(req);
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") ?? "";
        const type = searchParams.get("type") ?? "";
        const status = searchParams.get("status") ?? "";
        const { page, limit, skip } = parsePagination(searchParams);

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
                        { phone: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {}),
        };

        const [rawCustomers, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                orderBy: { name: "asc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    displayName: true,
                    type: true,
                    email: true,
                    phone: true,
                    image: true,
                    trn: true,
                    isVatRegistered: true,
                    emirate: true,
                    country: true,
                    currency: true,
                    totalInvoiced: true,
                    totalOutstanding: true,
                    _count: { select: { invoices: { where: { deletedAt: null, status: { not: "VOID" as const } } } } },
                    lastInvoiceDate: true,
                    isActive: true,
                    createdAt: true,
                },
            }),
            prisma.customer.count({ where }),
        ]);

        const customers = rawCustomers.map(({ _count, ...c }) => ({ ...c, invoiceCount: _count.invoices }));

        return NextResponse.json({ data: customers, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (error) {
        return toErrorResponse(error);
    }
}

// POST /api/customers — create
export async function POST(req: NextRequest) {
    try {
        const ctx = await resolveRouteContext(req);
        const body = await req.json();

        const result = createCustomerSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
                { status: 400 }
            );
        }

        const customer = await prisma.customer.create({
            data: {
                ...result.data,
                organizationId: ctx.organizationId,
            },
        });

        // Notify org members about new customer
        notifyOrgMembers({
            organizationId: ctx.organizationId,
            excludeUserId: ctx.userId,
            title: "New Customer Added",
            message: `Customer ${customer.name} has been added`,
            type: "CUSTOMER_ADDED",
            entityType: "Customer",
            entityId: customer.id,
            actionUrl: `/customers/${customer.id}`,
        }).catch(() => { });

        logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "CREATE", entityType: "Customer", entityId: customer.id, entityRef: customer.name, newData: result.data, req });

        return NextResponse.json(customer, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}
