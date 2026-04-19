import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import {
  resolveApiContextWithPermission,
  verifyMembershipOwnership,
} from "@/lib/api/auth";
import { toErrorResponse, ForbiddenError } from "@/lib/errors";
import { logApiAudit } from "@/lib/api/audit";
import { hasRole } from "@/lib/rbac";

const updateMemberSchema = z.object({
  role: z.enum(["ADMIN", "ACCOUNTANT", "MEMBER", "VIEWER"]),
});

// PATCH /api/organization/members/[memberId] — update member role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const ctx = await resolveApiContextWithPermission(req, "manage_team");
    const { memberId } = await params;

    const target = await verifyMembershipOwnership(memberId, ctx.organizationId);

    if (target.role === "OWNER") {
      throw new ForbiddenError("Cannot modify the owner's role");
    }

    // Admins cannot change other admins
    if (ctx.role === "ADMIN" && target.role === "ADMIN") {
      throw new ForbiddenError("Admins cannot modify other admins");
    }

    const body = await req.json();
    const result = updateMemberSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { role } = result.data;

    // Only owners can promote to admin
    if (role === "ADMIN" && !hasRole(ctx.role, "OWNER")) {
      throw new ForbiddenError("Only owners can promote members to admin");
    }

    const updated = await prisma.organizationMembership.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    await prisma.notification.create({
      data: {
        userId: target.userId,
        title: "Role Updated",
        message: `Your role has been updated to ${role.toLowerCase()}`,
        type: "TEAM_INVITE",
        actionUrl: "/settings/team",
      },
    });

    logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "UPDATE", entityType: "Member", entityId: memberId, newData: { role }, req });

    return NextResponse.json(updated);
  } catch (error) {
    return toErrorResponse(error);
  }
}

// DELETE /api/organization/members/[memberId] — remove a member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const ctx = await resolveApiContextWithPermission(req, "manage_team");
    const { memberId } = await params;

    const target = await verifyMembershipOwnership(memberId, ctx.organizationId);

    if (target.role === "OWNER") {
      throw new ForbiddenError("Cannot remove the organization owner");
    }

    if (ctx.role === "ADMIN" && target.role === "ADMIN") {
      throw new ForbiddenError("Admins cannot remove other admins");
    }

    if (target.userId === ctx.userId) {
      throw new ForbiddenError("Use 'Leave Organization' to remove yourself");
    }

    // Soft-delete: mark isActive = false
    await prisma.organizationMembership.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    await prisma.notification.create({
      data: {
        userId: target.userId,
        title: "Removed from Organization",
        message: "You have been removed from the organization",
        type: "TEAM_INVITE",
      },
    });

    logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "DELETE", entityType: "Member", entityId: memberId, req });

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
