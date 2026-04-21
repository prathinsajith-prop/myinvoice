import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email/templates";
import { generatePublicToken } from "@/lib/crypto/token";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";

const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email address").toLowerCase(),
});

// POST /api/auth/forgot-password
export async function POST(req: NextRequest) {
    try {
        // Rate limiting: 5 requests per 15 minutes per IP
        const ip = getClientIp(req.headers);
        const rateLimitResult = await rateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000);

        if (!rateLimitResult.allowed) {
            const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
            return NextResponse.json(
                {
                    error: "Too many reset attempts. Please try again later.",
                    code: "RATE_LIMIT_EXCEEDED",
                    retryAfter
                },
                { status: 429 }
            );
        }

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
            where: { email },
            select: { id: true, name: true, email: true, password: true },
        });

        // For security, always return success even if user doesn't exist
        // This prevents email enumeration attacks
        if (!user || !user.password) {
            // Still return success to prevent user enumeration
            // OAuth users (no password) are silently ignored
            return NextResponse.json(
                { success: true, message: "If an account exists, a reset email has been sent" },
                { status: 200 }
            );
        }

        // Generate reset token
        const token = generatePublicToken(32);
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

        // Use transaction for atomicity
        await prisma.$transaction(async (tx) => {
            // Delete any existing password reset tokens for this user
            await tx.verificationToken.deleteMany({
                where: {
                    identifier: email,
                    type: "password_reset",
                },
            });

            // Create new password reset token
            await tx.verificationToken.create({
                data: {
                    identifier: email,
                    token,
                    expires,
                    type: "password_reset",
                },
            });
        });

        // Send password reset email (outside transaction)
        const emailContent = passwordResetEmail({
            name: user.name ?? "User",
            resetUrl,
            expiresMinutes: 60,
        });

        const emailResult = await sendEmail({
            to: user.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
        });

        // Log email send failure but don't reveal to user
        if (!emailResult) {
            console.error("Failed to send password reset email");
        }

        return NextResponse.json(
            { success: true, message: "If an account exists, a reset email has been sent" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Forgot password error:", error);
        return NextResponse.json(
            { error: "An error occurred. Please try again later.", code: "INTERNAL_ERROR" },
            { status: 500 }
        );
    }
}
