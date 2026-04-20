"use server";

import { signIn, signOut, unstable_update } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import prisma from "@/lib/db/prisma";
import { seedNewOrganization } from "@/lib/db/seed-org";
import { AuthError } from "next-auth";

export type ActionResult = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

/**
 * Register a new user with email and password
 */
export async function registerAction(data: RegisterInput): Promise<ActionResult> {
  try {
    // Validate input
    const parsed = registerSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { name, email, password, organizationName, businessType, country } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return {
        success: false,
        message: "An account with this email already exists",
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user with default organization
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
      },
    });

    // Create organization with provided details
    const org = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: `org-${user.id.slice(0, 8)}`,
        businessType: businessType || undefined,
        country: country || "AE",
        defaultCurrency: country === "AE" ? "AED" : "USD",
        defaultVatRate: country === "AE" ? 5 : 0,
      },
    });

    // Create ownership membership
    await prisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "OWNER",
        acceptedAt: new Date(),
      },
    });

    // Seed subscription, settings, and document sequences
    await seedNewOrganization(org.id);

    return {
      success: true,
      message: "Account created successfully. Please sign in.",
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      message: "An error occurred during registration. Please try again.",
    };
  }
}

/**
 * Sign in with email and password
 */
export async function loginAction(
  email: string,
  password: string,
  callbackUrl?: string
): Promise<ActionResult> {
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl || "/dashboard",
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return {
            success: false,
            message: "Invalid email or password",
          };
        default:
          return {
            success: false,
            message: "An error occurred during sign in",
          };
      }
    }
    // This handles the redirect case (Next.js throws a NEXT_REDIRECT error)
    throw error;
  }
}

/**
 * Sign in with OAuth provider
 */
export async function oauthSignIn(
  provider: "google" | "apple",
  callbackUrl?: string
): Promise<void> {
  await signIn(provider, {
    redirectTo: callbackUrl || "/dashboard",
  });
}

/**
 * Sign out
 */
export async function logoutAction(): Promise<void> {
  await signOut({
    redirectTo: "/login",
  });
}

/**
 * Switch organization — server action that properly updates the JWT cookie.
 * Uses unstable_update (NextAuth v5 server-side update) which skips CSRF
 * checks and directly writes the new session to the response cookie.
 */
export async function switchOrganizationAction(organizationId: string): Promise<ActionResult> {
  try {
    const updated = await unstable_update({ organizationId } as never);
    if (!updated) {
      return { success: false, message: "Failed to update session" };
    }
    return { success: true };
  } catch (error) {
    console.error("switchOrganizationAction error:", error);
    return { success: false, message: "Failed to switch organization" };
  }
}
