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
      "QUOTE_ACCEPTED",
      "QUOTE_REJECTED",
      "CUSTOMER_ADDED",
      "TEAM_INVITE",
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
  image: z.string().url().optional().nullable(),
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
  logo: z.string().url().optional().nullable(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional()
    .nullable(),

  // Invoice/Quote Settings
  defaultCurrency: z.enum(["AED", "USD", "EUR", "GBP", "SAR"]).optional(),
  fiscalYearStart: z.number().min(1).max(12).optional(),
  invoicePrefix: z.string().max(10).optional(),
  quotePrefix: z.string().max(10).optional(),
  defaultPaymentTerms: z.number().min(0).max(365).optional(),
});

// ── Types ────────────────────────────────────────────────────────────────────

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
