import { z } from "zod";

// ── Notifications ────────────────────────────────────────────────────────────

export const createNotificationSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z
    .enum([
      "GENERAL",
      "INVOICE_CREATED",
      "INVOICE_SENT",
      "INVOICE_VIEWED",
      "INVOICE_PAID",
      "INVOICE_OVERDUE",
      "PAYMENT_RECEIVED",
      "PAYMENT_REMINDER",
      "PAYMENT_PLAN_DUE",
      "QUOTE_ACCEPTED",
      "QUOTE_REJECTED",
      "QUOTE_EXPIRED",
      "BILL_DUE",
      "CREDIT_NOTE_ISSUED",
      "CUSTOMER_ADDED",
      "TEAM_INVITE",
      "SUBSCRIPTION_EXPIRING",
      "SYSTEM_UPDATE",
      "SECURITY_ALERT",
    ])
    .default("GENERAL"),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  actionUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const markNotificationReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1),
});

// ── User Profile ─────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  phone: z.string().optional().nullable(),
  // Accept relative paths or https URLs only — reject base64 data URIs
  image: z
    .string()
    .refine((v) => !v.startsWith("data:"), {
      message: "Base64 data URIs are not accepted. Upload the file first.",
    })
    .optional()
    .nullable(),
});

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[a-z]/, "Password must contain a lowercase letter")
      .regex(/[0-9]/, "Password must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const updateNotificationPreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  invoiceNotifications: z.boolean().optional(),
  paymentNotifications: z.boolean().optional(),
  reminderNotifications: z.boolean().optional(),
  marketingNotifications: z.boolean().optional(),
});

// ── Organization ─────────────────────────────────────────────────────────────

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),

  // UAE Tax Info
  trn: z
    .string()
    .length(15, "TRN must be exactly 15 digits")
    .regex(/^\d+$/, "TRN must contain only numbers")
    .optional()
    .nullable(),
  tradeLicense: z.string().optional().nullable(),

  // Address
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  emirate: z.string().optional().nullable(),
  country: z.string().optional(),
  postalCode: z.string().optional().nullable(),

  // Branding
  logo: z.string().optional().nullable(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional()
    .nullable(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional()
    .nullable(),

  // Invoice/Quote Settings
  defaultCurrency: z.enum(["AED", "USD", "EUR", "GBP", "SAR", "OMR", "QAR", "KWD", "BHD", "INR", "PKR", "EGP"]).optional(),

  // Locale / Regional Settings (saved to OrganizationSettings)
  dateFormat: z.string().max(20).optional(),
  numberFormat: z.string().max(20).optional(),
  language: z.enum(["en", "ar"]).optional(),
  autoReminders: z.boolean().optional(),
  reminderDaysBefore: z.array(z.number().int().min(1).max(90)).max(10).optional(),
  reminderDaysAfter: z.array(z.number().int().min(1).max(365)).max(10).optional(),
  lateFeeEnabled: z.boolean().optional(),
  lateFeeType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  lateFeeValue: z.number().nonnegative().optional().nullable(),
  lateFeeDays: z.number().int().positive().optional().nullable(),
  fiscalYearStart: z.number().min(1).max(12).optional(),
  invoicePrefix: z.string().max(10).optional(),
  proformaPrefix: z.string().max(10).optional(),
  quotePrefix: z.string().max(10).optional(),
  creditNotePrefix: z.string().max(10).optional(),
  debitNotePrefix: z.string().max(10).optional(),
  billPrefix: z.string().max(10).optional(),
  paymentPrefix: z.string().max(10).optional(),
  defaultPaymentTerms: z.number().min(0).max(365).optional(),
  defaultDueDateDays: z.number().min(0).max(365).optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
  defaultNotes: z.string().max(2000).optional().nullable(),
  defaultTerms: z.string().max(5000).optional().nullable(),
});

// ── Organisation Settings ─────────────────────────────────────────────────────

export const updateOrganizationSettingsSchema = z.object({
  // VAT
  vatRegistered: z.boolean().optional(),
  vatEffectiveDate: z.coerce.date().optional().nullable(),
  reverseChargeEnabled: z.boolean().optional(),
  simplifiedInvoiceThreshold: z.number().nonnegative().optional(),

  // PDF Layout
  showLogo: z.boolean().optional(),
  showQrCode: z.boolean().optional(),
  showBankDetails: z.boolean().optional(),
  showSignature: z.boolean().optional(),
  showStamp: z.boolean().optional(),
  showWatermark: z.boolean().optional(),
  watermarkText: z.string().max(100).optional().nullable(),
  invoiceFooter: z.string().max(1000).optional().nullable(),

  // Bank Details
  bankName: z.string().max(100).optional().nullable(),
  bankAccountName: z.string().max(200).optional().nullable(),
  bankAccountNumber: z.string().max(50).optional().nullable(),
  bankIban: z
    .string()
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/, "Invalid IBAN format")
    .optional()
    .nullable(),
  bankSwift: z.string().max(11).optional().nullable(),
  bankBranch: z.string().max(100).optional().nullable(),

  // Reminders
  autoReminders: z.boolean().optional(),
  reminderDaysBefore: z.array(z.number().int().min(1).max(90)).max(10).optional(),
  reminderDaysAfter: z.array(z.number().int().min(1).max(365)).max(10).optional(),

  // Late Fees
  lateFeeEnabled: z.boolean().optional(),
  lateFeeType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  lateFeeValue: z.number().nonnegative().optional().nullable(),
  lateFeeDays: z.number().int().positive().optional().nullable(),

  // Locale
  timezone: z.string().max(50).optional(),
  dateFormat: z.string().max(20).optional(),
  numberFormat: z.string().max(20).optional(),
  language: z.enum(["en", "ar"]).optional(),
});

// ── Credit Note ───────────────────────────────────────────────────────────────

export const updateTeamMemberSchema = z.object({
  role: z.enum(["ADMIN", "ACCOUNTANT", "MEMBER", "VIEWER"]),
});

// ── Types ────────────────────────────────────────────────────────────────────

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type UpdateOrganizationSettingsInput = z.infer<typeof updateOrganizationSettingsSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
