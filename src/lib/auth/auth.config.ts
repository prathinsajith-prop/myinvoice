import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { seedNewOrganization } from "@/lib/db/seed-org";
import { verifyTotpCode } from "@/lib/security/totp";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "@/lib/constants/env";
import {
  finalizeSuccessfulLoginWithMetadata,
  recordSecondFactorFailure,
  validatePrimaryCredentials,
  verifyLoginChallenge,
} from "@/lib/auth/login-challenge";
import { getRequestMetadataFromHeaders } from "@/lib/security/request-metadata";
import { authCookieConfig } from "@/lib/auth/cookies";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  otp: z.string().regex(/^\d{6}$/).optional(),
});

export const authConfig: NextAuthConfig = {
  // Trust forwarded host headers. In development we always trust (localhost
  // is the only host). In production, gate behind AUTH_TRUST_HOST=true to
  // avoid host-header injection when the reverse proxy doesn't strictly
  // sanitize Host / X-Forwarded-Host. Set AUTH_TRUST_HOST=true on production
  // deployments behind a trusted proxy/CDN (Vercel, Cloudflare, nginx).
  // Vercel sets this automatically.
  trustHost:
    process.env.NODE_ENV !== "production" ||
    process.env.AUTH_TRUST_HOST === "true",
  // Cookie names + security flags are centralized in ./cookies so middleware,
  // API helpers, and Auth.js itself all agree. Auth.js's per-request HTTPS
  // auto-detection fails behind TLS-terminating proxies, so we pin everything
  // based on NODE_ENV.
  cookies: authCookieConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, otp } = parsed.data;
        const requestMetadata = getRequestMetadataFromHeaders(request?.headers);

        const primaryResult = await validatePrimaryCredentials(email, password, requestMetadata);
        if (!primaryResult.ok) return null;

        if (!otp) {
          await recordSecondFactorFailure(primaryResult.user.id, "Authentication code missing", requestMetadata);
          return null;
        }

        const user = primaryResult.user;
        const challengeValid = await verifyLoginChallenge(user.id, otp);
        const authenticatorValid = Boolean(
          user.twoFactorEnabled &&
          user.twoFactorSecret &&
          verifyTotpCode(user.twoFactorSecret, otp),
        );

        if (!challengeValid && !authenticatorValid) {
          await recordSecondFactorFailure(primaryResult.user.id, "Invalid or expired authentication code", requestMetadata);
          return null;
        }

        await finalizeSuccessfulLoginWithMetadata(user.id, requestMetadata);

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
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,

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
            organization: { select: { id: true, name: true, slug: true, logo: true } },
          },
          orderBy: { createdAt: "asc" },
        });

        token.organizations = memberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role,
        }));
        token.orgLogos = Object.fromEntries(
          memberships.map((m) => [m.organization.id, m.organization.logo ?? null]),
        );
        token.userImage = null;
        token.freshAt = Date.now();

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
            organization: { select: { id: true, name: true, slug: true, logo: true } },
          },
          orderBy: { createdAt: "asc" },
        });

        token.organizations = memberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role,
        }));
        token.orgLogos = Object.fromEntries(
          memberships.map((m) => [m.organization.id, m.organization.logo ?? null]),
        );
        token.freshAt = Date.now();

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
              organization: { select: { id: true, name: true, slug: true, logo: true } },
            },
            orderBy: { createdAt: "asc" },
          });

          token.organizations = allMemberships.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            role: m.role,
          }));
          token.orgLogos = Object.fromEntries(
            allMemberships.map((m) => [m.organization.id, m.organization.logo ?? null]),
          );
          token.freshAt = Date.now();
        }
      }

      // ── TTL refresh: user name/image + org names/logos ───────────────────
      // Session() used to do 2 DB queries on every request. Instead, we refresh
      // the cached snapshot embedded in the JWT at most once per 60 seconds.
      // Force a refresh via trigger === "update" (e.g. after profile update).
      const SESSION_REFRESH_TTL_MS = 60_000;
      const freshAt = (token.freshAt as number | undefined) ?? 0;
      const shouldRefresh =
        trigger === "update" || Date.now() - freshAt > SESSION_REFRESH_TTL_MS;

      if (shouldRefresh && (token.id || token.sub)) {
        const uid = (token.id ?? token.sub) as string;
        const tokenOrgs = (token.organizations ?? []) as Array<{ id: string }>;
        const orgIds = tokenOrgs.map((o) => o.id);

        const [freshUser, freshOrgs] = await Promise.all([
          prisma.user.findUnique({
            where: { id: uid },
            select: { name: true, image: true },
          }),
          orgIds.length > 0
            ? prisma.organization.findMany({
              where: { id: { in: orgIds } },
              select: { id: true, name: true, logo: true },
            })
            : Promise.resolve([] as Array<{ id: string; name: string; logo: string | null }>),
        ]);

        if (freshUser) {
          token.name = freshUser.name ?? (token.name as string | null | undefined);
          token.userImage = freshUser.image ?? null;
        }

        if (freshOrgs.length > 0) {
          const orgMap = new Map(freshOrgs.map((o) => [o.id, o]));
          token.organizations = (token.organizations ?? []).map((o) => ({
            ...o,
            name: orgMap.get(o.id)?.name ?? o.name,
          }));
          token.orgLogos = Object.fromEntries(
            freshOrgs.map((o) => [o.id, o.logo ?? null]),
          );
        }

        token.freshAt = Date.now();
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
      // Fetch fresh data from DB including logos, but only when the token's
      // cached snapshot is older than SESSION_REFRESH_TTL_MS. Session() is
      // called on virtually every authenticated request (useSession, auth(),
      // API helpers) — doing 2 DB queries each time saturates the pool.
      const tokenOrgs = (token.organizations ?? []) as Array<{
        id: string;
        name: string;
        slug: string;
        role: string;
      }>;

      const cachedUserName = token.name as string | null | undefined;
      const cachedUserImage = (token.userImage ?? null) as string | null;
      const cachedOrgLogos = (token.orgLogos ?? {}) as Record<string, string | null>;

      session.user.name = cachedUserName ?? session.user.name;
      session.user.image = cachedUserImage;
      session.user.organizations = tokenOrgs.map((o) => ({
        ...o,
        logo: cachedOrgLogos[o.id] ?? null,
      }));
      session.user.organizationLogo = token.organizationId
        ? (cachedOrgLogos[token.organizationId as string] ?? null)
        : null;

      return session;
    },
  },

  events: {
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

      // Seed subscription, settings, and document sequences
      await seedNewOrganization(org.id);
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === "development",
};
