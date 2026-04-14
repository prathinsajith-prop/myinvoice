import { auth } from "@/lib/auth";
import { getTenantPrisma, type TenantPrismaClient } from "@/lib/db/tenant";
import { redirect } from "next/navigation";
import { cache } from "react";
import { hasRole, hasPermission, type MemberRole, type Permission } from "@/lib/rbac";
import prisma from "@/lib/db/prisma";

/**
 * Get the current session (cached per request via React cache).
 */
export const getSession = cache(async () => {
  return await auth();
});

/**
 * Require authentication — redirects to /login if no session.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

/**
 * Require an active organization — redirects to /onboarding if missing.
 * Returns { userId, organizationId, role }.
 */
export async function requireOrganization() {
  const user = await requireAuth();

  if (!user.organizationId) {
    redirect("/onboarding");
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role as MemberRole,
  };
}

/**
 * Get a tenant-scoped Prisma client for the current request's organization.
 */
export async function getTenantDb(): Promise<TenantPrismaClient> {
  const { organizationId } = await requireOrganization();
  return getTenantPrisma(organizationId);
}

/**
 * Require a minimum role — throws if the current user's role is insufficient.
 */
export async function requireRole(requiredRole: MemberRole) {
  const { role } = await requireOrganization();

  if (!hasRole(role, requiredRole)) {
    throw new Error(`Requires ${requiredRole} or higher`);
  }
}

/**
 * Require a specific permission — throws if the current user lacks it.
 */
export async function requirePermission(permission: Permission) {
  const { role } = await requireOrganization();

  if (!hasPermission(role, permission)) {
    throw new Error("Insufficient permissions");
  }
}

/**
 * Write an audit log entry (FTA compliance).
 * Uses the raw prisma client since AuditLog is not isolated by the tenant extension.
 */
export async function logAudit(params: {
  action: string;
  entityType: string;
  entityId?: string;
  previousData?: unknown;
  newData?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const session = await getSession();
  if (!session?.user?.organizationId) return;

  await prisma.auditLog.create({
    data: {
      organizationId: session.user.organizationId,
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      previousData: params.previousData as object | undefined,
      newData: params.newData as object | undefined,
      metadata: params.metadata as object | undefined,
    },
  });
}
