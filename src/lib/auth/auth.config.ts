import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/db/prisma";

// Validation schema for credentials
const credentialsSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const authConfig: NextAuthConfig = {
  providers: [
    // Email/Password Authentication
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: {
            memberships: {
              where: { isActive: true },
              include: {
                organization: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValidPassword = await compare(password, user.password);
        if (!isValidPassword) {
          return null;
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          twoFactorEnabled: user.twoFactorEnabled,
        };
      },
    }),

    // Google OAuth
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  pages: {
    signIn: "/login",
    signOut: "/logout",
    error: "/login",
    verifyRequest: "/verify-email",
    newUser: "/onboarding",
  },

  callbacks: {
    async signIn({ user, account }) {
      // Allow OAuth without additional checks
      if (account?.provider !== "credentials") {
        // Create user and default organization for OAuth users if they don't exist
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (!existingUser) {
          // User will be created by the adapter
          return true;
        }

        // Check 2FA if enabled (for existing users)
        if (existingUser.twoFactorEnabled) {
          // 2FA verification will be handled in a separate flow
          // For now, allow sign in - 2FA check happens on protected routes
        }

        return true;
      }

      // For credentials, we've already validated in authorize()
      return true;
    },

    async jwt({ token, user, account, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.twoFactorEnabled = user.twoFactorEnabled;

        // Get user's organizations
        const memberships = await prisma.organizationMembership.findMany({
          where: { userId: user.id, isActive: true },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        token.organizations = memberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role,
        }));

        // Set current organization (first one by default)
        if (memberships.length > 0) {
          token.organizationId = memberships[0].organization.id;
          token.organizationSlug = memberships[0].organization.slug;
          token.role = memberships[0].role;
        }
      }

      // Handle organization switching
      if (trigger === "update" && session?.organizationId) {
        const membership = await prisma.organizationMembership.findFirst({
          where: {
            userId: token.id as string,
            organizationId: session.organizationId,
            isActive: true,
          },
          include: {
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
        });

        if (membership) {
          token.organizationId = membership.organization.id;
          token.organizationSlug = membership.organization.slug;
          token.role = membership.role;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.twoFactorEnabled = token.twoFactorEnabled as boolean;
        session.user.organizationId = token.organizationId as string | undefined;
        session.user.organizationSlug = token.organizationSlug as string | undefined;
        session.user.role = token.role as string | undefined;
        session.user.organizations = token.organizations as Array<{
          id: string;
          name: string;
          slug: string;
          role: string;
        }>;
      }
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      // Create a default personal organization for new OAuth users
      if (!user.id) return;
      
      const org = await prisma.organization.create({
        data: {
          name: `${user.name || user.email?.split("@")[0]}'s Business`,
          slug: `org-${user.id.slice(0, 8)}`,
        },
      });

      // Make them the owner
      await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "OWNER",
          acceptedAt: new Date(),
        },
      });
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === "development",
};
