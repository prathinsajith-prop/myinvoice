import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import prisma from "@/lib/db/prisma";

const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "ACCOUNTANT", "MEMBER", "VIEWER"]),
});

// GET /api/organization/members - List all members
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token?.sub || !token?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const members = await prisma.organizationMembership.findMany({
      where: {
        organizationId: token.organizationId as string,
        isActive: true,
      },
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
      orderBy: [
        { role: "asc" },
        { createdAt: "asc" },
      ],
    });

    // Get current user's role
    const currentMembership = members.find((m) => m.userId === token.sub);

    return NextResponse.json({
      members,
      currentUserRole: currentMembership?.role,
    });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

// POST /api/organization/members - Invite a new member
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token?.sub || !token?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to invite
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: token.sub,
          organizationId: token.organizationId as string,
        },
      },
      select: { role: true },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json(
        { error: "You don't have permission to invite members" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = inviteMemberSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, role } = result.data;

    // Prevent non-owners from creating admins
    if (role === "ADMIN" && membership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only owners can invite admins" },
        { status: 403 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Check if already a member
      const existingMembership = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: token.organizationId as string,
          },
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: "User is already a member of this organization" },
          { status: 400 }
        );
      }

      // Add existing user to organization
      const newMembership = await prisma.organizationMembership.create({
        data: {
          userId: existingUser.id,
          organizationId: token.organizationId as string,
          role,
          invitedEmail: email,
          invitedAt: new Date(),
          invitedBy: token.sub,
          acceptedAt: new Date(), // Auto-accept for existing users
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      // Create notification for the user
      await prisma.notification.create({
        data: {
          userId: existingUser.id,
          title: "Added to Organization",
          message: `You have been added to an organization as ${role.toLowerCase()}`,
          type: "TEAM_INVITE",
          actionUrl: "/dashboard",
        },
      });

      return NextResponse.json(newMembership, { status: 201 });
    }

    // Create a pending invitation for non-existing user
    // First, create a placeholder user
    const newUser = await prisma.user.create({
      data: {
        email,
        name: email.split("@")[0], // Temporary name from email
      },
    });

    const newMembership = await prisma.organizationMembership.create({
      data: {
        userId: newUser.id,
        organizationId: token.organizationId as string,
        role,
        invitedEmail: email,
        invitedAt: new Date(),
        invitedBy: token.sub,
        // acceptedAt is null - pending invitation
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // TODO: Send invitation email

    return NextResponse.json(newMembership, { status: 201 });
  } catch (error) {
    console.error("Error inviting member:", error);
    return NextResponse.json(
      { error: "Failed to invite member" },
      { status: 500 }
    );
  }
}
