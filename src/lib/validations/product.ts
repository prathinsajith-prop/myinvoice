import { z } from "zod";

const vatTreatmentSchema = z.enum([
    "STANDARD_RATED",
    "ZERO_RATED",
    "EXEMPT",
    "REVERSE_CHARGE",
    "OUT_OF_SCOPE",
]);

// ── Create Product / Service ──────────────────────────────────────────────────

export const createProductSchema = z.object({
    name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(300, "Name must not exceed 300 characters"),
    description: z.string().max(2000).optional().nullable(),

    sku: z.string().max(100).optional().nullable(),
    barcode: z.string().max(100).optional().nullable(),

    unitPrice: z
        .number({ error: "Unit price is required" })
        .nonnegative("Unit price must be 0 or more")
        .max(9_999_999, "Unit price too large"),
    currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD"]).default("AED"),

    vatTreatment: vatTreatmentSchema.default("STANDARD_RATED"),
    vatRate: z.number().min(0).max(100).default(5),

    type: z.enum(["PRODUCT", "SERVICE"]).default("SERVICE"),
    unitOfMeasure: z.string().max(50).default("unit"),
    category: z.string().max(100).optional().nullable(),

    trackInventory: z.boolean().default(false),
    stockQuantity: z.number().nonnegative().optional().nullable(),
    lowStockAlert: z.number().nonnegative().optional().nullable(),
});

// ── Update Product ────────────────────────────────────────────────────────────

export const updateProductSchema = createProductSchema.partial();

// ── Query / Filter ────────────────────────────────────────────────────────────

export const listProductsQuerySchema = z.object({
    search: z.string().max(200).optional(),
    type: z.enum(["PRODUCT", "SERVICE"]).optional(),
    category: z.string().max(100).optional(),
    isActive: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["name", "createdAt", "unitPrice"]).default("name"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
