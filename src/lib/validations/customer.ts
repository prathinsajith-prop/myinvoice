import { z } from "zod";

// ── Re-usable field fragments ─────────────────────────────────────────────────

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

const emirateSchema = z
    .enum(["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"])
    .optional()
    .nullable();

const vatTreatmentSchema = z.enum([
    "STANDARD_RATED",
    "ZERO_RATED",
    "EXEMPT",
    "REVERSE_CHARGE",
    "OUT_OF_SCOPE",
]);

// ── Create Customer ───────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
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
    emirate: emirateSchema,
    country: z.string().length(2, "Use ISO 2-letter country code").default("AE"),
    postalCode: z.string().max(20).optional().nullable(),
    poBox: z.string().max(20).optional().nullable(),

    shippingAddressLine1: z.string().max(255).optional().nullable(),
    shippingAddressLine2: z.string().max(255).optional().nullable(),
    shippingCity: z.string().max(100).optional().nullable(),
    shippingEmirate: emirateSchema,
    shippingCountry: z.string().length(2).optional().nullable(),
    shippingPostalCode: z.string().max(20).optional().nullable(),

    defaultPaymentTerms: z.number().int().min(0).max(365).optional().nullable(),
    creditLimit: z.number().positive().optional().nullable(),
    currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD"]).default("AED"),
    defaultVatTreatment: vatTreatmentSchema.default("STANDARD_RATED"),

    notes: z.string().max(2000).optional().nullable(),
    tags: z.array(z.string().max(50)).max(20).default([]),
});

// ── Update Customer (all optional) ───────────────────────────────────────────

export const updateCustomerSchema = createCustomerSchema.partial();

// ── Query / Filter ────────────────────────────────────────────────────────────

export const listCustomersQuerySchema = z.object({
    search: z.string().max(200).optional(),
    isActive: z.enum(["true", "false"]).optional(),
    type: z.enum(["BUSINESS", "INDIVIDUAL"]).optional(),
    currency: z.string().length(3).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["name", "createdAt", "totalInvoiced", "totalOutstanding"]).default("name"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
