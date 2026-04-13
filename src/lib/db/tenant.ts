import { Prisma } from "@prisma/client";
import prisma from "./prisma";

// Models that are tenant-scoped (have organizationId)
const TENANT_SCOPED_MODELS = [
  "customer",
  "supplier",
  "product",
  "auditLog",
] as const;

type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

function isTenantScopedModel(model: string): model is TenantScopedModel {
  return TENANT_SCOPED_MODELS.includes(model.toLowerCase() as TenantScopedModel);
}

/**
 * Creates a tenant-scoped Prisma client that automatically:
 * - Adds organizationId filter to all read queries
 * - Adds organizationId to all create operations
 * - Validates organizationId on update/delete operations
 *
 * @param organizationId - The current tenant's organization ID
 * @returns Extended Prisma client with tenant isolation
 */
export function getTenantPrisma(organizationId: string) {
  return prisma.$extends({
    name: "tenantIsolation",
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (isTenantScopedModel(model)) {
            (args.where as Record<string, unknown>) = {
              ...args.where,
              organizationId,
            };
          }
          return query(args);
        },

        async findFirst({ model, args, query }) {
          if (isTenantScopedModel(model)) {
            (args.where as Record<string, unknown>) = {
              ...args.where,
              organizationId,
            };
          }
          return query(args);
        },

        async findUnique({ model, args, query }) {
          // For findUnique, we need to verify after fetch
          const result = await query(args);
          if (
            isTenantScopedModel(model) &&
            result &&
            "organizationId" in result &&
            result.organizationId !== organizationId
          ) {
            return null; // Don't expose data from other tenants
          }
          return result;
        },

        async create({ model, args, query }) {
          if (isTenantScopedModel(model)) {
            (args.data as Record<string, unknown>) = {
              ...args.data,
              organizationId,
            };
          }
          return query(args);
        },

        async createMany({ model, args, query }) {
          if (isTenantScopedModel(model) && Array.isArray(args.data)) {
            args.data = args.data.map((item) => ({
              ...item,
              organizationId,
            })) as typeof args.data;
          }
          return query(args);
        },

        async update({ model, args, query }) {
          if (isTenantScopedModel(model)) {
            (args.where as Record<string, unknown>) = {
              ...args.where,
              organizationId,
            };
          }
          return query(args);
        },

        async updateMany({ model, args, query }) {
          if (isTenantScopedModel(model)) {
            (args.where as Record<string, unknown>) = {
              ...args.where,
              organizationId,
            };
          }
          return query(args);
        },

        async delete({ model, args, query }) {
          if (isTenantScopedModel(model)) {
            (args.where as Record<string, unknown>) = {
              ...args.where,
              organizationId,
            };
          }
          return query(args);
        },

        async deleteMany({ model, args, query }) {
          if (isTenantScopedModel(model)) {
            (args.where as Record<string, unknown>) = {
              ...args.where,
              organizationId,
            };
          }
          return query(args);
        },

        async count({ model, args, query }) {
          if (isTenantScopedModel(model)) {
            (args.where as Record<string, unknown>) = {
              ...args.where,
              organizationId,
            };
          }
          return query(args);
        },

        async aggregate({ model, args, query }) {
          if (isTenantScopedModel(model)) {
            (args.where as Record<string, unknown>) = {
              ...args.where,
              organizationId,
            };
          }
          return query(args);
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof getTenantPrisma>;
