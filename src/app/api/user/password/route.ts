import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { compare, hash } from "bcryptjs";
import prisma from "@/lib/db/prisma";
import { updatePasswordSchema } from "@/lib/validations/settings";

// POST /api/user/password - Update user password
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = updatePasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = result.data;

    // Get user with current password
    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { password: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has a password (might be OAuth only)
    if (!user.password) {
      return NextResponse.json(
        { error: "Cannot change password for OAuth accounts" },
        { status: 400 }
      );
    }

    // Verify current password
    const isValid = await compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash new password and update
    const hashedPassword = await hash(newPassword, 12);
    await prisma.user.update({
      where: { id: token.sub },
      data: { password: hashedPassword },
    });

    // Create security notification
    await prisma.notification.create({
      data: {
        userId: token.sub,
        title: "Password Changed",
        message: "Your password was successfully changed. If you didn't make this change, please contact support immediately.",
        type: "SECURITY_ALERT",
      },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 }
    );
  }
}
