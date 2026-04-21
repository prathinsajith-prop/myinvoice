import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email/templates";
import { generatePublicToken } from "@/lib/crypto/token";

const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
});

// POST /api/auth/forgot-password
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const result = forgotPasswordSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Invalid email address", code: "VALIDATION_ERROR" },
                { status: 400 }
            );
        }

        const { email } = result.data;

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true, name: true, email: true, password: true },
        });

        // For security, always return success even if user doesn't exist
        // This prevents email enumeration attacks
        if (!user) {
            return NextResponse.json(
                { success: true, message: "If an account exists, a reset email has been sent" },
                { status: 200 }
            );
        }

        // Check if user has a password (OAuth users don't)
        if (!user.password) {
            return NextResponse.json(
                { success: true, message: "If an account exists, a reset email has been sent" },
                { status: 200 }
            );
        }

        // Generate reset token
        const token = generatePublicToken(32);
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Delete any existing password reset tokens for this user
        await prisma.verificationToken.deleteMany({
            where: {
                identifier: email.toLowerCase(),
                type: "password_reset",
            },
        });

        // Create new password reset token
        await prisma.verificationToken.create({
            data: {
                identifier: email.toLowerCase(),
                token,
                expires,
                type: "password_reset",
            },
        });

        // Send password reset email
        const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

        const emailContent = passwordResetEmail({
            name: user.name ?? "User",
            resetUrl,
            expiresMinutes: 60,
        });

        await sendEmail({
            to: user.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
        });

        return NextResponse.json(
            { success: true, message: "If an account exists, a reset email has been sent" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Forgot password error:", error);
        return NextResponse.json(
            { error: "An error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
