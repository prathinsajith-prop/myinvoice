import { compare, hash } from "bcryptjs";
import crypto from "node:crypto";

import prisma from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email";
import { loginCodeEmail } from "@/lib/email/templates";
import { type LoginAttemptMetadata } from "@/lib/security/request-metadata";
import { APP_URL } from "@/lib/constants/env";

const LOGIN_CHALLENGE_TYPE = "login-challenge";
const LOGIN_CHALLENGE_TTL_MINUTES = 10;
const MAX_FAILED_LOGIN_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 15;

function generateLoginCode() {
    return String(crypto.randomInt(100000, 1000000));
}

async function recordLoginAttempt(
    userId: string,
    success: boolean,
    failReason?: string,
    metadata?: LoginAttemptMetadata,
) {
    await prisma.loginHistory.create({
        data: {
            userId,
            success,
            failReason,
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
            device: metadata?.device,
            browser: metadata?.browser,
            os: metadata?.os,
            city: metadata?.city,
            country: metadata?.country,
        },
    }).catch(() => { });
}

export async function validatePrimaryCredentials(
    email: string,
    password: string,
    metadata?: LoginAttemptMetadata,
) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });

    if (!user?.password) {
        return { ok: false as const, reason: "Invalid email or password" };
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
        await recordLoginAttempt(user.id, false, "Account temporarily locked", metadata);
        return { ok: false as const, reason: "Account temporarily locked. Try again later." };
    }

    const passwordValid = await compare(password, user.password);
    if (!passwordValid) {
        const attempts = user.failedLoginAttempts + 1;
        const shouldLock = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;

        await prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: attempts,
                lockedUntil: shouldLock
                    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
                    : null,
            },
        });

        await recordLoginAttempt(
            user.id,
            false,
            shouldLock ? "Too many failed login attempts" : "Invalid email or password",
            metadata,
        );

        return {
            ok: false as const,
            reason: shouldLock
                ? "Too many failed attempts. Account locked for 15 minutes."
                : "Invalid email or password",
        };
    }

    return { ok: true as const, user };
}

export async function issueLoginChallenge(user: { id: string; email: string; name?: string | null }) {
    const code = generateLoginCode();
    const hashedCode = await hash(code, 8);
    const identifier = `login:${user.id}`;

    await prisma.verificationToken.deleteMany({
        where: { identifier, type: LOGIN_CHALLENGE_TYPE },
    });

    await prisma.verificationToken.create({
        data: {
            identifier,
            token: hashedCode,
            expires: new Date(Date.now() + LOGIN_CHALLENGE_TTL_MINUTES * 60 * 1000),
            type: LOGIN_CHALLENGE_TYPE,
        },
    });

    const appUrl = APP_URL;
    const template = loginCodeEmail({
        name: user.name || user.email,
        code,
        expiresMinutes: LOGIN_CHALLENGE_TTL_MINUTES,
        loginUrl: `${appUrl}/login`,
    });

    const sent = await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
    });

    if (!sent) {
        await prisma.verificationToken.deleteMany({
            where: { identifier, type: LOGIN_CHALLENGE_TYPE },
        });
        throw new Error("Unable to send authentication code");
    }

    return {
        expiresInMinutes: LOGIN_CHALLENGE_TTL_MINUTES,
    };
}

export async function verifyLoginChallenge(userId: string, code: string) {
    const identifier = `login:${userId}`;

    const tokens = await prisma.verificationToken.findMany({
        where: {
            identifier,
            type: LOGIN_CHALLENGE_TYPE,
            expires: { gt: new Date() },
        },
        orderBy: { expires: "desc" },
    });

    for (const token of tokens) {
        const valid = await compare(code, token.token);
        if (valid) {
            await prisma.verificationToken.deleteMany({
                where: { identifier, type: LOGIN_CHALLENGE_TYPE },
            });
            return true;
        }
    }

    return false;
}

export async function finalizeSuccessfulLogin(userId: string) {
    await prisma.user.update({
        where: { id: userId },
        data: {
            lastLoginAt: new Date(),
            failedLoginAttempts: 0,
            lockedUntil: null,
        },
    });

    await recordLoginAttempt(userId, true);
}

export async function finalizeSuccessfulLoginWithMetadata(
    userId: string,
    metadata?: LoginAttemptMetadata,
) {
    await prisma.user.update({
        where: { id: userId },
        data: {
            lastLoginAt: new Date(),
            failedLoginAttempts: 0,
            lockedUntil: null,
        },
    });

    await recordLoginAttempt(userId, true, undefined, metadata);
}

export async function recordSecondFactorFailure(
    userId: string,
    reason: string,
    metadata?: LoginAttemptMetadata,
) {
    await recordLoginAttempt(userId, false, reason, metadata);
}
