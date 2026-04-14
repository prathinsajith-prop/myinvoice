import { z } from "zod";

const expenseCategorySchema = z.enum([
    "RENT",
    "UTILITIES",
    "TRAVEL",
    "MEALS_ENTERTAINMENT",
    "OFFICE_SUPPLIES",
    "MARKETING",
    "SOFTWARE_SUBSCRIPTIONS",
    "PROFESSIONAL_FEES",
    "INSURANCE",
    "MAINTENANCE_REPAIRS",
    "SALARIES_WAGES",
    "TAX_PAYMENTS",
    "BANK_CHARGES",
    "OTHER",
]);

const vatTreatmentSchema = z.enum([
    "STANDARD_RATED",
    "ZERO_RATED",
    "EXEMPT",
    "REVERSE_CHARGE",
    "OUT_OF_SCOPE",
]);

// ── Create Expense ────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
    productId: z.string().cuid().optional().nullable(),

    description: z
        .string()
        .min(2, "Description must be at least 2 characters")
        .max(500, "Description must not exceed 500 characters"),
    expenseDate: z.coerce.date(),
    category: expenseCategorySchema.default("OTHER"),

    amount: z.number().positive("Amount must be greater than 0").max(9_999_999),
    currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD"]).default("AED"),

    vatTreatment: vatTreatmentSchema.default("STANDARD_RATED"),
    vatRate: z.number().min(0).max(100).default(5),
    isVatReclaimable: z.boolean().default(true),

    paymentMethod: z
        .enum(["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "STRIPE", "PAYBY", "TABBY", "TAMARA", "OTHER"])
        .default("CASH"),
    isPaid: z.boolean().default(true),
    paidAt: z.coerce.date().optional().nullable(),

    merchantName: z.string().max(200).optional().nullable(),
    receiptUrl: z.string().url("Invalid receipt URL").optional().nullable(),
    reference: z.string().max(100).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
});

// ── Update Expense ────────────────────────────────────────────────────────────

export const updateExpenseSchema = createExpenseSchema.partial();

// ── Query / Filter ────────────────────────────────────────────────────────────

export const listExpensesQuerySchema = z.object({
    search: z.string().max(200).optional(),
    category: expenseCategorySchema.optional(),
    isPaid: z.enum(["true", "false"]).optional(),
    isVatReclaimable: z.enum(["true", "false"]).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["expenseDate", "amount", "category", "createdAt"]).default("expenseDate"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
