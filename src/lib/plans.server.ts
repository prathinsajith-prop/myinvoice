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
async function getOrgPlan(organizationId: string): Promise<Plan> {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { plan: true },
  });
  return (sub?.plan ?? "FREE") as Plan;
}

export async function enforceMemberLimit(organizationId: string) {
  const plan = await getOrgPlan(organizationId);
  const limits = getLimits(plan);
  if (isUnlimited(limits.maxMembers)) return;

  const count = await prisma.organizationMembership.count({
    where: { organizationId, isActive: true },
  });

  if (count >= limits.maxMembers) {
    throw new PlanLimitError(
      `Your ${plan} plan allows a maximum of ${limits.maxMembers} members. ` +
      `Please upgrade to add more team members.`
    );
  }
}

/**
 * Throw if this month's invoice count would exceed the plan limit.
 * Pass the count from your own query to avoid an extra DB hit.
 */
export async function enforceInvoiceLimit(organizationId: string) {
  const plan = await getOrgPlan(organizationId);
  const limits = getLimits(plan);
  if (isUnlimited(limits.maxInvoicesPerMonth)) return;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const count = await prisma.invoice.count({
    where: {
      organizationId,
      deletedAt: null,
      createdAt: { gte: startOfMonth },
    },
  });

  if (count >= limits.maxInvoicesPerMonth) {
    throw new PlanLimitError(
      `Your ${plan} plan allows ${limits.maxInvoicesPerMonth} invoices per month. ` +
      `You've reached this limit. Please upgrade to create more invoices.`
    );
  }
}

/**
 * Return the current usage stats for an organization.
 */
export async function getUsageStats(organizationId: string) {
  const plan = await getOrgPlan(organizationId);
  const limits = getLimits(plan);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [memberCount, invoiceCount] = await Promise.all([
    prisma.organizationMembership.count({
      where: { organizationId, isActive: true },
    }),
    prisma.invoice.count({
      where: {
        organizationId,
        deletedAt: null,
        createdAt: { gte: startOfMonth },
      },
    }),
  ]);

  return {
    plan,
    limits,
    usage: {
      members: memberCount,
      invoicesThisMonth: invoiceCount,
    },
  };
}
