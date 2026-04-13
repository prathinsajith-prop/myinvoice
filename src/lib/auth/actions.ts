"use server";

import { signIn, signOut } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import prisma from "@/lib/db/prisma";
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

    const { name, email, password } = parsed.data;
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

    // Create default organization
    const org = await prisma.organization.create({
      data: {
        name: `${name}'s Business`,
        slug: `org-${user.id.slice(0, 8)}`,
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
    redirectTo: "/",
  });
}

/**
 * Switch organization
 */
export async function switchOrganization(organizationId: string): Promise<ActionResult> {
  // This will be called from client to update session
  // The actual switch happens in the JWT callback
  return { success: true };
}
