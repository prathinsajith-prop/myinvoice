import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import {
  resolveApiContext,
  resolveApiContextWithPermission,
} from "@/lib/api/auth";
import {
  toErrorResponse,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors";
import { hasRole } from "@/lib/rbac";

const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "ACCOUNTANT", "MEMBER", "VIEWER"]),
});

// GET /api/organization/members — list all active members
export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveApiContext(req);

    const members = await prisma.organizationMembership.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      members,
      currentUserRole: members.find((m) => m.userId === ctx.userId)?.role,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// POST /api/organization/members — invite a member (manage_team permission)
export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveApiContextWithPermission(req, "manage_team");
    const body = await req.json();

    const result = inviteMemberSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, role } = result.data;

    // Only owners can invite admins
    if (role === "ADMIN" && !hasRole(ctx.role, "OWNER")) {
      throw new ForbiddenError("Only owners can invite admins");
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      // Check for existing active or pending membership
      const existing = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: ctx.organizationId,
          },
        },
      });

      if (existing?.isActive) {
        throw new ConflictError("User is already a member of this organization");
      }

      // Re-activate or create membership
      const membership = existing
        ? await prisma.organizationMembership.update({
            where: { id: existing.id },
            data: {
              role,
              isActive: true,
              invitedBy: ctx.userId,
              invitedAt: new Date(),
              acceptedAt: new Date(),
            },
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
          })
        : await prisma.organizationMembership.create({
            data: {
              userId: existingUser.id,
              organizationId: ctx.organizationId,
              role,
              invitedEmail: email,
              invitedAt: new Date(),
              invitedBy: ctx.userId,
              acceptedAt: new Date(),
            },
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
          });

      // Notify the user
      await prisma.notification.create({
        data: {
          userId: existingUser.id,
          title: "Added to Organization",
          message: `You have been added as ${role.toLowerCase()}`,
          type: "TEAM_INVITE",
          actionUrl: "/dashboard",
        },
      });

      return NextResponse.json(membership, { status: 201 });
    }

    // User doesn't exist yet — create placeholder + pending invite
    const newUser = await prisma.user.create({
      data: {
        email,
        name: email.split("@")[0],
      },
    });

    const membership = await prisma.organizationMembership.create({
      data: {
        userId: newUser.id,
        organizationId: ctx.organizationId,
        role,
        invitedEmail: email,
        invitedAt: new Date(),
        invitedBy: ctx.userId,
        // acceptedAt left null — pending
      },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });

    // TODO: dispatch invitation email via email service

    return NextResponse.json(membership, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
