import { z } from "zod";

const vatTreatmentSchema = z.enum([
    "STANDARD_RATED",
    "ZERO_RATED",
    "EXEMPT",
    "REVERSE_CHARGE",
    "OUT_OF_SCOPE",
]);

// ── Line Item ─────────────────────────────────────────────────────────────────

export const lineItemSchema = z.object({
    productId: z.string().cuid().optional().nullable(),
    description: z
        .string()
        .min(1, "Description is required")
        .max(500, "Description must not exceed 500 characters"),
    quantity: z
        .number({ error: "Quantity is required" })
        .positive("Quantity must be greater than 0")
        .max(999_999, "Quantity too large"),
    unitPrice: z
        .number({ error: "Unit price is required" })
        .nonnegative("Unit price must be 0 or more")
        .max(9_999_999, "Unit price too large"),
    unitOfMeasure: z.string().max(50).default("unit"),
    discount: z.number().min(0).max(100, "Discount must be between 0% and 100%").default(0),
    vatTreatment: vatTreatmentSchema.default("STANDARD_RATED"),
    vatRate: z.number().min(0).max(100, "VAT rate must be between 0% and 100%").default(5),
    sortOrder: z.number().int().min(0).default(0),
});

// ── Create Invoice ────────────────────────────────────────────────────────────

export const createInvoiceSchema = z
    .object({
        customerId: z.string().cuid("Invalid customer ID"),
        quotationId: z.string().cuid().optional().nullable(),

        invoiceType: z.enum(["TAX_INVOICE", "SIMPLIFIED_TAX", "PROFORMA"]).default("TAX_INVOICE"),

        issueDate: z.coerce.date(),
        dueDate: z.coerce.date(),
        deliveryDate: z.coerce.date().optional().nullable(),

        currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD"]).default("AED"),
        exchangeRate: z.number().positive().default(1),

        reference: z.string().max(100).optional().nullable(),
        poNumber: z.string().max(100).optional().nullable(),

        notes: z.string().max(2000).optional().nullable(),
        terms: z.string().max(5000).optional().nullable(),
        internalNotes: z.string().max(2000).optional().nullable(),

        lineItems: z
            .array(lineItemSchema)
            .min(1, "At least one line item is required")
            .max(100, "Maximum 100 line items"),
    })
    .refine((d) => d.dueDate >= d.issueDate, {
        message: "Due date must be on or after the issue date",
        path: ["dueDate"],
    });

// ── Update Invoice (partial — only allowed fields) ────────────────────────────

export const updateInvoiceSchema = z.object({
    issueDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    deliveryDate: z.coerce.date().optional().nullable(),
    reference: z.string().max(100).optional().nullable(),
    poNumber: z.string().max(100).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    terms: z.string().max(5000).optional().nullable(),
    internalNotes: z.string().max(2000).optional().nullable(),
    currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD"]).optional(),
    exchangeRate: z.number().positive().optional(),
    lineItems: z.array(lineItemSchema).min(1).max(100).optional(),
});

// ── Void Invoice ──────────────────────────────────────────────────────────────

export const voidInvoiceSchema = z.object({
    reason: z
        .string()
        .min(5, "Please provide a reason for voiding (min 5 characters)")
        .max(500),
});

// ── Send Invoice ──────────────────────────────────────────────────────────────

export const sendInvoiceSchema = z.object({
    toEmails: z
        .array(z.string().email("Invalid email address"))
        .min(1, "At least one recipient required")
        .max(5, "Maximum 5 recipients"),
    ccEmails: z
        .array(z.string().email("Invalid email address"))
        .max(5, "Maximum 5 CC recipients")
        .default([]),
    subject: z.string().min(1).max(200).optional(),
    message: z.string().max(2000).optional(),
});

// ── Record Payment Against Invoice ───────────────────────────────────────────

export const recordInvoicePaymentSchema = z.object({
    amount: z
        .number({ error: "Amount is required" })
        .positive("Amount must be greater than 0"),
    paymentDate: z.coerce.date(),
    method: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "STRIPE", "PAYBY", "TABBY", "TAMARA", "OTHER"]),
    reference: z.string().max(200).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    bankCharge: z.number().nonnegative().default(0),
});

// ── Query / Filter ────────────────────────────────────────────────────────────

export const listInvoicesQuerySchema = z.object({
    search: z.string().max(200).optional(),
    customerId: z.string().cuid().optional(),
    status: z
        .enum(["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID", "CREDITED"])
        .optional(),
    invoiceType: z.enum(["TAX_INVOICE", "SIMPLIFIED_TAX", "PROFORMA"]).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    overdue: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["issueDate", "dueDate", "total", "invoiceNumber", "createdAt"]).default("issueDate"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type LineItemInput = z.infer<typeof lineItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>;
export type SendInvoiceInput = z.infer<typeof sendInvoiceSchema>;
export type RecordInvoicePaymentInput = z.infer<typeof recordInvoicePaymentSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
