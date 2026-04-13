import { auth } from "@/lib/auth";
import { getTenantPrisma, type TenantPrismaClient } from "@/lib/db/tenant";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * Get the current session (cached per request)
 */
export const getSession = cache(async () => {
  return await auth();
});

/**
 * Get the current user or redirect to login
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}

/**
 * Get the current organization ID or redirect to onboarding
 */
export async function requireOrganization() {
  const user = await requireAuth();

  if (!user.organizationId) {
    redirect("/onboarding");
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role!,
  };
}

/**
 * Get a tenant-scoped Prisma client for the current user's organization
 */
export async function getTenantDb(): Promise<TenantPrismaClient> {
  const { organizationId } = await requireOrganization();
  return getTenantPrisma(organizationId);
}

/**
 * Check if user has required role
 */
export async function requireRole(requiredRole: string) {
  const { role } = await requireOrganization();

  const roleHierarchy: Record<string, number> = {
    VIEWER: 1,
    MEMBER: 2,
    ACCOUNTANT: 3,
    ADMIN: 4,
    OWNER: 5,
  };

  if ((roleHierarchy[role] ?? 0) < (roleHierarchy[requiredRole] ?? 0)) {
    throw new Error("Insufficient permissions");
  }
}

/**
 * Audit log helper - records actions for FTA compliance
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
  const { organizationId } = await requireOrganization();

  const { default: prisma } = await import("@/lib/db/prisma");

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: session?.user.id,
      userEmail: session?.user.email,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      previousData: params.previousData as object,
      newData: params.newData as object,
      metadata: params.metadata as object,
    },
  });
}
