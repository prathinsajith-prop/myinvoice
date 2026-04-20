import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { resolveRouteContext } from "@/lib/api/auth";
import { toErrorResponse, NotFoundError, ForbiddenError } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";
import { hasRole } from "@/lib/rbac";
import type { MemberRole } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// POST /api/invoices/[id]/approve — approve a PENDING_APPROVAL invoice (ADMIN/MANAGER/OWNER only)
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const userRole = ctx.role as MemberRole;
        if (!hasRole(userRole, "MANAGER")) {
            throw new ForbiddenError("Only managers, admins, or owners can approve invoices");
        }

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!invoice) throw new NotFoundError("Invoice");

        if (invoice.status !== "PENDING_APPROVAL") {
            throw new ForbiddenError("Only invoices with PENDING_APPROVAL status can be approved");
        }

        const updated = await prisma.invoice.update({
            where: { id },
            data: { status: "APPROVED" },
        });

        logApiAudit({
            userId: ctx.userId,
            organizationId: ctx.organizationId,
            action: "approve",
            entityType: "invoice",
            entityId: id,
        });

        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}

// POST /api/invoices/[id]/approve?action=submit — submit a DRAFT invoice for approval
export async function PUT(req: NextRequest, { params }: Params) {
    try {
        const ctx = await resolveRouteContext(req);
        const { id } = await params;

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId: ctx.organizationId, deletedAt: null },
        });
        if (!invoice) throw new NotFoundError("Invoice");

        if (invoice.status !== "DRAFT") {
            throw new ForbiddenError("Only DRAFT invoices can be submitted for approval");
        }

        const updated = await prisma.invoice.update({
            where: { id },
            data: { status: "PENDING_APPROVAL" },
        });

        logApiAudit({
            userId: ctx.userId,
            organizationId: ctx.organizationId,
            action: "submit_for_approval",
            entityType: "invoice",
            entityId: id,
        });

        return NextResponse.json(updated);
    } catch (error) {
        return toErrorResponse(error);
    }
}
