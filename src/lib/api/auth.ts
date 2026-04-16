/**
 * API-layer auth helpers (for Route Handlers)
 * These use getToken() which works in Edge/Node route handlers.
 */

import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { hasRole, type MemberRole, hasPermission, type Permission } from "@/lib/rbac";
import prisma from "@/lib/db/prisma";
import { getTenantPrisma, type TenantPrismaClient } from "@/lib/db/tenant";
import { NEXTAUTH_SECRET } from "@/lib/constants/env";

export interface ApiContext {
  userId: string;
  organizationId: string;
  role: MemberRole;
  email: string | null;
}

export interface ApiUserContext {
  userId: string;
}

/**
 * Resolve user-only auth context (no org required).
 * Use this for profile, password, and other user-scoped endpoints.
 */
export async function resolveUserContext(req: NextRequest): Promise<ApiUserContext> {
  let token;
  try {
    token = await getToken({ req, secret: NEXTAUTH_SECRET });
  } catch {
    throw new UnauthorizedError();
  }

  if (!token?.sub) {
    throw new UnauthorizedError();
  }

  return { userId: token.sub };
}

/**
 * Resolve and validate the tenant context from a request token.
 * Throws typed errors rather than returning null.
 */
export async function resolveApiContext(req: NextRequest): Promise<ApiContext> {
  let token;
  try {
    token = await getToken({ req, secret: NEXTAUTH_SECRET });
  } catch {
    throw new UnauthorizedError();
  }

  if (!token?.sub) {
    throw new UnauthorizedError();
  }

  if (!token.organizationId) {
    throw new UnauthorizedError("No active organization. Please complete onboarding.");
  }

  return {
    userId: token.sub,
    organizationId: token.organizationId as string,
    role: token.role as MemberRole,
    email: (token.email as string) ?? null,
  };
}

/**
 * Resolve context and additionally verify role meets minimum requirement.
 */
export async function resolveApiContextWithRole(
  req: NextRequest,
  requiredRole: MemberRole
): Promise<ApiContext> {
  const ctx = await resolveApiContext(req);

  if (!hasRole(ctx.role, requiredRole)) {
    throw new ForbiddenError(`Requires ${requiredRole} or higher role`);
  }

  return ctx;
}

/**
 * Resolve context and verify a specific permission.
 */
export async function resolveApiContextWithPermission(
  req: NextRequest,
  permission: Permission
): Promise<ApiContext> {
  const ctx = await resolveApiContext(req);

  if (!hasPermission(ctx.role, permission)) {
    throw new ForbiddenError();
  }

  return ctx;
}

/**
 * Get a tenant-scoped Prisma client for a given API context.
 */
export function getTenantDb(ctx: ApiContext): TenantPrismaClient {
  return getTenantPrisma(ctx.organizationId);
}

/**
 * Verify the requesting user is actually a member of the org in the token.
 * Use this when you want a fresh DB check instead of trusting the JWT claim.
 */
export async function verifyMembership(ctx: ApiContext): Promise<MemberRole> {
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      userId_organizationId: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
      },
    },
    select: { role: true, isActive: true },
  });

  if (!membership || !membership.isActive) {
    throw new ForbiddenError("You are not a member of this organization");
  }

  return membership.role as MemberRole;
}

/**
 * Ensure a target membership belongs to the same org (prevent cross-tenant access).
 */
export async function verifyMembershipOwnership(
  membershipId: string,
  organizationId: string
) {
  const membership = await prisma.organizationMembership.findUnique({
    where: { id: membershipId },
    select: { organizationId: true, role: true, userId: true },
  });

  if (!membership || membership.organizationId !== organizationId) {
    throw new NotFoundError("Member");
  }

  return membership;
}
