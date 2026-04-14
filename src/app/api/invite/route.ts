import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { toErrorResponse, AppError } from "@/lib/errors";

const validateSchema = z.object({ token: z.string().min(1) });
const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2).max(100),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[a-z]/, "Must contain lowercase")
    .regex(/[0-9]/, "Must contain a number"),
});

// GET /api/invite?token=xxx — validate token, return invite metadata
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const parsed = validateSchema.safeParse({ token });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const invite = await prisma.inviteToken.findUnique({
      where: { token: parsed.data.token },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }
    if (invite.usedAt) {
      return NextResponse.json({ error: "Invitation already used" }, { status: 410 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: invite.organizationId },
      select: { name: true, slug: true },
    });

    const inviter = await prisma.user.findUnique({
      where: { id: invite.invitedBy },
      select: { name: true, email: true },
    });

    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      organization: org,
      inviterName: inviter?.name ?? inviter?.email,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// POST /api/invite — accept invite (sets password, activates membership)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = acceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, name, password } = parsed.data;

    const invite = await prisma.inviteToken.findUnique({
      where: { token },
    });

    if (!invite) throw new AppError("Invitation not found", "NOT_FOUND", 404);
    if (invite.usedAt) throw new AppError("Invitation already used", "ALREADY_USED", 410);
    if (invite.expiresAt < new Date()) throw new AppError("Invitation has expired", "EXPIRED", 410);

    const { hash } = await import("bcryptjs");
    const hashedPassword = await hash(password, 12);

    // Update the placeholder user
    const membership = await prisma.organizationMembership.findUnique({
      where: { id: invite.membershipId },
      include: { user: true },
    });

    if (!membership) throw new AppError("Membership not found", "NOT_FOUND", 404);

    await prisma.$transaction([
      // Activate user account
      prisma.user.update({
        where: { id: membership.userId },
        data: {
          name,
          password: hashedPassword,
          emailVerified: new Date(),
        },
      }),
      // Accept membership
      prisma.organizationMembership.update({
        where: { id: invite.membershipId },
        data: { acceptedAt: new Date(), isActive: true },
      }),
      // Mark token as used
      prisma.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true, email: invite.email });
  } catch (error) {
    return toErrorResponse(error);
  }
}
