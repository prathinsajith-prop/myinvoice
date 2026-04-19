import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
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
import { logApiAudit } from "@/lib/api/audit";
import { hasRole } from "@/lib/rbac";
import { sendEmail } from "@/lib/email";
import { APP_URL } from "@/lib/constants/env";
import { inviteEmail, addedToOrgEmail } from "@/lib/email/templates";

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
        { error: "Validation failed", code: "VALIDATION_ERROR", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const normalizedEmail = result.data.email.trim().toLowerCase();
    const { role } = result.data;
    const appUrl = APP_URL || req.nextUrl.origin;

    const [inviter, organization] = await Promise.all([
      prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true } }),
      prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { name: true, slug: true } }),
    ]);

    const inviterName = inviter?.name || inviter?.email || "A team member";
    const orgName = organization?.name || "your organization";
    const existingOrgMember = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: ctx.organizationId,
        isActive: true,
        user: { email: normalizedEmail },
      },
      select: { id: true },
    });

    if (existingOrgMember) {
      throw new ConflictError("User is already in the user listing for this organization");
    }

    const acceptUrl = `${appUrl}/accept-invite`;

    // Only owners can invite admins
    if (role === "ADMIN" && !hasRole(ctx.role, "OWNER")) {
      throw new ForbiddenError("Only owners can invite admins");
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

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

      // Re-activate or create membership
      const membership = existing
        ? await prisma.organizationMembership.update({
          where: { id: existing.id },
          data: {
            role,
            isActive: true,
            invitedEmail: normalizedEmail,
            invitedBy: ctx.userId,
            invitedAt: new Date(),
            inviteStatus: "ACCEPTED",
            inviteToken: null,
            expiresAt: null,
            acceptedAt: new Date(),
          },
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        })
        : await prisma.organizationMembership.create({
          data: {
            userId: existingUser.id,
            organizationId: ctx.organizationId,
            role,
            invitedEmail: normalizedEmail,
            invitedAt: new Date(),
            invitedBy: ctx.userId,
            inviteStatus: "ACCEPTED",
            acceptedAt: new Date(),
          },
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        });

      // Notify the user — they already have an account so send a "you've been added" email
      await prisma.notification.create({
        data: {
          userId: existingUser.id,
          title: "Added to Organization",
          message: `You have been added as ${role.toLowerCase()}`,
          type: "TEAM_INVITE",
          actionUrl: "/dashboard",
        },
      });

      const dashboardUrl = `${appUrl}/dashboard`;
      const template = addedToOrgEmail({
        inviterName,
        orgName,
        role,
        dashboardUrl,
      });

      await sendEmail({
        to: normalizedEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "INVITE_SENT", entityType: "Member", entityId: membership.id, entityRef: normalizedEmail, newData: { role, email: normalizedEmail }, req });

      return NextResponse.json(membership, { status: 201 });
    }

    // User doesn't exist yet — create placeholder + pending invite
    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedEmail.split("@")[0],
      },
    });

    const inviteToken = randomBytes(24).toString("hex");
    const inviteLink = `${acceptUrl}?token=${encodeURIComponent(inviteToken)}`;

    const membership = await prisma.organizationMembership.create({
      data: {
        userId: newUser.id,
        organizationId: ctx.organizationId,
        role,
        invitedEmail: normalizedEmail,
        invitedAt: new Date(),
        invitedBy: ctx.userId,
        inviteToken,
        inviteStatus: "PENDING",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        // acceptedAt left null — pending
      },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });

    const template = inviteEmail({
      inviterName,
      orgName,
      role,
      acceptUrl: inviteLink,
    });

    await sendEmail({
      to: normalizedEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    logApiAudit({ organizationId: ctx.organizationId, userId: ctx.userId, userEmail: ctx.email, action: "INVITE_SENT", entityType: "Member", entityId: membership.id, entityRef: normalizedEmail, newData: { role, email: normalizedEmail }, req });

    return NextResponse.json(membership, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
