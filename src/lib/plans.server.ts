/**
 * Server-side plan enforcement helpers.
 * Call these from API routes before creating new resources.
 */

import prisma from "@/lib/db/prisma";
import { getLimits, isUnlimited, type Plan } from "@/lib/plans";
import { AppError } from "@/lib/errors";

export class PlanLimitError extends AppError {
  constructor(message: string) {
    super(message, "PLAN_LIMIT_EXCEEDED", 403);
    this.name = "PlanLimitError";
  }
}

/**
 * Throw if adding a new member would exceed the plan's seat limit.
 */
export async function enforceMemberLimit(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });

  if (!org) return;

  const limits = getLimits(org.plan as Plan);
  if (isUnlimited(limits.maxMembers)) return;

  const count = await prisma.organizationMembership.count({
    where: { organizationId, isActive: true },
  });

  if (count >= limits.maxMembers) {
    throw new PlanLimitError(
      `Your ${org.plan} plan allows a maximum of ${limits.maxMembers} members. ` +
        `Please upgrade to add more team members.`
    );
  }
}

/**
 * Throw if this month's invoice count would exceed the plan limit.
 * Pass the count from your own query to avoid an extra DB hit.
 */
export async function enforceInvoiceLimit(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });

  if (!org) return;

  const limits = getLimits(org.plan as Plan);
  if (isUnlimited(limits.maxInvoicesPerMonth)) return;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // AuditLog-based count (replace with Invoice model count when available)
  const count = await prisma.auditLog.count({
    where: {
      organizationId,
      entityType: "Invoice",
      action: "CREATE",
      createdAt: { gte: startOfMonth },
    },
  });

  if (count >= limits.maxInvoicesPerMonth) {
    throw new PlanLimitError(
      `Your ${org.plan} plan allows ${limits.maxInvoicesPerMonth} invoices per month. ` +
        `You've reached this limit. Please upgrade to create more invoices.`
    );
  }
}

/**
 * Return the current usage stats for an organization.
 */
export async function getUsageStats(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });

  if (!org) return null;

  const limits = getLimits(org.plan as Plan);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [memberCount, invoiceCount] = await Promise.all([
    prisma.organizationMembership.count({
      where: { organizationId, isActive: true },
    }),
    prisma.auditLog.count({
      where: {
        organizationId,
        entityType: "Invoice",
        action: "CREATE",
        createdAt: { gte: startOfMonth },
      },
    }),
  ]);

  return {
    plan: org.plan as Plan,
    limits,
    usage: {
      members: memberCount,
      invoicesThisMonth: invoiceCount,
    },
  };
}
