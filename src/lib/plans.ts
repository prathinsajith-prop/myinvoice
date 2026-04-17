/**
 * Plan-based usage limits for myinvoice.ae
 * All limits are enforced server-side in the relevant API routes.
 */

export type Plan = "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export interface PlanLimits {
  maxMembers: number;        // max OrganizationMembership rows
  maxInvoicesPerMonth: number; // -1 = unlimited
  maxStorageMb: number;      // -1 = unlimited
  canCustomBranding: boolean;
  canExport: boolean;
  canApiAccess: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    maxMembers: 3,
    maxInvoicesPerMonth: 50,
    maxStorageMb: 100,
    canCustomBranding: false,
    canExport: false,
    canApiAccess: false,
  },
  STARTER: {
    maxMembers: 10,
    maxInvoicesPerMonth: 200,
    maxStorageMb: 500,
    canCustomBranding: true,
    canExport: true,
    canApiAccess: false,
  },
  PROFESSIONAL: {
    maxMembers: -1,
    maxInvoicesPerMonth: -1,
    maxStorageMb: 5120,
    canCustomBranding: true,
    canExport: true,
    canApiAccess: true,
  },
  ENTERPRISE: {
    maxMembers: -1,
    maxInvoicesPerMonth: -1,
    maxStorageMb: 51200,
    canCustomBranding: true,
    canExport: true,
    canApiAccess: true,
  },
};

export function getLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function isUnlimited(value: number): boolean {
  return value === -1;
}

export const PLAN_LABELS: Record<Plan, string> = {
  FREE: "Free",
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
};

export const PLAN_UPGRADE_ORDER: Plan[] = [
  "FREE",
  "STARTER",
  "PROFESSIONAL",
  "ENTERPRISE",
];

export function getNextPlan(current: Plan): Plan | null {
  const idx = PLAN_UPGRADE_ORDER.indexOf(current);
  return idx < PLAN_UPGRADE_ORDER.length - 1
    ? PLAN_UPGRADE_ORDER[idx + 1]
    : null;
}
