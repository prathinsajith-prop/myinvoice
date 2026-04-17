/**
 * Centralized environment variable constants.
 *
 * SERVER-ONLY: This file reads server-side env vars and must NOT be imported
 * in Client Components. Use only in API routes, middleware, server components,
 * and server-side utilities.
 *
 * Public variables (NEXT_PUBLIC_*) are safe for both client and server.
 */

// ---------------------------------------------------------------------------
// Public — safe to use in both server and client contexts
// ---------------------------------------------------------------------------

export { APP_URL } from "@/lib/constants/env.client";

/** NextAuth / Auth.js secret key */
export const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET!;

/** Google OAuth credentials */
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

/** PostgreSQL connection string */
export const DATABASE_URL = process.env.DATABASE_URL!;

/** Stripe API keys & price IDs */
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
export const STRIPE_PRICE_STARTER = process.env.STRIPE_PRICE_STARTER;
export const STRIPE_PRICE_PROFESSIONAL = process.env.STRIPE_PRICE_PROFESSIONAL;
export const STRIPE_PRICE_ENTERPRISE = process.env.STRIPE_PRICE_ENTERPRISE;

/** Email sender configuration */
export const EMAIL_FROM = process.env.EMAIL_FROM;
export const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER ?? "resend";
export const EMAIL_DEV_FALLBACK = process.env.EMAIL_DEV_FALLBACK === "true";

/** Resend transactional email */
export const RESEND_API_KEY = process.env.RESEND_API_KEY;

/** Gmail SMTP fallback */
export const GMAIL_USER = process.env.GMAIL_USER;
export const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.replace(
    /\s+/g,
    ""
);

/** TOTP / 2FA issuer label */
export const TOTP_ISSUER = process.env.TOTP_ISSUER || "myinvoice.ae";

/** Secret for authenticating cron job endpoints */
export const CRON_SECRET = process.env.CRON_SECRET;
