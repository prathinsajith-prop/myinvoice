import { z } from "zod";

const trnSchema = z
    .string()
    .length(15, "TRN must be exactly 15 digits")
    .regex(/^\d{15}$/, "TRN must contain only digits")
    .optional()
    .nullable();

const uaePhoneSchema = z
    .string()
    .regex(/^\+?[0-9\s\-().]{7,20}$/, "Invalid phone number")
    .optional()
    .nullable();

const ibanSchema = z
    .string()
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/, "Invalid IBAN format")
    .optional()
    .nullable();

// ── Create Supplier ───────────────────────────────────────────────────────────

export const createSupplierSchema = z.object({
    name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(200, "Name must not exceed 200 characters"),
    displayName: z.string().max(200).optional().nullable(),
    type: z.enum(["BUSINESS", "INDIVIDUAL"]).default("BUSINESS"),

    email: z.string().email("Invalid email address").optional().nullable(),
    phone: uaePhoneSchema,
    mobile: uaePhoneSchema,
    contactPerson: z.string().max(100).optional().nullable(),
    website: z.string().url("Invalid URL").optional().nullable(),

    trn: trnSchema,
    isVatRegistered: z.boolean().default(false),

    addressLine1: z.string().max(255).optional().nullable(),
    addressLine2: z.string().max(255).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    emirate: z
        .enum(["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"])
        .optional()
        .nullable(),
    country: z.string().length(2, "Use ISO 2-letter country code").default("AE"),
    postalCode: z.string().max(20).optional().nullable(),
    poBox: z.string().max(20).optional().nullable(),

    // Bank / Payment details
    bankName: z.string().max(100).optional().nullable(),
    bankAccountName: z.string().max(200).optional().nullable(),
    bankAccountNumber: z.string().max(50).optional().nullable(),
    bankIban: ibanSchema,
    bankSwift: z
        .string()
        .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, "Invalid SWIFT/BIC code")
        .optional()
        .nullable(),
    bankBranch: z.string().max(100).optional().nullable(),

    defaultPaymentTerms: z.number().int().min(0).max(365).default(30),
    currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD"]).default("AED"),

    notes: z.string().max(2000).optional().nullable(),
    tags: z.array(z.string().max(50)).max(20).default([]),
});

// ── Update Supplier ───────────────────────────────────────────────────────────

export const updateSupplierSchema = createSupplierSchema.partial();

// ── Query / Filter ────────────────────────────────────────────────────────────

export const listSuppliersQuerySchema = z.object({
    search: z.string().max(200).optional(),
    isActive: z.enum(["true", "false"]).optional(),
    type: z.enum(["BUSINESS", "INDIVIDUAL"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["name", "createdAt", "totalBilled", "totalOutstanding"]).default("name"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
