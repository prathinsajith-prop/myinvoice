import prisma from "./prisma";

// All models that carry an organizationId foreign key
const TENANT_SCOPED_MODELS = new Set([
  "customer",
  "supplier",
  "product",
  "invoice",
  "quotation",
  "creditnote",
  "debitnote",
  "bill",
  "payment",
  "paymentout",
  "expense",
  "invoicetemplate",
  "attachment",
  "vatreturn",
  "documentsequence",
  "auditlog",
  "deliverynote",
  "deliverynotelineitem",
  "recurringinvoice",
  "recurringinvoicelineitem",
  "paymentreminder",
  "notification",
]);

function isTenantScoped(model: string): boolean {
  return TENANT_SCOPED_MODELS.has(model.toLowerCase());
}

function injectOrg(
  where: Record<string, unknown> | undefined,
  organizationId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return { ...where, organizationId };
}

/**
 * Creates a Prisma extension that automatically:
 *  - Injects organizationId into every write (create / createMany)
 *  - Adds organizationId filter to every read / mutation WHERE clause
 *  - Returns null (instead of leaking data) when findUnique matches a
 *    different tenant's row
 *
 * Only tenant-scoped models are affected; global models (User, Session,
 * Organization, etc.) pass through unchanged.
 */
export function getTenantPrisma(organizationId: string) {
  return prisma.$extends({
    name: "tenantIsolation",
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = injectOrg(args.where as Record<string, unknown>, organizationId);
          }
          return query(args);
        },

        async findFirst({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = injectOrg(args.where as Record<string, unknown>, organizationId);
          }
          return query(args);
        },

        async findUnique({ model, args, query }) {
          const result = await query(args);
          // Post-fetch tenant check — findUnique doesn't support composite WHERE
          if (
            isTenantScoped(model) &&
            result !== null &&
            typeof result === "object" &&
            "organizationId" in result &&
            (result as { organizationId: string }).organizationId !== organizationId
          ) {
            return null;
          }
          return result;
        },

        async count({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = injectOrg(args.where as Record<string, unknown>, organizationId);
          }
          return query(args);
        },

        async aggregate({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = injectOrg(args.where as Record<string, unknown>, organizationId);
          }
          return query(args);
        },

        async create({ model, args, query }) {
          if (isTenantScoped(model)) {
            (args.data as Record<string, unknown>).organizationId = organizationId;
          }
          return query(args);
        },

        async createMany({ model, args, query }) {
          if (isTenantScoped(model) && Array.isArray(args.data)) {
            args.data = args.data.map((item) => ({
              ...item,
              organizationId,
            })) as typeof args.data;
          }
          return query(args);
        },

        async update({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = injectOrg(args.where as Record<string, unknown>, organizationId);
          }
          return query(args);
        },

        async updateMany({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = injectOrg(args.where as Record<string, unknown>, organizationId);
          }
          return query(args);
        },

        async delete({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = injectOrg(args.where as Record<string, unknown>, organizationId);
          }
          return query(args);
        },

        async deleteMany({ model, args, query }) {
          if (isTenantScoped(model)) {
            args.where = injectOrg(args.where as Record<string, unknown>, organizationId);
          }
          return query(args);
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof getTenantPrisma>;
