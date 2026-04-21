import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import prisma from "@/lib/db/prisma";

const resetPasswordSchema = z.object({
    token: z.string().min(1, "Token is required"),
    email: z.string().email("Please enter a valid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

// POST /api/auth/reset-password
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const result = resetPasswordSchema.safeParse(body);

        if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json(
        { 
          error: firstError?.message ?? "Validation failed", 
                    details: result.error.flatten()
                },
                { status: 400 }
            );
        }

        const { token, email, password } = result.data;
        const emailLower = email.toLowerCase();

        // Find and validate the reset token
        const verificationToken = await prisma.verificationToken.findUnique({
            where: {
                identifier_token: {
                    identifier: emailLower,
                    token,
                },
            },
        });

        if (!verificationToken || verificationToken.type !== "password_reset") {
            return NextResponse.json(
                { error: "Invalid or expired reset token", code: "INVALID_TOKEN" },
                { status: 400 }
            );
        }

        // Check if token has expired
        if (verificationToken.expires < new Date()) {
            // Delete expired token
            await prisma.verificationToken.delete({
                where: {
                    identifier_token: {
                        identifier: emailLower,
                        token,
                    },
                },
            });

            return NextResponse.json(
                { error: "Reset token has expired. Please request a new one.", code: "TOKEN_EXPIRED" },
                { status: 400 }
            );
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: emailLower },
            select: { id: true, password: true },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found", code: "USER_NOT_FOUND" },
                { status: 404 }
            );
        }

        // Hash new password
        const hashedPassword = await hash(password, 12);

        // Update user password
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        // Delete the used reset token
        await prisma.verificationToken.delete({
            where: {
                identifier_token: {
                    identifier: emailLower,
                    token,
                },
            },
        });

        // Delete all other password reset tokens for this user
        await prisma.verificationToken.deleteMany({
            where: {
                identifier: emailLower,
                type: "password_reset",
            },
        });

        return NextResponse.json(
            { success: true, message: "Password has been reset successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Reset password error:", error);
        return NextResponse.json(
            { error: "An error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
