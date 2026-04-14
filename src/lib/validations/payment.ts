import { z } from "zod";

const paymentMethodSchema = z.enum([
    "CASH",
    "BANK_TRANSFER",
    "CHEQUE",
    "CARD",
    "STRIPE",
    "PAYBY",
    "TABBY",
    "TAMARA",
    "OTHER",
]);

// ── Payment Allocation (how a payment maps to invoices) ───────────────────────

export const paymentAllocationSchema = z.object({
    invoiceId: z.string().cuid("Invalid invoice ID"),
    amount: z.number().positive("Allocation amount must be greater than 0"),
});

// ── Create Payment (received from customer) ───────────────────────────────────

export const createPaymentSchema = z
    .object({
        customerId: z.string().cuid("Invalid customer ID"),

        method: paymentMethodSchema,
        currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD"]).default("AED"),
        exchangeRate: z.number().positive().default(1),
        amount: z.number().positive("Amount must be greater than 0").max(999_999_999),
        bankCharge: z.number().nonnegative().default(0),

        paymentDate: z.coerce.date(),
        reference: z.string().max(200).optional().nullable(),
        gatewayTransactionId: z.string().max(200).optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),

        // One payment can be partially allocated across multiple invoices
        allocations: z
            .array(paymentAllocationSchema)
            .min(1, "At least one invoice must be selected")
            .max(50, "Maximum 50 allocations per payment"),
    })
    .refine(
        (d) => {
            const allocatedTotal = d.allocations.reduce((sum, a) => sum + a.amount, 0);
            return Math.abs(allocatedTotal - (d.amount - d.bankCharge)) < 0.01;
        },
        {
            message: "Sum of allocations must equal the net payment amount (amount minus bank charges)",
            path: ["allocations"],
        }
    );

// ── Create Payment Out (paid to supplier) ────────────────────────────────────

export const paymentOutAllocationSchema = z.object({
    billId: z.string().cuid("Invalid bill ID"),
    amount: z.number().positive("Allocation amount must be greater than 0"),
});

export const createPaymentOutSchema = z
    .object({
        supplierId: z.string().cuid("Invalid supplier ID"),

        method: paymentMethodSchema,
        currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD"]).default("AED"),
        exchangeRate: z.number().positive().default(1),
        amount: z.number().positive("Amount must be greater than 0").max(999_999_999),
        bankCharge: z.number().nonnegative().default(0),

        paymentDate: z.coerce.date(),
        reference: z.string().max(200).optional().nullable(),
        gatewayTransactionId: z.string().max(200).optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),

        allocations: z
            .array(paymentOutAllocationSchema)
            .min(1, "At least one bill must be selected")
            .max(50),
    })
    .refine(
        (d) => {
            const allocatedTotal = d.allocations.reduce((sum, a) => sum + a.amount, 0);
            return Math.abs(allocatedTotal - (d.amount - d.bankCharge)) < 0.01;
        },
        {
            message: "Sum of allocations must equal the net payment amount (amount minus bank charges)",
            path: ["allocations"],
        }
    );

// ── Query / Filter ────────────────────────────────────────────────────────────

export const listPaymentsQuerySchema = z.object({
    customerId: z.string().cuid().optional(),
    method: paymentMethodSchema.optional(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["paymentDate", "amount", "createdAt"]).default("paymentDate"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const listPaymentsOutQuerySchema = z.object({
    supplierId: z.string().cuid().optional(),
    method: paymentMethodSchema.optional(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["paymentDate", "amount", "createdAt"]).default("paymentDate"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaymentAllocationInput = z.infer<typeof paymentAllocationSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentOutAllocationInput = z.infer<typeof paymentOutAllocationSchema>;
export type CreatePaymentOutInput = z.infer<typeof createPaymentOutSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
export type ListPaymentsOutQuery = z.infer<typeof listPaymentsOutQuerySchema>;
