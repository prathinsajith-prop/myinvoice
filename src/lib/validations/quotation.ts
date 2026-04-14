import { z } from "zod";
import { lineItemSchema } from "./invoice";

// ── Create Quotation ──────────────────────────────────────────────────────────

export const createQuotationSchema = z
    .object({
        customerId: z.string().cuid("Invalid customer ID"),

        issueDate: z.coerce.date(),
        validUntil: z.coerce.date(),

        currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD"]).default("AED"),
        exchangeRate: z.number().positive().default(1),

        reference: z.string().max(100).optional().nullable(),

        notes: z.string().max(2000).optional().nullable(),
        terms: z.string().max(5000).optional().nullable(),
        internalNotes: z.string().max(2000).optional().nullable(),

        lineItems: z
            .array(lineItemSchema)
            .min(1, "At least one line item is required")
            .max(100, "Maximum 100 line items"),
    })
    .refine((d) => d.validUntil > d.issueDate, {
        message: "Valid until date must be after the issue date",
        path: ["validUntil"],
    });

// ── Update Quotation ──────────────────────────────────────────────────────────

export const updateQuotationSchema = z.object({
    issueDate: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    reference: z.string().max(100).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    terms: z.string().max(5000).optional().nullable(),
    internalNotes: z.string().max(2000).optional().nullable(),
    currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD"]).optional(),
    exchangeRate: z.number().positive().optional(),
    lineItems: z.array(lineItemSchema).min(1).max(100).optional(),
});

// ── Convert Quotation to Invoice ──────────────────────────────────────────────

export const convertQuotationSchema = z.object({
    invoiceType: z.enum(["TAX_INVOICE", "SIMPLIFIED_TAX", "PROFORMA"]).default("TAX_INVOICE"),
    issueDate: z.coerce.date().optional(),
    dueDate: z.coerce.date(),
    notes: z.string().max(2000).optional().nullable(),
});

// ── Send Quotation ────────────────────────────────────────────────────────────

export const sendQuotationSchema = z.object({
    toEmails: z
        .array(z.string().email())
        .min(1, "At least one recipient required")
        .max(5, "Maximum 5 recipients"),
    ccEmails: z.array(z.string().email()).max(5).default([]),
    subject: z.string().min(1).max(200).optional(),
    message: z.string().max(2000).optional(),
});

// ── Query / Filter ────────────────────────────────────────────────────────────

export const listQuotationsQuerySchema = z.object({
    search: z.string().max(200).optional(),
    customerId: z.string().cuid().optional(),
    status: z
        .enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"])
        .optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["issueDate", "validUntil", "total", "quoteNumber", "createdAt"]).default("issueDate"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
export type ConvertQuotationInput = z.infer<typeof convertQuotationSchema>;
export type SendQuotationInput = z.infer<typeof sendQuotationSchema>;
export type ListQuotationsQuery = z.infer<typeof listQuotationsQuerySchema>;
