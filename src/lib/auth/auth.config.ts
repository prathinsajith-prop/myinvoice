import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/db/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user?.password) return null;

        const valid = await compare(password, user.password);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: null,           // Never store base64 images in JWT – session callback fetches fresh from DB
          twoFactorEnabled: user.twoFactorEnabled,
        };
      },
    }),

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
    newUser: "/onboarding",
  },

  callbacks: {
    async signIn({ account }) {
      // OAuth users are always allowed through; adapter handles creation
      if (account?.provider !== "credentials") return true;
      return true;
    },

    async jwt({ token, user, trigger, session }) {
      // ── Initial sign-in ──────────────────────────────────────────────────
      if (user) {
        token.id = user.id;
        token.twoFactorEnabled = user.twoFactorEnabled ?? false;
        // Remove image fields auto-merged by NextAuth to keep JWT small
        delete token.image;
        delete token.picture;

        const memberships = await prisma.organizationMembership.findMany({
          where: { userId: user.id!, isActive: true },
          include: {
            organization: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { createdAt: "asc" },
        });

        token.organizations = memberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role,
        }));

        if (memberships.length > 0) {
          const first = memberships[0];
          token.organizationId = first.organization.id;
          token.organizationSlug = first.organization.slug;
          token.role = first.role;
        }
      }

      // ── Fallback: re-hydrate org data when token is stale/incomplete ─────────────
      if ((!token.organizationId || !token.organizations || token.organizations.length === 0) && (token.id || token.sub)) {
        const uid = (token.id ?? token.sub) as string;
        const memberships = await prisma.organizationMembership.findMany({
          where: { userId: uid, isActive: true },
          include: {
            organization: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { createdAt: "asc" },
        });

        token.organizations = memberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role,
        }));

        if (!token.organizationId && memberships.length > 0) {
          const first = memberships[0];
          token.organizationId = first.organization.id;
          token.organizationSlug = first.organization.slug;
          token.role = first.role;
        }
      }

      // ── Organization switch ──────────────────────────────────────────────
      if (trigger === "update" && session?.organizationId) {
        const userId = (token.id ?? token.sub) as string;
        const membership = await prisma.organizationMembership.findFirst({
          where: {
            userId,
            organizationId: session.organizationId,
            isActive: true,
          },
          include: {
            organization: { select: { id: true, name: true, slug: true, logo: true } },
          },
        });

        if (membership) {
          token.organizationId = membership.organization.id;
          token.organizationSlug = membership.organization.slug;
          token.role = membership.role;

          // Refresh orgs list so newly joined orgs appear immediately
          const allMemberships = await prisma.organizationMembership.findMany({
            where: { userId, isActive: true },
            include: {
              organization: { select: { id: true, name: true, slug: true } },
            },
            orderBy: { createdAt: "asc" },
          });

          token.organizations = allMemberships.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            role: m.role,
          }));
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.twoFactorEnabled = token.twoFactorEnabled as boolean;
      session.user.organizationId = token.organizationId as string | undefined;
      session.user.organizationSlug = token.organizationSlug as string | undefined;
      session.user.role = token.role as string | undefined;

      // Token stores orgs WITHOUT logos (to keep JWT small).
      // Fetch fresh data from DB including logos.
      const uid = (token.id ?? token.sub) as string | undefined;
      const tokenOrgs = (token.organizations ?? []) as Array<{
        id: string;
        name: string;
        slug: string;
        role: string;
      }>;

      if (uid) {
        const orgIds = tokenOrgs.map((o) => o.id);

        const [freshUser, freshOrgs] = await Promise.all([
          prisma.user.findUnique({
            where: { id: uid },
            select: { name: true, image: true },
          }),
          orgIds.length > 0
            ? prisma.organization.findMany({
              where: { id: { in: orgIds } },
              select: { id: true, logo: true },
            })
            : [],
        ]);

        if (freshUser) {
          session.user.name = freshUser.name ?? session.user.name;
          session.user.image = freshUser.image ?? null;
        }

        const logoMap = new Map(freshOrgs.map((o) => [o.id, o.logo]));
        session.user.organizations = tokenOrgs.map((o) => ({
          ...o,
          logo: logoMap.get(o.id) ?? null,
        }));

        session.user.organizationLogo =
          logoMap.get(token.organizationId as string) ?? null;
      } else {
        session.user.organizations = tokenOrgs.map((o) => ({
          ...o,
          logo: null,
        }));
        session.user.organizationLogo = null;
      }

      return session;
    },
  },

  events: {
    async signIn({ user }) {
      if (!user.id) return;
      try {
        await prisma.loginHistory.create({
          data: {
            userId: user.id,
            success: true,
          },
        });
      } catch {
        // non-critical — do not block sign-in
      }
    },
    async createUser({ user }) {
      if (!user.id) return;

      const baseName = user.name ?? user.email?.split("@")[0] ?? "My";
      const suffix = user.id.slice(0, 8);
      const slug = `org-${suffix}`;

      const org = await prisma.organization.create({
        data: {
          name: `${baseName}'s Business`,
          slug,
        },
      });

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
