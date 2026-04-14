import { z } from "zod";

const vatTreatmentSchema = z.enum([
    "STANDARD_RATED",
    "ZERO_RATED",
    "EXEMPT",
    "REVERSE_CHARGE",
    "OUT_OF_SCOPE",
]);

// ── Bill Line Item ────────────────────────────────────────────────────────────

export const billLineItemSchema = z.object({
    productId: z.string().cuid().optional().nullable(),
    description: z
        .string()
        .min(1, "Description is required")
        .max(500, "Description must not exceed 500 characters"),
    quantity: z.number().positive("Quantity must be greater than 0").max(999_999),
    unitPrice: z.number().nonnegative("Unit price must be 0 or more").max(9_999_999),
    unitOfMeasure: z.string().max(50).default("unit"),
    discount: z.number().min(0).max(100).default(0),
    vatTreatment: vatTreatmentSchema.default("STANDARD_RATED"),
    vatRate: z.number().min(0).max(100).default(5),
    isReclaimable: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
});

// ── Create Bill ───────────────────────────────────────────────────────────────

export const createBillSchema = z
    .object({
        supplierId: z.string().cuid("Invalid supplier ID"),

        supplierInvoiceNumber: z.string().max(100).optional().nullable(),
        reference: z.string().max(100).optional().nullable(),

        issueDate: z.coerce.date(),
        dueDate: z.coerce.date(),
        receivedDate: z.coerce.date().optional().nullable(),

        currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD"]).default("AED"),
        exchangeRate: z.number().positive().default(1),

        vatReclaimable: z.boolean().default(true),

        notes: z.string().max(2000).optional().nullable(),
        internalNotes: z.string().max(2000).optional().nullable(),

        lineItems: z
            .array(billLineItemSchema)
            .min(1, "At least one line item is required")
            .max(100, "Maximum 100 line items"),
    })
    .refine((d) => d.dueDate >= d.issueDate, {
        message: "Due date must be on or after the issue date",
        path: ["dueDate"],
    });

// ── Update Bill ───────────────────────────────────────────────────────────────

export const updateBillSchema = z.object({
    supplierInvoiceNumber: z.string().max(100).optional().nullable(),
    reference: z.string().max(100).optional().nullable(),
    issueDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    receivedDate: z.coerce.date().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    internalNotes: z.string().max(2000).optional().nullable(),
    currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD"]).optional(),
    exchangeRate: z.number().positive().optional(),
    vatReclaimable: z.boolean().optional(),
    lineItems: z.array(billLineItemSchema).min(1).max(100).optional(),
});

// ── Void Bill ─────────────────────────────────────────────────────────────────

export const voidBillSchema = z.object({
    reason: z.string().min(5).max(500),
});

// ── Record Bill Payment ───────────────────────────────────────────────────────

export const recordBillPaymentSchema = z.object({
    amount: z.number().positive("Amount must be greater than 0"),
    paymentDate: z.coerce.date(),
    method: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "STRIPE", "PAYBY", "TABBY", "TAMARA", "OTHER"]),
    reference: z.string().max(200).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    bankCharge: z.number().nonnegative().default(0),
});

// ── Query / Filter ────────────────────────────────────────────────────────────

export const listBillsQuerySchema = z.object({
    search: z.string().max(200).optional(),
    supplierId: z.string().cuid().optional(),
    status: z.enum(["DRAFT", "RECEIVED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"]).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    overdue: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["issueDate", "dueDate", "total", "billNumber", "createdAt"]).default("issueDate"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type BillLineItemInput = z.infer<typeof billLineItemSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type VoidBillInput = z.infer<typeof voidBillSchema>;
export type RecordBillPaymentInput = z.infer<typeof recordBillPaymentSchema>;
export type ListBillsQuery = z.infer<typeof listBillsQuerySchema>;
