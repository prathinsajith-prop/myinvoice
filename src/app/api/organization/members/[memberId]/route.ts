import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import prisma from "@/lib/db/prisma";

const updateMemberSchema = z.object({
  role: z.enum(["ADMIN", "ACCOUNTANT", "MEMBER", "VIEWER"]),
});

// PATCH /api/organization/members/[memberId] - Update member role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const { memberId } = await params;

    if (!token?.sub || !token?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission
    const currentMembership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: token.sub,
          organizationId: token.organizationId as string,
        },
      },
      select: { role: true },
    });

    if (!currentMembership || !["OWNER", "ADMIN"].includes(currentMembership.role)) {
      return NextResponse.json(
        { error: "You don't have permission to update members" },
        { status: 403 }
      );
    }

    // Get target membership
    const targetMembership = await prisma.organizationMembership.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!targetMembership || targetMembership.organizationId !== token.organizationId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Prevent modifying owner
    if (targetMembership.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot modify owner's role" },
        { status: 403 }
      );
    }

    // Prevent admins from modifying other admins
    if (currentMembership.role === "ADMIN" && targetMembership.role === "ADMIN") {
      return NextResponse.json(
        { error: "Admins cannot modify other admins" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = updateMemberSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { role } = result.data;

    // Prevent non-owners from promoting to admin
    if (role === "ADMIN" && currentMembership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only owners can promote members to admin" },
        { status: 403 }
      );
    }

    const updatedMembership = await prisma.organizationMembership.update({
      where: { id: memberId },
      data: { role },
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
        userId: targetMembership.userId,
        title: "Role Updated",
        message: `Your role has been updated to ${role.toLowerCase()}`,
        type: "TEAM_INVITE",
        actionUrl: "/dashboard/settings/team",
      },
    });

    return NextResponse.json(updatedMembership);
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

// DELETE /api/organization/members/[memberId] - Remove member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const { memberId } = await params;

    if (!token?.sub || !token?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission
    const currentMembership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: token.sub,
          organizationId: token.organizationId as string,
        },
      },
      select: { role: true },
    });

    if (!currentMembership || !["OWNER", "ADMIN"].includes(currentMembership.role)) {
      return NextResponse.json(
        { error: "You don't have permission to remove members" },
        { status: 403 }
      );
    }

    // Get target membership
    const targetMembership = await prisma.organizationMembership.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!targetMembership || targetMembership.organizationId !== token.organizationId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Prevent removing owner
    if (targetMembership.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot remove the organization owner" },
        { status: 403 }
      );
    }

    // Prevent admins from removing other admins
    if (currentMembership.role === "ADMIN" && targetMembership.role === "ADMIN") {
      return NextResponse.json(
        { error: "Admins cannot remove other admins" },
        { status: 403 }
      );
    }

    // Prevent self-removal (use leave organization instead)
    if (targetMembership.userId === token.sub) {
      return NextResponse.json(
        { error: "Use 'Leave Organization' to remove yourself" },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    await prisma.organizationMembership.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    // Create notification for the removed user
    await prisma.notification.create({
      data: {
        userId: targetMembership.userId,
        title: "Removed from Organization",
        message: "You have been removed from the organization",
        type: "TEAM_INVITE",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
